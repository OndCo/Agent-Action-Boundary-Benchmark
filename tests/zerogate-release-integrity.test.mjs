import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = 'scripts/verify-zerogate-v0.1-release.mjs';
const reports = 'reports/zerogate-v0.1';

async function snapshot(t) {
  const directory = await mkdtemp(join(tmpdir(), 'zerogate-integrity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'scripts'));
  await cp(join(root, script), join(directory, script));
  for (const relative of [reports, 'docs/zerogate-v0.1', 'papers/zerogate-v0.1']) {
    await cp(join(root, relative), join(directory, relative), { recursive: true });
  }
  return directory;
}

async function mutate(directory, file, change) {
  const target = join(directory, reports, `${file}.json`);
  const data = JSON.parse(await readFile(target, 'utf8'));
  change(data);
  await writeFile(target, JSON.stringify(data));
}

function run(directory) {
  const result = spawnSync(process.execPath, [join(directory, script)], {
    cwd: tmpdir(), encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function rejects(result, reason) {
  assert.equal(result.status, 1, `Unexpected success:\n${result.stdout}`);
  assert.match(result.stderr, /ZeroGate v0\.1 release verification failed:/);
  assert.match(result.stderr, reason);
  assert.doesNotMatch(result.stdout, /verified|passed/i);
}

test('intact historical snapshot passes with explicit integrity-only limits', async (t) => {
  const result = run(await snapshot(t));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /integrity-only/i);
  assert.match(result.stdout, /360 stress.*528.*fixture/i);
  assert.match(result.stdout, /not.*(?:replay|re-execution)/i);
  assert.match(result.stdout, /preset.*not.*empirical/i);
  assert.match(result.stdout, /unavailable.*(?:weighted|weight)/i);
  assert.match(result.stdout, /2500.*(?:outputs|records).*700000/i);
});

for (const [file, size, label] of [
  ['fast-slow-benchmark', 360, /stress.*cases/i],
  ['multi-runtime-fixture', 528, /fixture.*cases/i],
]) {
  for (const [name, change] of [
    ['missing', (data) => { delete data.cases; }],
    ['empty', (data) => { data.cases = []; }],
    ['truncated', (data) => { data.cases.pop(); }],
    ['padded', (data) => { data.cases.push({ ...data.cases[0], id: 'extra' }); }],
  ]) {
    test(`${file} rejects ${name} cases despite unchanged summaries (${size} promised)`, async (t) => {
      const directory = await snapshot(t);
      await mutate(directory, file, change);
      rejects(run(directory), label);
    });
  }

  for (const [name, change, reason] of [
    ['duplicate IDs', (data) => { data.cases[1] = { ...data.cases[0] }; }, /duplicate.*id/i],
    ['blank ID', (data) => { data.cases[0].id = ' '; }, /id/i],
    ['missing output', (data) => { delete data.cases[0].observed_lane; }, /observed_lane/i],
    ['unknown lane', (data) => { data.cases[0].observed_lane = 'unknown'; }, /observed_lane/i],
    ['contradictory decision', (data) => { data.cases[0].decision = 'deny'; }, /decision/i],
    ['missing reason', (data) => { delete data.cases[0].reason; }, /reason/i],
    ['missing receipt hash', (data) => { delete data.cases[0].receipt_hash; }, /receipt_hash/i],
    ['malformed receipt hash', (data) => { data.cases[0].receipt_hash = 'not-a-hash'; }, /receipt_hash/i],
    ['null case', (data) => { data.cases[0] = null; }, /case/i],
    ['false lane summary', (data) => {
      const summary = data.stress_matrix_summary ?? data.summary;
      const counts = summary.lane_counts ?? summary.lane_distribution;
      counts.fast += 1;
    }, /lane/i],
  ]) {
    test(`${file} rejects ${name}`, async (t) => {
      const directory = await snapshot(t);
      await mutate(directory, file, change);
      rejects(run(directory), reason);
    });
  }
}

const mutations = [
  ['stress grid hole hidden by a new ID', 'fast-slow-benchmark', (data) => {
    data.cases[1] = { ...data.cases[0], id: 'replacement' };
  }, /id|duplicate|combination/i],
  ['stress match flag contradicts lanes', 'fast-slow-benchmark', (data) => {
    data.cases[0].matched_expectation = false;
  }, /matched_expectation/i],
  ['stress summary ignores changed outcome', 'fast-slow-benchmark', (data) => {
    Object.assign(data.cases[0], { observed_lane: 'slow', decision: 'review', matched_expectation: false });
  }, /stress.*(?:exact_lane_match|exact lane match)/i],
  ['stress receipt rate disagrees with outputs', 'fast-slow-benchmark', (data) => {
    data.stress_matrix_summary.receipt_persisted_before_commit_rate = 1;
  }, /receipt_persisted_before_commit_rate/i],
  ['stress malformed receipt flag', 'fast-slow-benchmark', (data) => {
    data.cases[0].receipt_complete = 'true';
  }, /receipt_complete/i],
  ['stress missing recorded timing', 'fast-slow-benchmark', (data) => {
    delete data.cases[0].local_commit_overhead_ms;
  }, /local_commit_overhead_ms/i],
  ['stress hidden partial commit', 'fast-slow-benchmark', (data) => {
    data.cases[0].receipt_persisted_before_commit = false;
  }, /partial_commit_without_receipt/i],
  ['stress split missing a case', 'fast-slow-benchmark', (data) => {
    data.dataset_audit.splits.reference.cases -= 1;
  }, /reference.*cases/i],
  ['weighted summary copies disagree', 'fast-slow-benchmark', (data) => {
    data.representative_mix_summary.lane_counts.fast -= 1;
  }, /representative|weighted/i],
  ['fixture grid hole hidden by a new ID', 'multi-runtime-fixture', (data) => {
    data.cases[1] = { ...data.cases[0], id: 'replacement' };
  }, /id|duplicate|combination/i],
  ['fixture mapping flag is not boolean', 'multi-runtime-fixture', (data) => {
    data.cases[0].mapping_matched = 'true';
  }, /mapping_matched/i],
  ['fixture missing raw-event reference', 'multi-runtime-fixture', (data) => {
    delete data.cases[0].raw_event_id;
  }, /raw_event_id/i],
  ['fixture missing mapping label', 'multi-runtime-fixture', (data) => {
    delete data.cases[0].expected_mapping;
  }, /expected_mapping/i],
  ['fixture mapping summary ignores a recorded mismatch', 'multi-runtime-fixture', (data) => {
    data.cases[0].mapping_matched = false;
  }, /runtime_to_action_mapping_accuracy/i],
  ['fixture authorization flag contradicts lanes', 'multi-runtime-fixture', (data) => {
    data.cases[0].authorization_matched = false;
  }, /authorization_matched/i],
  ['fixture per-runtime summary disagrees', 'multi-runtime-fixture', (data) => {
    data.summary.by_runtime.mcp_tool_call.cases -= 1;
  }, /by_runtime.*cases/i],
  ['fixture per-variant summary disagrees', 'multi-runtime-fixture', (data) => {
    data.summary.by_variant.equivalent_projection.mapping_matches -= 1;
  }, /by_variant.*mapping_matches/i],
  ['missing saved workflows', 'source-workflows', (data) => { data.files = []; }, /workflow.*files/i],
  ['duplicate saved workflow', 'source-workflows', (data) => { data.files[1] = data.files[0]; }, /duplicate.*workflow/i],
  ['missing workflow content', 'source-workflows', (data) => { delete data.files[0].text; }, /workflow.*text/i],
  ['missing labeling records', 'labeling-pack', (data) => { data.records = []; }, /labeling.*records/i],
  ['duplicate labeling ID', 'labeling-pack', (data) => { data.records[1] = data.records[0]; }, /duplicate.*id/i],
  ['missing public samples', 'public-runtime-corpus', (data) => { data.sample_records = []; }, /sample.*records/i],
  ['manifest stress count disagrees', 'release-manifest', (data) => {
    data.headline_metrics.adversarial_stress_cases -= 1;
  }, /manifest.*stress/i],
];

for (const [name, file, change, reason] of mutations) {
  test(`rejects ${name}`, async (t) => {
    const directory = await snapshot(t);
    await mutate(directory, file, change);
    rejects(run(directory), reason);
  });
}

for (const throughput of [undefined, 'not measured']) {
  test(`rejects invalid throughput even when manifest agrees (${throughput})`, async (t) => {
    const directory = await snapshot(t);
    await mutate(directory, 'load-study', (data) => {
      data.summary.throughput_ops_per_second = throughput;
    });
    await mutate(directory, 'release-manifest', (data) => {
      data.headline_metrics.concurrent_load_study_throughput_ops_per_second = throughput;
    });
    rejects(run(directory), /throughput/i);
  });
}

test('case order is not an integrity requirement', async (t) => {
  const directory = await snapshot(t);
  for (const file of ['fast-slow-benchmark', 'multi-runtime-fixture']) {
    await mutate(directory, file, (data) => { data.cases.reverse(); });
  }
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
});

test('missing required artifact still fails', async (t) => {
  const directory = await snapshot(t);
  await rm(join(directory, reports, 'load-study.md'));
  rejects(run(directory), /missing load-study\.md/i);
});

test('a directory cannot stand in for a required report file', async (t) => {
  const directory = await snapshot(t);
  const target = join(directory, reports, 'load-study.md');
  await rm(target);
  await mkdir(target);
  rejects(run(directory), /load-study\.md.*(?:regular )?file/i);
});

test('malformed JSON fails with an actionable artifact name', async (t) => {
  const directory = await snapshot(t);
  await writeFile(join(directory, reports, 'fast-slow-benchmark.json'), '{');
  rejects(run(directory), /invalid JSON.*fast-slow-benchmark\.json/i);
});
