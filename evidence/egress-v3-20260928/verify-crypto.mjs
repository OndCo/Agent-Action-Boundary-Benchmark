import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { verifyBundle } from './lib/verify-crypto-core.mjs';

export const MODES = Object.freeze(['transport', 'network', 'launch', 'application', 'osuite_slow', 'osuite_fast']);
export const EXPECTED_MAIN = Object.freeze({ bundles: 2340, passes: 2280, receipts: 640, approvals: 780,
  legacy_authority_metadata_warnings: 0 });
const osuite = mode => mode === 'osuite_slow' || mode === 'osuite_fast';
const empty = () => ({ bundles: 0, passes: 0, receipts: 0, approvals: 0,
  legacy_authority_metadata_warnings: 0, attempt_receipts_bound: 0 });
function add(total, counts) { for (const key of Object.keys(total)) total[key] += counts[key]; }

function bindRequest(attempt, receipt, entries) {
  const matching = entries.filter(entry => entry.pass?.pass_id === receipt.pass_id && entry.pass?.pass_hash === receipt.pass_hash);
  assert.equal(matching.length, 1, 'Receipt does not identify one signed pass');
  const entry = matching[0], mapping = entry.mapping, request = attempt.request;
  assert.equal(attempt.decision, receipt.decision, 'Attempt/receipt decision mismatch');
  assert.deepEqual(attempt.mapping, mapping, 'Attempt mapping differs from the receipt-bound entry');
  assert.equal(mapping.status, 'complete', 'Incomplete receipt-bound mapping');
  assert.equal(receipt.action_fingerprint, mapping.fingerprint, 'Receipt action fingerprint mismatch');
  assert.equal(entry.pass.action_binding?.allowed_fingerprint, mapping.fingerprint, 'Signed pass action binding mismatch');
  assert.ok(request && ['http', 'dns'].includes(request.kind), 'Missing supported attempt request');
  for (const field of ['service', 'task_id', 'principal_id']) assert.ok(typeof request[field] === 'string' && request[field], `Missing request ${field}`);
  const common = ['kind', 'service', 'task_id', 'principal_id', 'runtime'];
  const allowed = [...common, ...(request.kind === 'http' ? ['method', 'path', 'body'] : ['qname', 'qtype'])];
  assert.ok(Object.keys(request).every(key => allowed.includes(key)), 'Unknown request field outside frozen mapping');
  let wire, details;
  if (request.kind === 'http') {
    assert.ok(['cache', 'origin', 'packages', 'publish'].includes(request.service)
      && ['GET', 'POST', 'PUT', 'DELETE'].includes(request.method) && typeof request.path === 'string'
      && typeof request.body === 'string', 'Invalid receipt-bound HTTP request');
    wire = createHash('sha256').update(request.body, 'utf8').digest('hex');
    details = { method: request.method, path: request.path, body_sha256: wire, body_bytes: Buffer.byteLength(request.body, 'utf8') };
  } else {
    assert.ok(request.service === 'dns' && typeof request.qname === 'string' && ['A', 'TXT', 'NS'].includes(request.qtype), 'Invalid receipt-bound DNS request');
    wire = createHash('sha256').update(request.qname + '\0' + request.qtype, 'utf8').digest('hex');
    details = { qname: request.qname, qtype: request.qtype };
  }
  assert.equal(mapping.wire_sha256, wire, 'Attempt bytes differ from receipt-bound wire hash');
  assert.deepEqual(mapping.action.metadata, { mapper_version: 'egress-v2.action-evidence.v1', kind: request.kind,
    service: request.service, destination: request.service + '.lab.test', ...details, wire_sha256: wire,
    task_id: request.task_id, principal_id: request.principal_id }, 'Attempt request differs from receipt-bound action metadata');
}

export function readRows(path) {
  const text = gunzipSync(readFileSync(path), { maxOutputLength: 512 * 1024 * 1024 }).toString('utf8');
  const lines = text.trimEnd().split('\n');
  assert.ok(text.length && lines.every(line => line.trim()), `Empty JSONL record in ${path}`);
  return lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Invalid JSON in ${path}:${index + 1}`); }
  });
}

export function verifyRow(row, { mode, strict = false } = {}) {
  assert.ok(MODES.includes(mode), 'Unknown cohort mode');
  assert.equal(row.record?.mode ?? row.result?.mode, mode, 'Row mode differs from its cohort');
  const broker = row.broker, gate = broker?.gate;
  assert.ok(gate && Array.isArray(gate.entries), 'Missing gate bundle/entries');
  assert.equal(gate.mode, mode, 'Gate mode differs from its cohort');
  assert.ok(Array.isArray(broker.attempts), 'Missing broker attempts');
  const receipts = gate.audit?.receipts ?? [];
  assert.ok(Array.isArray(receipts), 'Invalid gate audit receipts');
  const counts = verifyBundle(gate, { requireLiveAuthority: strict });
  const auditIds = new Set();
  for (const receipt of receipts) {
    const id = receipt.receipt_id ?? receipt.receipt_hash;
    assert.ok(id !== undefined && !auditIds.has(id), 'Missing/duplicate audit receipt identity'); auditIds.add(id);
  }
  let bound = 0;
  const usedReceipts = new Set();
  for (const attempt of broker.attempts) {
    assert.ok(attempt && typeof attempt === 'object', 'Invalid broker attempt');
    if (osuite(mode) && attempt.decision === 'execute') assert.ok(attempt.receipt, 'Executing OSuite attempt is missing its receipt');
    if (attempt.receipt === undefined || attempt.receipt === null) continue;
    const receipt = attempt.receipt;
    assert.ok(receipt && typeof receipt === 'object', 'Invalid attempt receipt');
    const matches = receipts.filter(item => item.receipt_id === receipt.receipt_id && item.receipt_hash === receipt.receipt_hash);
    assert.equal(matches.length, 1, 'Attempt receipt is not uniquely present in the gate audit');
    assert.deepEqual(receipt, matches[0], 'Attempt receipt differs from the hashed gate receipt');
    assert.ok(!usedReceipts.has(matches[0]), 'An audited receipt was reused by multiple attempts');
    usedReceipts.add(matches[0]); bindRequest(attempt, receipt, gate.entries);
    bound++;
  }
  return { bundles: 1, ...counts, attempt_receipts_bound: bound };
}

function cohort(rows, { mode, strict = false }) {
  const totals = empty(), byMode = {};
  for (const [index, row] of rows.entries()) {
    const current = mode ?? row.record?.mode ?? row.result?.mode;
    try {
      const counts = verifyRow(row, { mode: current, strict });
      add(totals, counts); byMode[current] ??= empty(); add(byMode[current], counts);
    } catch (error) { throw new Error(`Row ${index + 1} (${current}): ${error.message}`, { cause: error }); }
  }
  return { ...totals, rows: rows.length, by_mode: byMode, strict_live_authority_required: strict };
}

// Accept the package root or the data/measured path used by verify.py. Every
// input is read-only; this module neither starts a service nor evaluates source
// supplied inside captured evidence.
export function verifyEvidence(root = fileURLToPath(new URL('.', import.meta.url))) {
  root = resolve(root);
  if (basename(root) === 'measured' && basename(dirname(root)) === 'data') root = resolve(root, '../..');
  const main = empty(), byMode = {}, indices = new Set(), sources = new Set();
  for (const mode of MODES) {
    const rows = readRows(join(root, 'data/measured', mode + '.jsonl.gz'));
    assert.equal(rows.length, 390, `${mode}: expected 390 rows`);
    for (const row of rows) {
      assert.ok(Number.isInteger(row.index) && row.index >= 0 && row.index < EXPECTED_MAIN.bundles
        && !indices.has(row.index), 'Missing/duplicate/out-of-range main record index');
      assert.ok(typeof row.source_id === 'string' && row.source_id.length && !sources.has(row.source_id), 'Missing/duplicate source ID');
      indices.add(row.index); sources.add(row.source_id);
    }
    byMode[mode] = cohort(rows, { mode, strict: osuite(mode) }); add(main, byMode[mode]);
  }
  for (const [key, expected] of Object.entries(EXPECTED_MAIN)) assert.equal(main[key], expected, `Main ${key} differs from frozen inventory`);
  const supplemental = {};
  for (const [name, expectedRows] of [['revocation-legacy', 10], ['revocation-current', 10], ['model', 24]]) {
    const rows = readRows(join(root, 'data', name + '.jsonl.gz'));
    assert.equal(rows.length, expectedRows, `${name}: missing supplemental records`);
    // Do not retrofit strict-live requirements onto legacy captures. The frozen
    // core still checks live evidence whenever a bundle itself declares it.
    supplemental[name] = cohort(rows, { strict: false });
  }
  return { crypto_consistent: true, main: { ...main, by_mode: byMode }, supplemental,
    independent_execution_verified: false,
    limitation: 'Offline signature/hash/receipt recomputation under exported lab keys, not independent execution, external issuer identity, truthful capture or proof of unobserved effects. Supplemental legacy metadata warnings are not main-cohort results.' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv.length <= 3, 'Usage: node verify-crypto.mjs [package-root|data/measured]');
    process.stdout.write(JSON.stringify(verifyEvidence(process.argv[2]), null, 2) + '\n');
  } catch (error) { process.stderr.write(`CRYPTO VERIFICATION FAILED: ${error.message}\n`); process.exitCode = 1; }
}
