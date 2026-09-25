import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../scripts/run-benchmark.mjs', import.meta.url));

function run(input) {
  const execution = spawnSync(process.execPath, [cli, '--input', input, '--strict'], {
    cwd: root, encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(execution.error);
  assert.equal(execution.signal, null);
  return execution;
}

for (const [name, contents] of [['empty', ''], ['whitespace-only', ' \n\t\r\n']]) {
  test(`strict benchmark rejects ${name} input before emitting metrics`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'boundary-metrics-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const input = join(directory, 'cases.jsonl');
    await writeFile(input, contents);
    const execution = run(input);
    assert.equal(execution.status, 1);
    assert.match(execution.stderr, /strict.*at least one case/i);
    assert.equal(execution.stdout, '');
  });
}

test('strict benchmark still fails on a nonempty mismatching case', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'boundary-metrics-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = await readFile(join(root, 'benchmarks/runtime-boundary-corpus.jsonl'), 'utf8');
  const row = JSON.parse(source.trim().split('\n')[0]);
  row.expected.control = row.expected.control === 'allow' ? 'block' : 'allow';
  const input = join(directory, 'cases.jsonl');
  await writeFile(input, JSON.stringify(row) + '\n');
  const execution = run(input);
  assert.equal(execution.status, 1);
  assert.match(execution.stdout, /0\/1 exact matches/);
});

test('strict benchmark still reproduces the nonempty 6000-record baseline', () => {
  const execution = run('benchmarks/runtime-boundary-corpus.jsonl');
  assert.equal(execution.status, 0, execution.stderr);
  assert.match(execution.stdout, /6000\/6000 exact matches/);
  assert.match(execution.stdout, /Boundary score: 100\/100/);
});
