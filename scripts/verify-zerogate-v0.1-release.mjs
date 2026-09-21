#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = path.join(rootDir, 'reports', 'zerogate-v0.1');

const requiredFiles = [
  'fast-slow-benchmark.json',
  'fast-slow-benchmark.md',
  'load-study.json',
  'load-study.md',
  'public-runtime-corpus.json',
  'public-runtime-corpus.md',
  'labeling-pack.json',
  'labeling-pack.md',
  'source-workflows.json',
  'multi-runtime-fixture.json',
  'multi-runtime-fixture.md',
  'live-studio-smoke.json',
  'live-studio-smoke.md',
  'release-manifest.json',
];

function fail(message) {
  console.error(`ZeroGate v0.1 release verification failed: ${message}`);
  process.exit(1);
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(releaseDir, relativePath), 'utf8');
  return JSON.parse(raw);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertAtLeast(actual, expected, label) {
  if (actual < expected) {
    fail(`${label}: expected >= ${expected}, got ${actual}`);
  }
}

for (const file of requiredFiles) {
  await access(path.join(releaseDir, file)).catch(() => fail(`missing ${file}`));
}

await access(path.join(rootDir, 'docs', 'zerogate-v0.1', 'dataset-audit.md'))
  .catch(() => fail('missing docs/zerogate-v0.1/dataset-audit.md'));
await access(path.join(rootDir, 'papers', 'zerogate-v0.1', 'zerogate-action-pass.pdf'))
  .catch(() => fail('missing papers/zerogate-v0.1/zerogate-action-pass.pdf'));

const fastSlow = await readJson('fast-slow-benchmark.json');
const loadStudy = await readJson('load-study.json');
const publicCorpus = await readJson('public-runtime-corpus.json');
const multiRuntime = await readJson('multi-runtime-fixture.json');
const manifest = await readJson('release-manifest.json');

assertEqual(fastSlow.summary.total_cases, 5760, 'weighted common-case observations');
assertEqual(fastSlow.summary.family_count, 12, 'action family count');
assertEqual(fastSlow.summary.mutation_count, 30, 'mutation count');
assertEqual(fastSlow.summary.exact_lane_match, 1, 'weighted exact lane match');
assertEqual(fastSlow.summary.violation_rate, 0, 'weighted violation rate');
assertEqual(fastSlow.stress_matrix_summary.total_cases, 360, 'stress matrix cases');
assertEqual(fastSlow.stress_matrix_summary.exact_lane_match, 1, 'stress exact lane match');

assertEqual(publicCorpus.summary.workflow_files, 302, 'public workflow files');
assertEqual(publicCorpus.summary.action_like_records, 2500, 'public action-like records');
assertEqual(publicCorpus.summary.measured_semantic_accuracy, null, 'public semantic accuracy boundary');
assertEqual(publicCorpus.summary.measured_false_allow_rate, null, 'public false-allow boundary');

assertEqual(multiRuntime.summary.total_cases, 528, 'multi-runtime fixture cases');
assertEqual(multiRuntime.summary.runtimes, 12, 'multi-runtime surfaces');
assertEqual(multiRuntime.summary.runtime_to_action_mapping_accuracy, 1, 'fixture mapping accuracy');
assertEqual(multiRuntime.summary.authorization_decision_accuracy, 1, 'fixture authorization accuracy');

assertEqual(loadStudy.summary.total_operations, 700000, 'load-study operations');
assertAtLeast(loadStudy.summary.throughput_ops_per_second, 60000, 'load-study throughput');
assertEqual(loadStudy.summary.expected_lane_match, 1, 'load-study lane match');
assertEqual(loadStudy.summary.false_allow_rate, 0, 'load-study false allow rate');
assertEqual(loadStudy.summary.partial_commit_without_receipt, 0, 'load-study partial commits without receipt');

assertEqual(manifest.release, 'zerogate-v0.1', 'manifest release id');
assertEqual(
  manifest.headline_metrics.concurrent_load_study_throughput_ops_per_second,
  loadStudy.summary.throughput_ops_per_second,
  'manifest load-study throughput',
);
assertEqual(
  manifest.headline_metrics.public_action_like_records,
  publicCorpus.summary.action_like_records,
  'manifest public corpus records',
);

console.log('ZeroGate v0.1 release snapshot verified.');
console.log(`Throughput: ${loadStudy.summary.throughput_ops_per_second} ops/s`);
console.log(`Public corpus: ${publicCorpus.summary.action_like_records} records from ${publicCorpus.summary.workflow_files} workflow files`);
