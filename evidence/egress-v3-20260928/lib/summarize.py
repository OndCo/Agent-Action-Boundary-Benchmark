import argparse
import json
from collections import Counter
from pathlib import Path
import statistics
from score import score


def percentile(values, p):
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def summarize(directory):
    snapshot = json.loads((directory / 'snapshot.json').read_text())
    scored = score(snapshot)
    result = {}
    for mode in snapshot['modes']:
        records = [record for record in snapshot['episodes'] if record['mode'] == mode]
        attempts = [attempt for record in records for attempt in record['attempts']]
        admitted = [attempt for attempt in attempts if attempt['decision'] == 'execute']
        timings = [attempt['gate_ms'] for attempt in admitted if 'gate_ms' in attempt]
        total_times = [attempt['latency_ms'] for attempt in admitted]
        result[mode] = dict(scored['by_mode'][mode],
            attempts=len(attempts), decisions=Counter(attempt['decision'] for attempt in attempts),
            gate_admitted_ms=dict(n=len(timings), p50=percentile(timings, .5), p95=percentile(timings, .95), p99=percentile(timings, .99)),
            broker_admitted_ms=dict(n=len(total_times), p50=percentile(total_times, .5), p95=percentile(total_times, .95), p99=percentile(total_times, .99)),
            telemetry_fault_runs=sum(bool(record.get('capture_fault')) for record in records))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    print(json.dumps(summarize(args.directory), indent=2, sort_keys=True))
