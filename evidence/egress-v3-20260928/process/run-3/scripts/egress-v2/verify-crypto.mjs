import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, verify } from 'node:crypto';

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
const sha = value => createHash('sha256').update(canonical(value)).digest('hex');
function requireHash(value, field) {
  const { [field]: expected, ...payload } = value;
  if (sha(payload) !== expected) throw new Error(`${field} recomputation failed`);
}
export function verifyBundle(bundle, { requireLiveAuthority = false } = {}) {
  const key = createPublicKey(bundle.public_key_pem);
  let passes = 0, receipts = 0, approvals = 0;
  const osuite = ['osuite_slow', 'osuite_fast'].includes(bundle.mode);
  if (requireLiveAuthority && (!osuite || bundle.authority_freshness !== 'strict_live_v1')) throw new Error('Missing strict live authority mode');
  const metadataWarnings = !osuite && bundle.authority_kind !== 'conventional' ? 1 : 0;
  if (metadataWarnings && bundle.schema !== 'egress-v2-gate.v1') throw new Error('Authority metadata mismatch');
  for (const entry of bundle.entries) {
    if (sha(entry.mapping.action) !== entry.mapping.fingerprint) throw new Error('Action fingerprint mismatch');
    if (entry.pass) {
      requireHash(entry.pass, 'pass_hash');
      if (entry.envelope.pass_hash !== entry.pass.pass_hash
          || entry.envelope.key_id !== bundle.key_id
          || !verify(null, Buffer.from('osuite.zerogate.pass.v1\n' + entry.pass.pass_hash), key, Buffer.from(entry.envelope.signature_b64, 'base64'))) {
        throw new Error('Action Pass signature invalid');
      }
      passes++;
    }
    const approval = entry.approval;
    if (osuite) {
      if (!bundle.authority_kind.startsWith('actual_studio')) throw new Error('Missing Studio provenance');
      if (approval.fingerprint !== entry.mapping.fingerprint) throw new Error('Studio fingerprint mismatch');
      for (const receipt of approval.proof_bundle.approval_receipts || []) {
        requireHash(receipt, 'receipt_hash');
        if (receipt.action_id !== approval.action_id || receipt.canonical_fingerprint !== entry.mapping.fingerprint) {
          throw new Error('Studio receipt not bound to approved action');
        }
        approvals++;
      }
    }
  }
  const checks = new Set();
  for (const receipt of bundle.audit?.receipts || []) {
    requireHash(receipt, 'receipt_hash'); receipts++;
    if (receipt.decision !== 'execute' || !(requireLiveAuthority || bundle.authority_freshness === 'strict_live_v1')) continue;
    const entry = bundle.entries.find(entry => entry.pass?.pass_id === receipt.pass_id && entry.pass.pass_hash === receipt.pass_hash);
    const check = receipt.authority_check;
    const fields = ['action_id', 'org_id', 'task_id', 'principal_id', 'fingerprint', 'wire_sha256'];
    if (!entry || !check || check.mode !== 'strict_live' || typeof check.check_id !== 'string' || !check.check_id
      || checks.has(check.check_id) || !Number.isFinite(Date.parse(check.observed_at))
      || !fields.every(key => typeof check.binding?.[key] === 'string' && check.binding[key] === entry.approval[key])
      || check.binding.fingerprint !== entry.mapping.fingerprint || check.binding.wire_sha256 !== entry.mapping.wire_sha256
      || ![check.lookup_ms, check.admission_delay_ms, check.timeout_ms, check.max_admission_delay_ms].every(Number.isFinite)
      || check.lookup_ms < 0 || check.admission_delay_ms < 0 || check.timeout_ms <= 0 || check.timeout_ms > 2000
      || check.max_admission_delay_ms <= 0 || check.max_admission_delay_ms > 250
      || check.lookup_ms + check.admission_delay_ms >= check.timeout_ms
      || check.admission_delay_ms >= check.max_admission_delay_ms) throw new Error('Invalid live authority receipt evidence');
    checks.add(check.check_id);
  }
  return { passes, receipts, approvals, legacy_authority_metadata_warnings: metadataWarnings };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2]) {
  const totals = { bundles: 0, passes: 0, receipts: 0, approvals: 0, legacy_authority_metadata_warnings: 0 };
  for (const dir of readdirSync(process.argv[2], { withFileTypes: true }).filter(item => item.isDirectory() && item.name.startsWith('v2-'))) {
    const snapshot = JSON.parse(readFileSync(join(process.argv[2], dir.name, 'broker-snapshot.json')));
    const checked = verifyBundle(snapshot.gate);
    totals.bundles++; for (const field of Object.keys(checked)) totals[field] += checked[field];
  }
  process.stdout.write(JSON.stringify({ ...totals, crypto_consistent: true,
    limitation: 'Recomputes math under bundled lab issuer key, not external identity, truth of source capture, or unobserved effects.' }, null, 2) + '\n');
}
