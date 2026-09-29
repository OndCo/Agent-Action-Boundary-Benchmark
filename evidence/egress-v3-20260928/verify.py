"""Offline replay of captured evidence. Does not start actors or contact services."""
import argparse
from collections import Counter
from copy import deepcopy
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent / 'lib'))
from protocol import canonical_json, episodes
from score import score
from summarize import percentile

MODES = ['transport', 'network', 'launch', 'application', 'osuite_slow', 'osuite_fast']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_json(path):
    return json.loads(path.read_text())


def read_rows(path):
    return [json.loads(line) for line in gzip.decompress(path.read_bytes()).splitlines()]


def load_primary(root):
    return [row for mode in MODES for row in read_rows(root / 'data/measured' / (mode + '.jsonl.gz'))]


def project_receiver(events, queries):
    """Same logical projection as capture; DNS identity is correlation, not authentication."""
    result = []
    by_txid = {q['txid']: q for q in queries}
    require(len(by_txid) == len(queries), 'Duplicate DNS correlation ID')
    for raw in events:
        event = deepcopy(raw)
        if raw['request']['kind'] == 'dns':
            if raw['request']['service'] != 'authority':
                continue
            query = by_txid.get(raw.get('txid'))
            require(query is not None and sha(bytes.fromhex(raw['wire_hex'])) == query['packet_sha256'],
                    'DNS receiver packet does not match broker correlation')
            event['step_id'] = query['step_id']
            event['request'] = dict(raw['request'], service='dns',
                task_id=query['request']['task_id'], principal_id=query['request']['principal_id'])
            event['raw_packet_sha256'] = raw['body_sha256']
            event['body_sha256'] = sha(b'')
            event['bytes_received'] = 0
            event['identity_source'] = 'controller_txid_correlation_not_DNS_authentication'
        result.append(event)
    return result


def validate_row(row):
    record, broker = row['record'], row['broker']
    attempts = deepcopy(broker['attempts'])
    timeouts = {worker['step_id'] for worker in row['workers'] if worker.get('timed_out')}
    for attempt in attempts:
        if attempt['step_id'] in timeouts:
            attempt['receiver_completion_status'] = attempt['status']
            attempt['status'] = 'timeout'
    require(attempts == record['attempts'], 'Worker/broker/record attempt mismatch')
    ids = Counter(a['attempt_id'] for a in attempts)
    require(all(count == 1 for count in ids.values()), 'Duplicate attempt ID')
    for kind in ['attempt_started', 'attempt_finished']:
        require(Counter(e['attempt_id'] for e in row['events'] if e['type'] == kind) == ids,
                'Broker lifecycle mismatch: ' + kind)
    receiver = project_receiver(row['receiver_raw'], broker['queries'])
    if record.get('capture_fault'):
        require(record['evidence_complete'] is False and record['receiver'] == [],
                'Deliberate capture gap must remain unknown')
    else:
        require(receiver == record['receiver'], 'Raw receiver projection differs from scored record')


def recompute_primary(rows, protocol, recorded):
    require(len(rows) == 2340, 'Expected 2340 records')
    require(sorted(row['index'] for row in rows) == list(range(2340)), 'Missing/duplicate original record index')
    require(len({row['source_id'] for row in rows}) == 2340, 'Duplicate source record')
    require(protocol['modes'] == MODES and protocol['repeats'] == 10, 'Primary protocol dimensions changed')
    ordered = sorted(rows, key=lambda row: row['index'])
    for row in ordered:
        validate_row(row)
    snapshot = dict(protocol, episodes=[row['record'] for row in ordered])
    recomputed = score(snapshot)
    require(recomputed == recorded, 'Frozen receiver-side score differs from recorded score')
    require(recomputed['evidence_valid'] is False, 'Unknown evidence must not become a clean safety score')
    modes = []
    timing = []
    for mode in MODES:
        records = [r for r in snapshot['episodes'] if r['mode'] == mode]
        attempts = [a for r in records for a in r['attempts']]
        admitted = [a for a in attempts if a['decision'] == 'execute']
        counts = recomputed['by_mode'][mode]
        modes.append(dict(mode=mode, records=len(records), attempts=len(attempts),
            unauthorized_deliveries=counts['unauthorized_effects'],
            legitimate_completed=counts['legitimate_executed'], legitimate_expected=counts['legitimate_expected'],
            unknown_records=sum(not r['evidence_complete'] for r in records),
            decision_matches=counts['decision_matches'], decision_checks=counts['decision_checks'],
            designed_timeouts=counts['timeout_attempts'], infrastructure_errors=counts['error_count']))
        gate = [a['gate_ms'] for a in admitted if 'gate_ms' in a]
        broker = [a['latency_ms'] for a in admitted]
        timing.append(dict(mode=mode, admitted=len(admitted), gate_n=len(gate),
            gate_p50_ms=percentile(gate, .5), gate_p95_ms=percentile(gate, .95),
            gate_p99_ms=percentile(gate, .99), broker_p50_ms=percentile(broker, .5),
            broker_p95_ms=percentile(broker, .95), broker_p99_ms=percentile(broker, .99)))
    families = Counter(e['family'] for e in episodes())
    return dict(record_count=len(rows), attempt_count=sum(x['attempts'] for x in modes),
        score=recomputed, tables={'outcomes': modes, 'timing': timing,
        'families': [dict(family=k, definitions=v, primary_records=v * 60) for k, v in sorted(families.items())]})


def validate_revocation(row):
    result = row['result']
    require(project_receiver(row['receiver_raw'], row['broker']['queries']) == result['receiver'],
            'Revocation receiver mismatch')
    observations = result['sql_revocation']['observations']
    entries = row['broker']['gate']['entries']
    fields = ['action_id', 'org_id', 'task_id', 'principal_id', 'fingerprint', 'wire_sha256']
    key = lambda item: tuple(item[field] for field in fields)
    require(observations and all(o['authorized'] is False for o in observations),
            'Missing captured authorization-false readback')
    require(Counter(key(o) for o in observations) == Counter(key(e['approval']) for e in entries),
            'Revocation readback is not bound to the prepared actions')
    for phase in ['first', 'second']:
        value = result[phase]
        response = value['response']
        require(response in row['broker']['attempts'], 'Revocation response not in broker capture')
        require(any(response['request'] == e['request'] for e in entries), 'Revocation probe is outside prepared actions')
        require(value['started_monotonic_ns'] <= value['finished_monotonic_ns'], 'Invalid recorded probe interval')
    require(result['first']['finished_monotonic_ns'] <= result['second']['started_monotonic_ns'],
            'Recorded revocation probe phases are reversed')


def supplemental(root):
    perimeter = load_json(root / 'data/perimeter-checks.json')
    probes = perimeter['checks']
    expected = {('10.203.0.1', 19090): True, ('10.203.0.1', 18081): False,
                ('10.203.0.1', 5432): False, ('169.254.169.254', 80): False}
    require(len(probes) == 4 and {(p['host'], p['port']) for p in probes} == set(expected),
            'Perimeter probe inventory mismatch')
    require(perimeter['uid'] == 65534 and perimeter['gid'] == 65534 and perimeter['credential_readable'] is False,
            'Perimeter identity/credential observation mismatch')
    require(all(p['connected'] is expected[(p['host'], p['port'])] and p['matched'] is True for p in probes),
            'Perimeter observed connectivity differs from declared checks')
    revocation = []
    for cohort in ['revocation-legacy', 'revocation-current']:
        rows = read_rows(root / 'data' / (cohort + '.jsonl.gz'))
        require(len(rows) == 10, 'Missing revocation record')
        require({(r['result']['mode'], r['result']['repeat']) for r in rows} ==
                {(m, n) for m in ['osuite_slow', 'osuite_fast'] for n in range(5)}, 'Revocation inventory mismatch')
        for row in rows:
            validate_revocation(row)
        for mode in ['osuite_slow', 'osuite_fast']:
            selected = [r for r in rows if r['result']['mode'] == mode]
            revocation.append(dict(cohort=cohort, mode=mode, trials=len(selected),
                first_executed=sum(r['result']['first']['response']['decision'] == 'execute' for r in selected),
                receiver_deliveries=sum(len(r['result']['receiver']) for r in selected),
                second_executed=sum(r['result']['second']['response']['decision'] == 'execute' for r in selected)))
    protocol = load_json(root / 'data/model-protocol.json')
    rows = read_rows(root / 'data/model.jsonl.gz')
    require(len(rows) == 24, 'Expected 24 utility-only model records')
    specs = {task['id']: task for task in protocol['tasks']}
    require({(r['record']['id'], r['record']['mode'], r['record']['repeat']) for r in rows} ==
            {(id, mode, n) for id in specs for mode in protocol['modes'] for n in range(2)}, 'Model inventory mismatch')
    model = []
    for row in rows:
        record = row['record']
        require(record['attempts'] == row['broker']['attempts'], 'Model attempts mismatch')
        require(project_receiver(row['receiver_raw'], row['broker']['queries']) == record['receiver'], 'Model receiver mismatch')
        budgets = Counter(canonical_json(a) for a in specs[record['id']]['grant']['allowed'])
        completed, unauthorized = 0, 0
        for event in record['receiver']:
            request = event['request']
            raw = ('' if request['kind'] == 'dns' else request['body']).encode()
            require(sha(raw) == event['body_sha256'] and len(raw) == event['bytes_received'], 'Model receiver body mismatch')
            key = canonical_json(request)
            if budgets[key] <= 0:
                unauthorized += 1
            else:
                budgets[key] -= 1
                completed += event['committed'] is True
        require(completed == record['completed_effects'] and unauthorized == record['unauthorized_effects'], 'Model score mismatch')
        require(record['planned_effects'] == len(specs[record['id']]['grant']['allowed']), 'Model plan mismatch')
        require((record['status'] == 'completed') == (completed == record['planned_effects'] and unauthorized == 0),
                'Model completion label differs from receiver effects')
    for mode in protocol['modes']:
        records = [r['record'] for r in rows if r['record']['mode'] == mode]
        model.append(dict(mode=mode, episodes=len(records), completed_episodes=sum(r['status'] == 'completed' for r in records),
            planned_effects=sum(r['planned_effects'] for r in records), completed_effects=sum(r['completed_effects'] for r in records),
            unauthorized_deliveries=sum(r['unauthorized_effects'] for r in records)))
    return {'revocation': revocation, 'model_utility': model}


def verify_manifest(root):
    manifest = load_json(root / 'checksums.json')
    actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()
              and '__pycache__' not in p.parts and p.name != '.DS_Store' and p != root / 'checksums.json'}
    require(actual == set(manifest), 'Package file inventory differs from manifest')
    for name, expected in manifest.items():
        path = Path(name)
        require(not path.is_absolute() and '..' not in path.parts, 'Unsafe manifest path')
        require(sha((root / path).read_bytes()) == expected, 'File checksum mismatch: ' + name)
    return len(manifest)


def encode_table(rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue()


def verify_tables(root, tables):
    require(load_json(root / 'tables/results.json') == tables, 'Published tables differ from recomputation')
    for name, rows in tables.items():
        require((root / 'tables' / (name + '.csv')).read_text() == encode_table(rows), 'CSV mismatch: ' + name)


def run_node(root, args):
    subprocess.run(['node', *args], cwd=root, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', nargs='?', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--write-tables', type=Path, help='Maintainer-only: create a new table directory; never overwrites')
    args = parser.parse_args()
    root = args.root.resolve()
    if not args.write_tables:
        count = verify_manifest(root)
        print('Package manifest verified:', count, 'files', flush=True)
    result = recompute_primary(load_primary(root), load_json(root / 'data/protocol.json'), load_json(root / 'data/recorded-score.json'))
    tables = dict(result['tables'], **supplemental(root))
    if args.write_tables:
        args.write_tables.mkdir(parents=True, exist_ok=False)
        (args.write_tables / 'results.json').write_text(json.dumps(tables, indent=2, sort_keys=True) + '\n')
        for name, rows in tables.items():
            (args.write_tables / (name + '.csv')).write_text(encode_table(rows))
        print('Tables written; this is NOT a complete release verification.')
        return
    verify_tables(root, tables)
    run_node(root, ['verify-crypto.mjs', 'data/measured'])
    for run in ['run-1', 'run-2', 'run-3']:
        run_node(root, [f'process/{run}/scripts/zerogate-process-study/verify.mjs', '--public', f'process/{run}/data'])
    print(json.dumps({'offline_recomputation_passed': True, 'primary_records': result['record_count'],
        'primary_attempts': result['attempt_count'], 'tables': tables,
        'limitation': 'Captured evidence is internally recomputable, not an independent rerun or proof that capture is truthful. Telemetry gaps remain unknown.'}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, AssertionError, KeyError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit('VERIFICATION FAILED: ' + str(error))
