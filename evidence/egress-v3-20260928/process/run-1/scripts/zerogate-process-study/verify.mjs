import assert from 'node:assert/strict';
import { createHash, createPublicKey } from 'node:crypto';
import { readFileSync, existsSync, lstatSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { verifyBundle } from '../egress-v2/verify-crypto.mjs';
import { filesUnder, checksums, json } from './evidence.mjs';

export const PROTOCOL = JSON.parse(readFileSync(new URL('./protocol.json', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function canonical(value) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  assert.ok(value && typeof value === 'object', 'Non-JSON evidence');
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const hash = value => sha(canonical(value));
const same = (a, b, why) => assert.deepEqual(a, b, why);
const check = (condition, why) => assert.ok(condition, why);
const FIELDS = ['action_id', 'org_id', 'task_id', 'principal_id', 'fingerprint', 'wire_sha256'];

function verifyInput(input, id) {
  check(/^[a-f0-9-]{36}$/.test(input.run_id), 'Invalid run identity');
  const actionId = `ps_${input.run_id.replaceAll('-', '')}_${PROTOCOL.cases.findIndex(x => x.id === id)}`;
  same(input.case_id, id);
  const request = { kind: 'http', service: 'publish', method: 'PUT', path: `/process-study/${actionId}`,
    body: `SYNTHETIC:${actionId}`, task_id: `task_${actionId}`, principal_id: 'process-study-worker' };
  same(input.request, request, 'Request differs from frozen synthetic workload');
  const wire = sha(request.body);
  const action = { schema_version: 'osuite.cava.canonical_action.v1', runtime: 'egress-v2',
    adapter: 'egress-v2.action-evidence.v1', executable: null, operation: 'http_put', category: 'network',
    systems_touched: ['http', 'publish'], reversible: false, target: 'publish.lab.test', subject: request.path,
    metadata: { mapper_version: 'egress-v2.action-evidence.v1', kind: 'http', service: 'publish', destination: 'publish.lab.test',
      method: 'PUT', path: request.path, body_sha256: wire, body_bytes: Buffer.byteLength(request.body), wire_sha256: wire,
      task_id: request.task_id, principal_id: request.principal_id } };
  same(input.mapping, { status: 'complete', action, fingerprint: hash(action), wire_sha256: wire }, 'Action mapping not reconstructed from bytes');
  same(input.snapshot, PROTOCOL.snapshot);
  const p = input.pass, approval = input.approval;
  same(input.envelope.algorithm, 'Ed25519');
  same(createPublicKey(input.public_key_pem).asymmetricKeyType, 'ed25519');
  same(Buffer.from(input.envelope.signature_b64, 'base64').length, 64);
  same(Buffer.from(input.envelope.signature_b64, 'base64').toString('base64'), input.envelope.signature_b64);
  same(p.issuer, { id: 'process-study-controller', key_ref: input.key_id });
  same(p.holder, { agent_id: request.principal_id, principal_id: request.principal_id,
    workspace_id: 'zerogate-process-study', runtime_session_id: request.task_id });
  same(p.action_binding, { mode: 'cava_fingerprint', allowed_fingerprint: hash(action), canonical_action: action });
  same(p.authority.granted, { operations: ['http_put'], resource_scope: [request.path], destinations: ['publish.lab.test'],
    systems_touched: ['http', 'publish'], constraints: {} });
  same(p.budget, { unit: 'action', limit: 1, consumed: 0, aggregate_key: PROTOCOL.aggregate_key });
  same(p.pass_id, actionId); same(p.nonce, actionId);
  same(p.policy_binding.policy_digest, input.snapshot.policyDigest);
  same(p.state_binding.state_digest, input.snapshot.stateDigest);
  same(p.revocation_binding.epoch, input.snapshot.revocationEpoch);
  check(Date.parse(p.validity.expires_at) - Date.parse(p.validity.issued_at) === PROTOCOL.pass_ttl_seconds * 1000, 'Changed signed lifetime');
  same(p.validity.not_before, p.validity.issued_at);
  const binding = { action_id: actionId, org_id: 'org_egress_lab', task_id: request.task_id,
    principal_id: request.principal_id, fingerprint: hash(action), wire_sha256: wire };
  for (const key of FIELDS) same(approval[key], binding[key], 'Approval binding mismatch');
  check(approval.authorized === true && approval.binding_valid === true && approval.status === 'running'
    && approval.proof_revocation_status === 'active' && approval.observation === 'independent_postgres_select', 'Missing active Studio readback');
  const receipts = approval.proof_bundle?.approval_receipts;
  check(receipts?.length === 1, 'Require one actual approval receipt');
  const a = receipts[0];
  same(a.decision, 'allow'); same(a.actor_type, 'human_approver');
  check(typeof a.actor_id === 'string' && a.actor_id !== request.principal_id, 'Approval reviewer must differ from actor');
  same(a.approval_binding, 'canonical_fingerprint');
  same(a.approval_scope, { kind: 'single_action', action_id: actionId, canonical_fingerprint: hash(action), reusable: false });
  return binding;
}

function verifyLedger(store, input) {
  same(store.snapshot, input.snapshot);
  const p = input.pass;
  const executions = [];
  for (const [index, r] of store.receipts.entries()) {
    const { receipt_hash, ...body } = r;
    same(hash(body), receipt_hash, 'Receipt hash mismatch');
    same(r.receipt_id, index + 1); same(r.sequence_number, r.receipt_id);
    same(r.schema_version, 'zerogate.durable_gate.receipt.v1');
    for (const [key, expected] of Object.entries({ pass_id: p.pass_id, pass_hash: p.pass_hash, nonce: p.nonce,
      issuer_id: p.issuer.id, workspace_id: p.holder.workspace_id, key_id: input.key_id,
      action_fingerprint: input.mapping.fingerprint, signature_verified: true, requested_units: 1, aggregate_key: PROTOCOL.aggregate_key })) same(r[key], expected, `Receipt ${key} mismatch`);
    same(r.snapshot, input.snapshot);
    check(Date.parse(r.observed_at) >= Date.parse(p.validity.not_before)
      && Date.parse(r.observed_at) < Date.parse(p.validity.expires_at), 'Receipt outside real signed lifetime');
    if (r.decision === 'execute') { same(r.reason, 'local_commit_satisfied'); same(r.lane, 'fast'); executions.push(r); }
    else { same(r.decision, 'deny'); same(r.reason, 'replay_nonce_seen'); same(r.lane, 'block'); check(executions.length === 1, 'Replay refusal before consumption'); }
  }
  check(executions.length <= 1, 'More than one admission in one SQLite domain');
  same(store.consumed_nonces, executions.map(r => ({ issuer_id: r.issuer_id, workspace_id: r.workspace_id,
    nonce: r.nonce, pass_id: r.pass_id, pass_hash: r.pass_hash, requested_units: 1, aggregate_key: PROTOCOL.aggregate_key,
    receipt_id: r.receipt_id, consumed_at: r.observed_at })), 'Nonce rows do not match receipts');
  same(store.pass_usage, executions.length ? [{ issuer_id: p.issuer.id, workspace_id: p.holder.workspace_id,
    pass_id: p.pass_id, pass_hash: p.pass_hash, limit_units: 1, initial_consumed_units: 0, consumed_units: 1 }] : [], 'Pass usage mismatch');
  same(store.aggregate_quotas, [{ aggregate_key: PROTOCOL.aggregate_key, limit_units: 1, consumed_units: executions.length }], 'Aggregate usage mismatch');
  verifyBundle({ schema: 'egress-v2-gate.v2', mode: 'osuite_fast', authority_kind: PROTOCOL.authority,
    authority_freshness: 'strict_live_v1', key_id: input.key_id, public_key_pem: input.public_key_pem,
    entries: [{ mapping: input.mapping, pass: p, envelope: input.envelope, approval: input.approval }],
    audit: { receipts: store.receipts } }, { requireLiveAuthority: true });
  return executions.length;
}

// Verifies evidence consistency only. Unit callers may use explicitly constructed
// transcripts; verifyStudy (the artifact entry point) will require measured mode.
export function verifyCase(record) {
  const { id, input, workers, events, stores, arrivals, crash } = record;
  const planned = PROTOCOL.cases.find(x => x.id === id);
  check(planned, 'Unknown case');
  const binding = verifyInput(input, id);
  same(workers.length, planned.workers);
  same(Object.keys(stores).sort(), planned.stores === 2 ? ['a', 'b'] : ['a']);
  same(new Set(workers.map(w => w.pid)).size, workers.length, 'Workers must have distinct PIDs');
  events.forEach((e, index) => {
    same(e.seq, index + 1, 'Noncontiguous event transcript');
    check(['controller', 'receiver', ...workers.map(w => w.id)].includes(e.actor), 'Unknown event actor');
    const allowed = e.actor === 'controller' ? ['command', 'kill', 'exit', 'receiver_exit', 'ack_release', 'revoked']
      : e.actor === 'receiver' ? ['ready', 'arrival'] : ['ready', 'read', 'locked', 'committed', 'result'];
    check(allowed.includes(e.type), 'Unexpected failure or event type');
  });
  const find = (actor, type, predicate = () => true) => events.filter(e => e.actor === actor && e.type === type && predicate(e.data));
  const one = (actor, type, predicate) => { const found = find(actor, type, predicate); same(found.length, 1, `${actor}/${type} missing or duplicated`); return found[0]; };
  const command = (w, name) => one('controller', 'command', d => d.worker === w && d.command === name);
  const before = (...list) => list.slice(1).forEach((e, i) => check(list[i].seq < e.seq, 'Barrier ordering violated'));
  const receiver = one('receiver', 'ready');
  check(receiver.data.host === '127.0.0.1' && Number.isSafeInteger(receiver.data.pid) && receiver.data.pid > 0
    && !workers.some(w => w.pid === receiver.data.pid), 'Receiver must be a separate private process');
  same(one('controller', 'receiver_exit').data, { pid: receiver.data.pid, code: 0, signal: null }, 'Capture did not close successfully');
  before(receiver, one('controller', 'receiver_exit'));
  same(events.at(-1), one('controller', 'receiver_exit'), 'Receiver closure must follow the complete capture');
  same(find('controller', 'kill').length, planned.killed);
  same(find('controller', 'exit').length, workers.length);
  same(find('controller', 'ack_release').length, arrivals.length);
  const receiptOwners = new Map();
  let refusals = 0, killed = 0, completed = 0;
  const checkIds = new Set();
  for (const [index, w] of workers.entries()) {
    same(w.id, `w${index}`); same(w.store, planned.stores === 2 && index === 1 ? 'b' : 'a');
    check(Number.isSafeInteger(w.pid) && w.pid > 0, 'Invalid worker PID');
    const ready = one(w.id, 'ready');
    const exited = one('controller', 'exit', d => d.worker === w.id);
    same(exited.data, { worker: w.id, code: w.code, signal: w.signal });
    before(ready, exited);
    if (w.terminal === 'killed') {
      killed++; same(index, 0); same(w.code, null); same(w.signal, 'SIGKILL'); same(w.result, null);
      before(ready, one('controller', 'kill', d => d.worker === w.id && d.signal === 'SIGKILL'), exited);
      same(find(w.id, 'result').length, 0, 'Killed worker cannot claim a final reply');
    } else {
      same(w.terminal, 'completed'); same(w.code, 0); same(w.signal, null); completed++;
      const result = one(w.id, 'result'); same(result.data, w.result); before(result, exited);
    }
    const readEvents = find(w.id, 'read');
    if (id === 'revoke-before-replacement-read' && index === 0) { same(readEvents.length, 0); continue; }
    const read = one(w.id, 'read'); before(ready, command(w.id, 'evaluate'), read, exited);
    if (w.terminal === 'completed') before(read, one(w.id, 'result'));
    const current = read.data.inspection, checked = read.data.check;
    for (const field of FIELDS) same(current[field], binding[field], 'Live read binding mismatch');
    same(current.binding_valid, true); same(current.status, 'running'); same(current.observation, 'independent_postgres_select');
    if (id === 'revoke-before-replacement-read') {
      same(current.authorized, false); same(current.proof_revocation_status, 'revoked');
      same(checked, { authorized: false, decision: 'deny', reason: 'live_authority_not_granted' });
      same(w.result, { decision: 'deny', reason: 'live_authority_not_granted' }); refusals++;
      before(one('controller', 'revoked'), read); continue;
    }
    same(current.authorized, true); same(checked.authorized, true);
    same(current.proof_revocation_status, 'active');
    same(current.proof_bundle.approval_receipts, input.approval.proof_bundle.approval_receipts);
    check(typeof checked.evidence?.check_id === 'string' && !checkIds.has(checked.evidence.check_id), 'Missing/reused live check');
    checkIds.add(checked.evidence.check_id);
    same(checked.evidence.binding, binding);
    const evidence = checked.evidence;
    same(evidence.mode, 'strict_live');
    check(Number.isFinite(Date.parse(evidence.observed_at)) && Number.isFinite(evidence.lookup_ms)
      && evidence.lookup_ms >= 0 && evidence.lookup_ms < evidence.timeout_ms
      && evidence.timeout_ms > 0 && evidence.timeout_ms <= 2000
      && evidence.max_admission_delay_ms > 0 && evidence.max_admission_delay_ms <= 250, 'Invalid fresh-read timing');
    if (id === 'kill-before-consume' && index === 0) {
      before(read, one(w.id, 'locked'), one('controller', 'kill', d => d.worker === w.id));
      same(find(w.id, 'committed').length, 0); continue;
    }
    const commits = find(w.id, 'committed');
    const ref = commits.length ? one(w.id, 'committed').data : w.result;
    const receipt = stores[w.store].receipts.find(r => r.receipt_id === ref?.receipt_id);
    check(receipt && receipt.receipt_hash === ref.receipt_hash, 'Worker receipt not in SQLite');
    const receiptKey = `${w.store}/${receipt.receipt_id}`;
    check(!receiptOwners.has(receiptKey), 'Receipt assigned to more than one worker'); receiptOwners.set(receiptKey, w.id);
    if (receipt.decision === 'execute') {
      before(read, one(w.id, 'committed'), exited);
      if (w.terminal === 'killed') before(one(w.id, 'committed'), one('controller', 'kill', d => d.worker === w.id));
      const { admission_delay_ms, ...evidence } = receipt.authority_check;
      same(evidence, checked.evidence, 'Receipt did not use this worker live check');
      if (w.terminal === 'completed') { same(w.result.decision, 'execute'); same(w.result.reason, receipt.reason); same(w.result.receipt_id, receipt.receipt_id); same(w.result.receipt_hash, receipt.receipt_hash); }
    } else {
      same(commits.length, 0); same(w.terminal, 'completed');
      same(w.result, { decision: 'deny', reason: 'replay_nonce_seen', receipt_id: receipt.receipt_id, receipt_hash: receipt.receipt_hash }); refusals++;
    }
  }
  let admissions = 0;
  for (const [store, ledger] of Object.entries(stores)) {
    admissions += verifyLedger(ledger, input);
    for (const receipt of ledger.receipts) check(receiptOwners.has(`${store}/${receipt.receipt_id}`), 'Unattributed persisted receipt');
  }
  same(arrivals.length, planned.arrivals);
  same(find('receiver', 'arrival').map(e => e.data), arrivals, 'Receiver transcript differs from SQLite bytes');
  for (const [index, arrival] of arrivals.entries()) {
    same(arrival.id, index + 1);
    const w = workers.find(w => w.id === arrival.attempt_id); check(w, 'Uncorrelated arrival');
    same(arrival, { id: index + 1, attempt_id: w.id, method: input.request.method, path: '/publish' + input.request.path,
      task_id: input.request.task_id, principal_id: input.request.principal_id,
      body_hex: Buffer.from(input.request.body).toString('hex'), body_sha256: sha(input.request.body) }, 'Receiver bytes or identity mismatch');
    const receive = one('receiver', 'arrival', d => d.id === arrival.id);
    before(one(w.id, 'committed'), command(w.id, 'dispatch'), receive);
    const release = one('controller', 'ack_release', d => d.arrival_id === arrival.id); before(receive, release);
    if (w.terminal === 'completed') { before(release, one(w.id, 'result')); same(w.result.delivery, { arrival_id: arrival.id, body_sha256: arrival.body_sha256 }); }
    else before(receive, one('controller', 'kill', d => d.worker === w.id), one('controller', 'exit', d => d.worker === w.id), release);
  }
  same(new Set(arrivals.map(a => a.attempt_id)).size, arrivals.length, 'Duplicate arrivals');
  same(find('controller', 'command', d => d.command === 'dispatch').length, arrivals.length, 'Dispatch not reconciled to capture');
  if (planned.killed) {
    check(crash, 'Missing crash-state ledger'); verifyLedger(crash, input);
    const expected = ['kill-before-consume', 'revoke-before-replacement-read'].includes(id) ? [] : stores.a.receipts.slice(0, 1);
    same(crash.receipts, expected, 'Crash checkpoint differs from final ledger prefix');
    before(one('controller', 'exit', d => d.worker === 'w0'), one('w1', 'ready'));
  } else same(crash, null);
  const revoked = find('controller', 'revoked');
  if (['revoke-before-replacement-read', 'post-commit-revocation-before-dispatch'].includes(id)) {
    const event = one('controller', 'revoked');
    for (const field of FIELDS) same(event.data[field], binding[field]);
    same(event.data.authorized, false); same(event.data.proof_revocation_status, 'revoked');
    same(event.data.observation, 'independent_postgres_select'); same(event.data.binding_valid, true); same(event.data.status, 'running');
    if (id === 'post-commit-revocation-before-dispatch') before(one('w0', 'committed'), event, command('w0', 'dispatch'));
    else before(one('controller', 'exit', d => d.worker === 'w0'), event, one('w1', 'ready'));
  } else same(revoked.length, 0);
  for (const [key, actual] of Object.entries({ admissions, refusals, killed })) same(actual, planned[key], `${id}/${key} differs from frozen expectation`);
  return { id, classification: planned.classification, admissions, refusals, killed, completed_workers: completed,
    arrivals: arrivals.length, acknowledged: workers.filter(w => w.result?.delivery).length,
    admission_without_arrival: admissions - arrivals.length,
    protection_claim: !planned.classification.startsWith('unprotected_') };
}

function databaseCopy(path, tables, read) {
  const directory = mkdtempSync(join(tmpdir(), 'zerogate-offline-'));
  let db;
  try {
    for (const suffix of ['', '-wal']) {
      if (suffix && !existsSync(path + suffix)) continue;
      const stat = lstatSync(path + suffix);
      check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32 * 1024 * 1024, 'Unsafe SQLite artifact');
      copyFileSync(path + suffix, join(directory, 'copy.sqlite') + suffix);
    }
    check(readFileSync(path).subarray(0, 16).equals(Buffer.from('SQLite format 3\0')), 'Invalid SQLite header');
    // Recovery can write WAL/SHM even with readOnly. Only the disposable copy is opened.
    db = new DatabaseSync(join(directory, 'copy.sqlite'), { enableLoadExtension: false });
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON; BEGIN');
    same(db.prepare("SELECT name,type FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => ({ ...x })),
      tables.map(name => ({ name, type: 'table' })), 'Unexpected SQLite schema');
    same(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    same(db.prepare('PRAGMA foreign_key_check').all(), []);
    return read(db);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
}

export function readGate(path) {
  return databaseCopy(path, ['aggregate_quotas', 'consumed_nonces', 'gate_metadata', 'pass_usage', 'receipts'], db => {
    same(db.prepare('PRAGMA user_version').get().user_version, 1);
    const meta = db.prepare('SELECT * FROM gate_metadata').all();
    same(meta.length, 1); same(meta[0].singleton, 1); same(meta[0].schema_version, 'zerogate.durable_gate.v1');
    return { snapshot: JSON.parse(meta[0].snapshot_json),
      receipts: db.prepare('SELECT * FROM receipts ORDER BY receipt_id').all().map(row => {
        const receipt = JSON.parse(row.receipt_json);
        same(row.receipt_id, receipt.receipt_id); same(row.decision, receipt.decision); return receipt;
      }),
      consumed_nonces: db.prepare('SELECT * FROM consumed_nonces ORDER BY receipt_id').all().map(x => ({ ...x })),
      pass_usage: db.prepare('SELECT * FROM pass_usage ORDER BY issuer_id,workspace_id,pass_id').all().map(x => ({ ...x })),
      aggregate_quotas: db.prepare('SELECT * FROM aggregate_quotas ORDER BY aggregate_key').all().map(x => ({ ...x })) };
  });
}

export function readArrivals(path) {
  return databaseCopy(path, ['arrivals'], db => db.prepare('SELECT * FROM arrivals ORDER BY id').all().map(row => {
    check(row.body instanceof Uint8Array, 'Receiver body must be persisted bytes');
    const { body, ...fields } = row;
    return { ...fields, body_hex: Buffer.from(body).toString('hex'), body_sha256: sha(body) };
  }));
}

export function loadCase(directory, id) {
  const planned = PROTOCOL.cases.find(x => x.id === id); check(planned, 'Unknown case');
  return { id, input: json(join(directory, 'input.json')), workers: json(join(directory, 'workers.json')),
    events: readFileSync(join(directory, 'events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)),
    stores: Object.fromEntries((planned.stores === 2 ? ['a', 'b'] : ['a']).map(name => [name, readGate(join(directory, `store-${name}.sqlite`))])),
    arrivals: readArrivals(join(directory, 'receiver.sqlite')),
    crash: planned.killed ? readGate(join(directory, 'crash-store.sqlite')) : null };
}

function verifyArtifact(directory, kind) {
  directory = resolve(directory);
  const files = filesUnder(directory);
  same(json(join(directory, 'protocol.json')), PROTOCOL, 'Frozen protocol changed');
  const run = json(join(directory, 'run.json'));
  same(run.kind, kind, kind === 'measured' ? 'Require actual measured provenance, not unit fixtures' : 'Require explicitly unit-only fixture provenance');
  same(run.status, 'complete', 'Run did not complete');
  same(run.schema, 'zerogate.process-study.run.v1');
  same(run.authority_kind, PROTOCOL.authority);
  same(run.cases, PROTOCOL.cases.map(x => x.id), 'Missing/duplicate case inventory');
  check(Number.isFinite(Date.parse(run.started_at)) && Date.parse(run.finished_at) >= Date.parse(run.started_at), 'Invalid run times');
  const expectedFiles = ['checksums.json', 'protocol.json', 'run.json', 'source-manifest.json', 'summary.json'];
  for (const spec of PROTOCOL.cases) {
    for (const name of ['input.json', 'events.jsonl', 'workers.json', 'receiver.sqlite', 'store-a.sqlite',
      ...(spec.stores === 2 ? ['store-b.sqlite'] : []), ...(spec.killed ? ['crash-store.sqlite'] : [])]) {
      expectedFiles.push(spec.id + '/' + name);
    }
    if (spec.killed && files.includes(spec.id + '/crash-store.sqlite-wal')) expectedFiles.push(spec.id + '/crash-store.sqlite-wal');
  }
  same(files.sort(), expectedFiles.sort(), 'Missing or unexpected export file');
  same(json(join(directory, 'checksums.json')), checksums(directory), 'Artifact checksums changed');
  const source = json(join(directory, 'source-manifest.json'));
  check(Object.keys(source).length > 0 && Object.entries(source).every(([path, digest]) =>
    !path.startsWith('/') && !path.split('/').includes('..') && /^[a-f0-9]{64}$/.test(digest)), 'Invalid source identity');
  for (const required of ['scripts/zerogate-process-study/protocol.json', 'scripts/zerogate-process-study/study.mjs',
    'scripts/zerogate-process-study/worker.mjs', 'runtime-adapters/zerogate/live-authority.mjs',
    'scripts/zerogate-revalidation/durable-gate.mjs', 'scripts/egress-v2/studio-authority.mjs']) check(source[required], 'Missing measured source identity');
  const cases = PROTOCOL.cases.map(spec => {
    const evidence = loadCase(join(directory, spec.id), spec.id);
    same(evidence.input.run_id, run.run_id); return verifyCase(evidence);
  });
  const summary = summarizeCases(cases);
  same(json(join(directory, 'summary.json')), summary, 'Summary differs from reconstructed observations');
  return { verified: true, measurement: kind === 'measured', run_id: run.run_id, summary,
    limitation: 'Consistency of retained lab observations, not capture attestation, global one-use authority or exactly-once effects.' };
}

export const verifyStudy = directory => verifyArtifact(directory, 'measured');
// This entry point cannot label constructed verifier fixtures as measurements.
export const verifyUnitArtifact = directory => verifyArtifact(directory, 'unit_fixture_not_measurement');

export const PUBLIC_SOURCE_FILES = [
  'scripts/zerogate-process-study/verify.mjs', 'scripts/zerogate-process-study/evidence.mjs',
  'scripts/zerogate-process-study/protocol.json', 'scripts/egress-v2/verify-crypto.mjs',
  'scripts/zerogate-process-study/mutations.mjs',
];
export const PUBLIC_IDENTITY_FILES = [...PUBLIC_SOURCE_FILES,
  'scripts/zerogate-process-study/study.mjs', 'scripts/zerogate-process-study/worker.mjs',
  'scripts/zerogate-process-study/process.mjs', 'scripts/zerogate-process-study/prerequisites.mjs',
  'runtime-adapters/zerogate/live-authority.mjs', 'scripts/zerogate-revalidation/durable-gate.mjs',
  'scripts/egress-v2/studio-authority.mjs', 'scripts/egress-v2/studio-bootstrap.mjs',
];
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
function sealed(value, keys) {
  same(Object.keys(value).sort(), Object.keys(pick(value, keys)).sort(), 'Unexpected field outside public allowlist');
  return value;
}
function timestamp(value) {
  check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)), 'Invalid public timestamp');
}
const CHECK_FIELDS = ['mode', 'check_id', 'binding', 'observed_at', 'lookup_ms', 'timeout_ms', 'max_admission_delay_ms'];
function publicCheck(value, committed = false) {
  sealed(value, [...CHECK_FIELDS, ...(committed ? ['admission_delay_ms'] : [])]);
  check(/^[a-f0-9-]{36}$/.test(value.check_id), 'Invalid public check ID'); timestamp(value.observed_at);
  for (const key of ['lookup_ms', 'timeout_ms', 'max_admission_delay_ms', ...(committed ? ['admission_delay_ms'] : [])]) {
    check(Number.isFinite(value[key]) && value[key] >= 0, 'Invalid public timing');
  }
  return value;
}
function inspectionProjection(value, kind) {
  const receipt = value.proof_bundle.approval_receipts[0];
  sealed(receipt, ['actor_id', 'actor_type', 'decision', 'decided_at', 'workflow_id', 'workflow_state',
    'workflow_label', 'receipt_ref', 'source', 'action_id', 'canonical_fingerprint', 'policy_id',
    'approval_binding', 'approval_scope', 'receipt_hash']);
  const real = kind === 'measured';
  same(receipt.actor_id, real ? 'egress_lab_trusted_controller' : 'unit-reviewer');
  const optional = { workflow_id: `wf_${value.action_id}`, workflow_state: 'approved',
    workflow_label: 'workspace_manual_approval', receipt_ref: `apr_${value.action_id}_approved`,
    source: 'workspace', policy_id: 'osuite.policy_runtime.v1' };
  for (const [key, expected] of Object.entries(optional)) if (real || Object.hasOwn(receipt, key)) same(receipt[key], expected);
  if (real || Object.hasOwn(receipt, 'decided_at')) timestamp(receipt.decided_at);
  return { ...pick(value, [...FIELDS, 'status', 'proof_revocation_status', 'authorized', 'binding_valid', 'observation']),
    proof_bundle: { approval_receipts: [receipt] } };
}

// Export logical evidence, never raw database pages. Signed/hash-bound objects
// are retained exactly or refused; no signature is repaired during redaction.
export function publicRecord(record, kind) {
  check(['measured', 'unit_fixture_not_measurement'].includes(kind), 'Invalid public evidence kind');
  verifyCase(record);
  const input = record.input, p = input.pass;
  same(input.key_id, 'process-study-key');
  same(input.public_key_pem, createPublicKey(input.public_key_pem).export({ type: 'spki', format: 'pem' }), 'Only canonical PUBLIC keys may be exported');
  sealed(input.envelope, ['algorithm', 'key_id', 'pass_hash', 'signature_b64']);
  for (const time of Object.values(p.validity)) timestamp(time);
  same(p, { schema_version: 'osuite.action_pass.v1', pass_id: p.pass_id, issuer: p.issuer, holder: p.holder,
    authority: { requested_ref: null, narrowing_rule: 'runtime_may_narrow_never_widen', granted: p.authority.granted },
    action_binding: p.action_binding, policy_binding: { policy_id: null, policy_version: null, policy_digest: PROTOCOL.snapshot.policyDigest },
    state_binding: { state_version: null, state_digest: PROTOCOL.snapshot.stateDigest, predicates: {} },
    revocation_binding: { epoch: PROTOCOL.snapshot.revocationEpoch, digest: null }, budget: p.budget,
    validity: pick(p.validity, ['issued_at', 'not_before', 'expires_at']), nonce: p.nonce, risk: { class: 'low', score: 20 },
    commit_profile: { lane: 'fast', local_only: true, remote_verifier_required: false, evidence_mode: 'receipt_first' },
    evidence_profile: { synchronous_receipt: true, asynchronous_proof_enrichment: true, receipt_sink: 'local_append_only_buffer', verifier_profile: null },
    privacy_profile: { material_class: 'boundary_metadata', disclosure: 'minimized', fast_lane_requires_minimized: true },
    pass_hash: p.pass_hash }, 'Signed pass differs from public allowlist');
  const result = value => value === null ? null : pick(value, ['decision', 'reason', 'receipt_id', 'receipt_hash', 'delivery']);
  const ledger = store => {
    if (store === null) return null;
    for (const receipt of store.receipts) {
      sealed(receipt, ['schema_version', 'pass_id', 'pass_hash', 'action_fingerprint', 'lane', 'decision', 'reason',
        'observed_at', 'sequence_number', 'receipt_id', 'issuer_id', 'workspace_id', 'nonce', 'key_id',
        'signature_verified', 'requested_units', 'aggregate_key', 'snapshot', 'authority_check', 'receipt_hash']);
      timestamp(receipt.observed_at);
      if (receipt.authority_check) {
        publicCheck(receipt.authority_check, true);
        same(receipt.authority_check.binding, pick(input.approval, FIELDS), 'Public receipt binding changed');
      }
    }
    return pick(store, ['snapshot', 'receipts', 'consumed_nonces', 'pass_usage', 'aggregate_quotas']);
  };
  const events = record.events.map(event => {
    let data;
    if (event.type === 'command') check(['evaluate', 'dispatch'].includes(event.data.command)
      && record.workers.some(w => w.id === event.data.worker), 'Unknown command outside public allowlist');
    if (event.type === 'read') data = { inspection: inspectionProjection(event.data.inspection, kind),
      check: event.data.check.authorized ? { authorized: true, evidence: publicCheck(event.data.check.evidence) } : event.data.check };
    else if (event.type === 'revoked') data = inspectionProjection(event.data, kind);
    else if (event.type === 'result') data = result(event.data);
    else {
      const fields = { command: ['worker', 'command'], kill: ['worker', 'signal'], exit: ['worker', 'code', 'signal'],
        receiver_exit: ['pid', 'code', 'signal'], ack_release: ['arrival_id'], ready: ['pid', 'host', 'port'],
        locked: [], committed: ['receipt_id', 'receipt_hash'], arrival: ['id', 'attempt_id', 'method', 'path', 'task_id', 'principal_id', 'body_hex', 'body_sha256'] };
      data = pick(event.data, event.type === 'ready' && event.actor !== 'receiver' ? [] : fields[event.type]);
    }
    if (kind === 'measured') check(Object.hasOwn(event, 'observed_at') && Object.hasOwn(event, 'controller_monotonic_ms'), 'Missing captured event timing');
    if (Object.hasOwn(event, 'observed_at')) timestamp(event.observed_at);
    if (Object.hasOwn(event, 'controller_monotonic_ms')) check(Number.isFinite(event.controller_monotonic_ms) && event.controller_monotonic_ms >= 0, 'Invalid controller time');
    return { ...pick(event, ['seq', 'actor', 'type', 'observed_at', 'controller_monotonic_ms']), data };
  });
  const projected = { id: record.id,
    input: { ...pick(input, ['run_id', 'case_id', 'request', 'mapping', 'pass', 'envelope', 'key_id', 'public_key_pem', 'snapshot']),
      approval: inspectionProjection(input.approval, kind) }, events,
    workers: record.workers.map(w => ({ ...pick(w, ['id', 'store', 'pid', 'terminal', 'code', 'signal']), result: result(w.result) })),
    stores: Object.fromEntries(Object.entries(record.stores).map(([name, store]) => [name, ledger(store)])),
    arrivals: record.arrivals, crash: ledger(record.crash) };
  check(!/-----BEGIN [^-]*PRIVATE KEY-----|postgres(?:ql)?:\/\/|rediss?:\/\/|DATABASE_URL/i.test(JSON.stringify(projected)), 'Credential-like public material refused');
  verifyCase(projected);
  return projected;
}

export function publicRun(run) {
  const projected = pick(run, ['schema', 'kind', 'status', 'run_id', 'authority_kind', 'started_at', 'finished_at', 'cases']);
  timestamp(run.started_at); timestamp(run.finished_at);
  if (run.environment) {
    const env = run.environment;
    check(['darwin', 'linux', 'win32'].includes(env.platform) && ['arm64', 'x64'].includes(env.arch)
      && /^v\d+\.\d+\.\d+$/.test(env.node) && Number.isSafeInteger(env.controller_pid) && env.controller_pid > 0, 'Invalid recorded environment');
    projected.environment = pick(env, ['platform', 'arch', 'node', 'controller_pid']);
  } else check(run.kind === 'unit_fixture_not_measurement', 'Missing actual host metadata');
  return projected;
}

function verifyPublicArtifact(directory, kind) {
  const files = ['checksums.json', 'protocol.json', 'run.json', 'source-manifest.json', 'summary.json', 'export.json',
    ...PROTOCOL.cases.map(spec => spec.id + '/record.json')];
  same(filesUnder(directory).sort(), files.sort(), 'Unexpected or missing public export file');
  same(json(join(directory, 'checksums.json')), checksums(directory));
  same(json(join(directory, 'protocol.json')), PROTOCOL);
  const run = json(join(directory, 'run.json'));
  same(run.kind, kind, 'Require matching measured/unit provenance'); same(run.status, 'complete');
  same(run.schema, 'zerogate.process-study.run.v1'); same(run.authority_kind, PROTOCOL.authority);
  same(run.cases, PROTOCOL.cases.map(spec => spec.id)); same(run, publicRun(run));
  check(Date.parse(run.finished_at) >= Date.parse(run.started_at), 'Run times reversed');
  const exported = json(join(directory, 'export.json'));
  same(exported, { schema: 'zerogate.process-study.public.v1', representation: 'sanitized_logical_records',
    raw_checksums_sha256: exported.raw_checksums_sha256, independent_execution_verified: false,
    raw_sqlite_exported: false, publication_authorized: false });
  check(/^[a-f0-9]{64}$/.test(exported.raw_checksums_sha256), 'Invalid private evidence commitment');
  const sources = json(join(directory, 'source-manifest.json'));
  same(Object.keys(sources).sort(), [...PUBLIC_IDENTITY_FILES].sort());
  check(Object.values(sources).every(digest => /^[a-f0-9]{64}$/.test(digest)), 'Invalid source digest');
  const cases = PROTOCOL.cases.map(spec => {
    const record = json(join(directory, spec.id, 'record.json'));
    same(record.id, spec.id); same(record.input.run_id, run.run_id);
    same(record, publicRecord(record, kind), 'Unexpected public data fields');
    return verifyCase(record);
  });
  const summary = summarizeCases(cases); same(json(join(directory, 'summary.json')), summary);
  return { verified: true, measurement: kind === 'measured', representation: exported.representation,
    independent_execution_verified: false, run_id: run.run_id, summary,
    limitation: 'Offline consistency of sanitized claimed observations, not independent execution, capture completeness or provenance attestation.' };
}
export const verifyPublicStudy = directory => verifyPublicArtifact(directory, 'measured');
export const verifyUnitPublicArtifact = directory => verifyPublicArtifact(directory, 'unit_fixture_not_measurement');

export function summarizeCases(cases) {
  return { schema: 'zerogate.process-study.summary.v1', cases,
    totals: Object.fromEntries(['admissions', 'refusals', 'killed', 'arrivals', 'acknowledged', 'admission_without_arrival']
      .map(key => [key, cases.reduce((sum, row) => sum + row[key], 0)])),
    unknown_runs: 0, negative_controls_are_protected: false, exactly_once_claim: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const publicMode = process.argv[2] === '--public';
    check(process.argv.length === (publicMode ? 4 : 3), 'Usage: node verify.mjs [--public] <artifact-directory>');
    process.stdout.write(JSON.stringify(publicMode ? verifyPublicStudy(process.argv[3]) : verifyStudy(process.argv[2]), null, 2) + '\n');
  } catch (error) { process.stderr.write(`Verification failed: ${error.message}\n`); process.exitCode = 1; }
}
