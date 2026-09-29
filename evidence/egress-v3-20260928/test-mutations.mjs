import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const wrapper = await import('./verify-crypto.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const root = resolve(process.argv[2] || fileURLToPath(new URL('.', import.meta.url)));
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
const sha = value => createHash('sha256').update(canonical(value)).digest('hex');
function rehash(value, field) { const { [field]: ignored, ...payload } = value; value[field] = sha(payload); }

// Constructed unit evidence, not study observations. Nothing is written to disk.
function fixture(count = 1) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const entries = [], receipts = [], attempts = [];
  for (let index = 0; index < count; index++) {
  const request = { kind: 'http', service: 'publish', method: 'PUT', path: `/unit/${index}`, body: `unit-${index}`,
    task_id: 'unit-task', principal_id: 'unit-actor' };
  const wire = createHash('sha256').update(request.body).digest('hex');
  const action = { operation: 'http_put', subject: request.path, metadata: { mapper_version: 'egress-v2.action-evidence.v1',
    kind: 'http', service: 'publish', destination: 'publish.lab.test', method: 'PUT', path: request.path,
    body_sha256: wire, body_bytes: Buffer.byteLength(request.body), wire_sha256: wire,
    task_id: request.task_id, principal_id: request.principal_id } };
  const fingerprint = sha(action), keyId = 'unit-key';
  const pass = { pass_id: `unit-pass-${index}`, nonce: `unit-nonce-${index}`, action_binding: { allowed_fingerprint: fingerprint } };
  rehash(pass, 'pass_hash');
  const approvalReceipt = { action_id: `unit-action-${index}`, canonical_fingerprint: fingerprint, decision: 'allow' };
  rehash(approvalReceipt, 'receipt_hash');
  const approval = { action_id: approvalReceipt.action_id, org_id: 'unit-org', task_id: 'unit-task', principal_id: 'unit-actor',
    fingerprint, wire_sha256: wire, proof_bundle: { approval_receipts: [approvalReceipt] } };
  const receipt = { receipt_id: index + 1, decision: 'execute', reason: 'local_commit_satisfied', pass_id: pass.pass_id,
    pass_hash: pass.pass_hash, action_fingerprint: fingerprint, authority_check: { mode: 'strict_live', check_id: `unit-check-${index}`,
      binding: Object.fromEntries(['action_id', 'org_id', 'task_id', 'principal_id', 'fingerprint', 'wire_sha256'].map(key => [key, approval[key]])),
      observed_at: '2026-09-28T00:00:00.000Z', lookup_ms: 1, admission_delay_ms: 1, timeout_ms: 2000, max_admission_delay_ms: 250 } };
  rehash(receipt, 'receipt_hash');
  const mapping = { status: 'complete', action, fingerprint, wire_sha256: wire };
  entries.push({ mapping, pass, approval, envelope: { key_id: keyId, pass_hash: pass.pass_hash,
    signature_b64: sign(null, Buffer.from('osuite.zerogate.pass.v1\n' + pass.pass_hash), privateKey).toString('base64') } });
  receipts.push(receipt);
  attempts.push({ attempt_id: `unit-attempt-${index}`, decision: 'execute', request, mapping: structuredClone(mapping), receipt: structuredClone(receipt) });
  }
  const gate = { schema: 'egress-v2-gate.v2', mode: 'osuite_fast', authority_kind: 'actual_studio_unit_fixture',
    authority_freshness: 'strict_live_v1', key_id: 'unit-key', public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }),
    entries, audit: { receipts } };
  return { record: { mode: 'osuite_fast' }, broker: { gate, attempts } };
}
const verify = row => wrapper.verifyRow(row, { mode: 'osuite_fast', strict: true });

test('unit: signed baseline binds its attempt receipt to the gate audit', () => {
  assert.equal(typeof wrapper.verifyRow, 'function');
  assert.deepEqual(verify(fixture()), { bundles: 1, passes: 1, receipts: 1, approvals: 1,
    legacy_authority_metadata_warnings: 0, attempt_receipts_bound: 1 });
});

for (const [name, mutate] of [
  ['action fingerprint', row => { row.broker.gate.entries[0].mapping.action.subject = '/changed'; }],
  ['pass hash', row => { row.broker.gate.entries[0].pass.pass_hash = '0'.repeat(64); }],
  ['pass payload', row => { row.broker.gate.entries[0].pass.nonce = 'changed'; }],
  ['envelope hash', row => { row.broker.gate.entries[0].envelope.pass_hash = '0'.repeat(64); }],
  ['signature', row => { const envelope = row.broker.gate.entries[0].envelope;
    const bytes = Buffer.from(envelope.signature_b64, 'base64'); bytes[0] ^= 1; envelope.signature_b64 = bytes.toString('base64'); }],
  ['rehash without signing', row => { const entry = row.broker.gate.entries[0]; entry.pass.nonce = 'changed';
    rehash(entry.pass, 'pass_hash'); entry.envelope.pass_hash = entry.pass.pass_hash; }],
  ['rehash live binding', row => { const receipt = row.broker.gate.audit.receipts[0];
    receipt.authority_check.binding.action_id = 'other'; rehash(receipt, 'receipt_hash');
    row.broker.attempts[0].receipt = structuredClone(receipt); }],
  ['receipt hash', row => { row.broker.gate.audit.receipts[0].reason = 'changed'; }],
  ['approval receipt', row => { row.broker.gate.entries[0].approval.proof_bundle.approval_receipts[0].decision = 'deny'; }],
  ['attempt receipt only', row => { row.broker.attempts[0].receipt.reason = 'changed'; rehash(row.broker.attempts[0].receipt, 'receipt_hash'); }],
  ['missing audit receipt', row => { row.broker.gate.audit.receipts = []; }],
  ['duplicate audit receipt', row => { row.broker.gate.audit.receipts.push(structuredClone(row.broker.gate.audit.receipts[0])); }],
  ['main mode downgrade', row => { row.broker.gate.mode = 'application'; row.broker.gate.authority_kind = 'conventional'; }],
  ['missing broker attempts', row => { delete row.broker.attempts; }],
  ['missing executing OSuite receipt', row => { delete row.broker.attempts[0].receipt; }],
  ['missing attempt mapping', row => { delete row.broker.attempts[0].mapping; }],
  ['changed attempt body', row => { row.broker.attempts[0].request.body = 'other bytes'; }],
  ['changed attempt principal', row => { row.broker.attempts[0].request.principal_id = 'other actor'; }],
  ['stale live admission', row => { const receipt = row.broker.gate.audit.receipts[0];
    receipt.authority_check.admission_delay_ms = 250; rehash(receipt, 'receipt_hash');
    row.broker.attempts[0].receipt = structuredClone(receipt); }],
]) {
  test(`unit: rejects ${name} mutation without changing its source fixture`, () => {
    assert.equal(typeof wrapper.verifyRow, 'function');
    const original = fixture(), before = JSON.stringify(original), altered = structuredClone(original);
    mutate(altered); assert.throws(() => verify(altered)); assert.equal(JSON.stringify(original), before);
  });
}

test('unit: two valid receipts cannot be swapped between different requests', () => {
  const original = fixture(2); assert.equal(verify(original).attempt_receipts_bound, 2);
  const row = structuredClone(original);
  [row.broker.attempts[0].receipt, row.broker.attempts[1].receipt] = [row.broker.attempts[1].receipt, row.broker.attempts[0].receipt];
  assert.throws(() => verify(row));
  // Moving the mapping as well still cannot change the recorded request bytes.
  [row.broker.attempts[0].mapping, row.broker.attempts[1].mapping] = [row.broker.attempts[1].mapping, row.broker.attempts[0].mapping];
  assert.throws(() => verify(row));
});

test('unit: conventional executing attempts may legitimately omit gate receipts', () => {
  const row = fixture(); row.record.mode = 'application'; row.broker.gate.mode = 'application';
  row.broker.gate.authority_kind = 'conventional'; row.broker.gate.audit.receipts = [];
  delete row.broker.attempts[0].receipt;
  assert.equal(wrapper.verifyRow(row, { mode: 'application' }).attempt_receipts_bound, 0);
});

test('unit: supplemental legacy evidence remains labelled and is not accepted as strict main evidence', () => {
  assert.equal(typeof wrapper.verifyRow, 'function');
  const row = fixture(); row.broker.gate.schema = 'egress-v2-gate.v1'; delete row.broker.gate.authority_freshness;
  delete row.broker.gate.audit.receipts[0].authority_check; rehash(row.broker.gate.audit.receipts[0], 'receipt_hash');
  row.broker.attempts[0].receipt = structuredClone(row.broker.gate.audit.receipts[0]);
  assert.throws(() => verify(row));
  assert.equal(wrapper.verifyRow(row, { mode: 'osuite_fast', strict: false }).receipts, 1);
  row.record.mode = 'application'; row.broker.gate.mode = 'application';
  assert.equal(wrapper.verifyRow(row, { mode: 'application', strict: false }).legacy_authority_metadata_warnings, 1);
});

test('public data: recomputes all main and supplemental bundles without modifying exports', t => {
  assert.equal(typeof wrapper.verifyEvidence, 'function');
  const files = ['transport', 'network', 'launch', 'application', 'osuite_slow', 'osuite_fast']
    .map(mode => join(root, 'data/measured', mode + '.jsonl.gz'));
  files.push(...['revocation-current', 'revocation-legacy', 'model'].map(name => join(root, 'data', name + '.jsonl.gz')));
  const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const before = files.map(digest), result = wrapper.verifyEvidence(root);
  assert.deepEqual(Object.fromEntries(Object.keys(wrapper.EXPECTED_MAIN).map(key => [key, result.main[key]])),
    { bundles: 2340, passes: 2280, receipts: 640, approvals: 780, legacy_authority_metadata_warnings: 0 });
  assert.equal(result.supplemental['revocation-current'].bundles, 10);
  assert.equal(result.supplemental['revocation-legacy'].bundles, 10);
  assert.equal(result.supplemental.model.bundles, 24);
  assert.equal(result.independent_execution_verified, false);
  const cli = JSON.parse(execFileSync(process.execPath, ['verify-crypto.mjs', 'data/measured'], {
    cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  }));
  assert.deepEqual(cli, result);
  assert.deepEqual(files.map(digest), before);
  const compact = value => Object.fromEntries([...Object.keys(wrapper.EXPECTED_MAIN), 'attempt_receipts_bound'].map(key => [key, value[key]]));
  t.diagnostic(JSON.stringify({ main: compact(result.main),
    supplemental: Object.fromEntries(Object.entries(result.supplemental).map(([name, counts]) => [name, compact(counts)])) }));
});

for (const run of ['run-1', 'run-2', 'run-3']) {
  test(`process/${run}: all twelve public mutations are rejected`, t => {
    const script = `process/${run}/scripts/zerogate-process-study/mutations.mjs`;
    const data = `process/${run}/data`;
    const stdout = execFileSync(process.execPath, [script, '--public', data], {
      cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024,
    });
    const report = JSON.parse(stdout);
    assert.equal(report.measurement, true);
    assert.equal(report.rejected_mutations.length, 12);
    assert.equal(new Set(report.rejected_mutations).size, 12);
    assert.equal(report.original_evidence_unchanged, true);
    t.diagnostic(JSON.stringify({ run, ...report }));
  });
}
