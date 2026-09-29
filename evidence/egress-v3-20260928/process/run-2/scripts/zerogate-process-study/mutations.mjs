import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { verifyStudy, verifyPublicStudy } from './verify.mjs';
import { checksums, json } from './evidence.mjs';

const IDS = ['summary', 'worker_dropped', 'receiver_bytes', 'nonce', 'usage', 'receipt_binding',
  'kill_signal', 'revocation_order', 'separate_store', 'missing_case', 'provenance'];
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
    : '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';

export function verifyMutations(directory, verify = verifyStudy) {
  const original = verify(directory), before = checksums(directory), rejected = [];
  const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  for (const id of IDS) {
    const temporary = mkdtempSync(join(tmpdir(), 'zerogate-mutation-')), root = join(temporary, 'copy');
    try {
      cpSync(directory, root, { recursive: true });
      const casePath = join(root, 'shared-store-race');
      if (id === 'summary') {
        const path = join(root, 'summary.json'), value = json(path); value.totals.admissions++; write(path, value);
      } else if (id === 'worker_dropped') {
        const path = join(casePath, 'workers.json'), value = json(path); value.pop(); write(path, value);
      } else if (['receiver_bytes', 'nonce', 'usage', 'receipt_binding'].includes(id)) {
        const db = new DatabaseSync(join(casePath, id === 'receiver_bytes' ? 'receiver.sqlite' : 'store-a.sqlite'));
        try {
          if (id === 'receiver_bytes') db.exec("UPDATE arrivals SET body=X'00'");
          else if (id === 'nonce') db.exec("UPDATE consumed_nonces SET nonce='other'");
          else if (id === 'usage') db.exec('UPDATE pass_usage SET consumed_units=0');
          else {
            const row = db.prepare('SELECT receipt_id,receipt_json FROM receipts WHERE decision=?').get('execute');
            const receipt = JSON.parse(row.receipt_json); receipt.authority_check.binding.action_id = 'other';
            const { receipt_hash, ...payload } = receipt;
            receipt.receipt_hash = createHash('sha256').update(canonical(payload)).digest('hex');
            db.prepare('UPDATE receipts SET receipt_json=? WHERE receipt_id=?').run(JSON.stringify(receipt), row.receipt_id);
            const workersPath = join(casePath, 'workers.json'), workers = json(workersPath);
            const owner = workers.find(w => w.result?.decision === 'execute');
            owner.result.receipt_hash = receipt.receipt_hash; write(workersPath, workers);
            const eventsPath = join(casePath, 'events.jsonl');
            const events = readFileSync(eventsPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
            for (const event of events) if (event.actor === owner.id && ['committed', 'result'].includes(event.type)) event.data.receipt_hash = receipt.receipt_hash;
            writeFileSync(eventsPath, events.map(event => JSON.stringify(event)).join('\n') + '\n');
          }
        } finally { db.close(); }
      } else if (id === 'kill_signal') {
        const path = join(root, 'kill-after-commit-before-dispatch', 'workers.json'), value = json(path);
        value[0].signal = 'SIGTERM'; write(path, value);
      } else if (id === 'revocation_order') {
        const path = join(root, 'post-commit-revocation-before-dispatch', 'events.jsonl');
        const events = readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        const a = events.findIndex(e => e.type === 'revoked'), b = events.findIndex(e => e.type === 'committed');
        [events[a], events[b]] = [events[b], events[a]]; events.forEach((e, index) => { e.seq = index + 1; });
        writeFileSync(path, events.map(e => JSON.stringify(e)).join('\n') + '\n');
      } else if (id === 'separate_store') {
        const path = join(root, 'separate-store-negative-control', 'workers.json'), value = json(path);
        value[1].store = 'a'; write(path, value);
      } else if (id === 'missing_case') rmSync(join(root, 'kill-before-consume'), { recursive: true });
      else {
        const path = join(root, 'run.json'), value = json(path);
        value.kind = original.measurement ? 'unit_fixture_not_measurement' : 'measured'; write(path, value);
      }
      // Rehash every modified outer file. Semantic evidence, not this manifest,
      // must reject the altered claim.
      write(join(root, 'checksums.json'), checksums(root));
      assert.throws(() => verify(root), undefined, `Mutation incorrectly accepted: ${id}`);
      rejected.push(id);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  assert.deepEqual(checksums(directory), before, 'Original evidence changed');
  return { measurement: original.measurement, rejected_mutations: rejected, original_evidence_unchanged: true };
}

export function verifyPublicMutations(directory, verify = verifyPublicStudy) {
  const original = verify(directory), before = checksums(directory), rejected = [];
  for (const id of [...IDS, 'unexpected_private_field']) {
    const temporary = mkdtempSync(join(tmpdir(), 'zerogate-public-mutation-')), root = join(temporary, 'copy');
    const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
    try {
      cpSync(directory, root, { recursive: true });
      if (id === 'summary') {
        const path = join(root, 'summary.json'), value = json(path); value.totals.arrivals++; write(path, value);
      } else if (id === 'missing_case') rmSync(join(root, 'kill-before-consume'), { recursive: true });
      else if (id === 'provenance') {
        const path = join(root, 'run.json'), value = json(path);
        value.kind = original.measurement ? 'unit_fixture_not_measurement' : 'measured'; write(path, value);
      } else {
        const caseId = id === 'kill_signal' ? 'kill-after-commit-before-dispatch'
          : id === 'revocation_order' ? 'post-commit-revocation-before-dispatch'
            : id === 'separate_store' ? 'separate-store-negative-control' : 'shared-store-race';
        const path = join(root, caseId, 'record.json'), record = json(path);
        if (id === 'worker_dropped') record.workers.pop();
        else if (id === 'receiver_bytes') record.arrivals[0].body_hex = '00';
        else if (id === 'nonce') record.stores.a.consumed_nonces[0].nonce = 'other';
        else if (id === 'usage') record.stores.a.pass_usage[0].consumed_units = 0;
        else if (id === 'receipt_binding') {
          const receipt = record.stores.a.receipts.find(r => r.decision === 'execute');
          receipt.authority_check.binding.action_id = 'other';
          const { receipt_hash, ...payload } = receipt;
          receipt.receipt_hash = createHash('sha256').update(canonical(payload)).digest('hex');
          const owner = record.workers.find(w => w.result?.decision === 'execute');
          owner.result.receipt_hash = receipt.receipt_hash;
          for (const event of record.events) if (event.actor === owner.id && ['committed', 'result'].includes(event.type)) event.data.receipt_hash = receipt.receipt_hash;
        } else if (id === 'kill_signal') record.workers[0].signal = 'SIGTERM';
        else if (id === 'revocation_order') {
          const a = record.events.findIndex(e => e.type === 'revoked'), b = record.events.findIndex(e => e.type === 'committed');
          [record.events[a], record.events[b]] = [record.events[b], record.events[a]];
          record.events.forEach((event, index) => { event.seq = index + 1; });
        } else if (id === 'separate_store') record.workers[1].store = 'a';
        else record.input.approval.private_key = 'not-public';
        write(path, record);
      }
      write(join(root, 'checksums.json'), checksums(root));
      assert.throws(() => verify(root), undefined, `Public mutation incorrectly accepted: ${id}`); rejected.push(id);
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  assert.deepEqual(checksums(directory), before, 'Original public evidence changed');
  return { measurement: original.measurement, rejected_mutations: rejected, original_evidence_unchanged: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const publicMode = process.argv[2] === '--public';
    assert.equal(process.argv.length, publicMode ? 4 : 3, 'Usage: node mutations.mjs [--public] <artifact-directory>');
    process.stdout.write(JSON.stringify(publicMode ? verifyPublicMutations(resolve(process.argv[3]))
      : verifyMutations(resolve(process.argv[2])), null, 2) + '\n');
  } catch (error) { process.stderr.write(`Mutation verification failed: ${error.message}\n`); process.exitCode = 1; }
}
