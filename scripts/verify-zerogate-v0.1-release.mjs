#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

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

async function assertFile(file, label) {
  const info = await stat(file).catch(() => fail(`missing ${label}`));
  if (!info.isFile()) fail(`${label}: expected a regular file`);
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(releaseDir, relativePath), 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    fail(`invalid JSON in ${relativePath}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertAtLeast(actual, expected, label) {
  if (!Number.isFinite(actual) || actual < expected) {
    fail(`${label}: expected a finite number >= ${expected}, got ${actual}`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label}: expected an object`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${label}: expected a nonempty string`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label}: expected a boolean`);
}

function assertArrayCount(value, expected, label) {
  if (!Array.isArray(value)) fail(`${label}: expected an array with ${expected} entries`);
  assertEqual(value.length, expected, label);
}

function assertFields(actual, expected, label) {
  assertObject(actual, label);
  for (const [key, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(actual[key], value)) {
      fail(`${label}.${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual[key])}`);
    }
  }
}

function assertUniqueRecords(records, label, key = (row) => row.id) {
  const seen = new Set();
  for (const [index, row] of records.entries()) {
    assertObject(row, `${label}[${index}]`);
    const id = key(row);
    assertString(id, `${label}[${index}].id`);
    if (seen.has(id)) fail(`${label}: duplicate id ${id}`);
    seen.add(id);
  }
}

function assertGrid(cases, dimensions, label) {
  assertArrayCount(cases, Object.values(dimensions).reduce((a, b) => a * b, 1), `${label} cases`);
  assertUniqueRecords(cases, `${label} cases`);
  for (const row of cases) {
    for (const field of Object.keys(dimensions)) assertString(row[field], `${label} ${row.id}.${field}`);
    assertEqual(row.id, Object.keys(dimensions).map((field) => row[field]).join(':'), `${label} case id`);
  }
  // Unique tuple IDs plus the product-sized array require every grid cell to exist.
  for (const [field, count] of Object.entries(dimensions)) {
    assertEqual(new Set(cases.map((row) => row[field])).size, count, `${label} ${field} count`);
  }
}

const decisions = { fast: 'execute', slow: 'review', block: 'deny' };

function assertLaneOutput(row, matchField, label) {
  for (const field of ['expected_lane', 'observed_lane']) {
    assertString(row[field], `${label} ${row.id}.${field}`);
    if (!Object.hasOwn(decisions, row[field])) fail(`${label} ${row.id}.${field}: unsupported lane`);
  }
  assertString(row.reason, `${label} ${row.id}.reason`);
  assertString(row.receipt_hash, `${label} ${row.id}.receipt_hash`);
  if (!/^[a-f0-9]{64}$/.test(row.receipt_hash)) fail(`${label} ${row.id}.receipt_hash: expected SHA-256 hex`);
  assertEqual(row.decision, decisions[row.observed_lane], `${label} ${row.id}.decision`);
  assertBoolean(row[matchField], `${label} ${row.id}.${matchField}`);
  assertEqual(row[matchField], row.expected_lane === row.observed_lane, `${label} ${row.id}.${matchField}`);
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return Object.fromEntries(counts);
}

function rate(numerator, denominator) {
  if (!denominator) fail('cannot recompute a rate without case outputs');
  return Number((numerator / denominator).toFixed(4));
}

function laneSummary(cases) {
  const count = (predicate) => cases.filter(predicate).length;
  const fast = count((row) => row.observed_lane === 'fast');
  const violations = count((row) => row.observed_lane === 'fast' && row.expected_lane !== 'fast');
  return {
    exact_lane_match: rate(count((row) => row.observed_lane === row.expected_lane), cases.length),
    fast_path_coverage: rate(fast, cases.length),
    zero_wait_ratio: rate(count((row) => row.observed_lane !== 'slow'), cases.length),
    violation_rate: rate(violations, cases.length),
    lane_counts: countBy(cases, 'observed_lane'),
  };
}

function verifyStress(fastSlow) {
  const cases = fastSlow.cases;
  assertGrid(cases, { family: 12, mutation: 30 }, 'stress');
  const receiptFields = [
    'receipt_object_constructed', 'receipt_sink_available', 'receipt_persisted_before_commit',
    'receipt_complete', 'partial_commit_without_receipt', 'async_evidence_backend_available',
  ];
  for (const row of cases) {
    assertLaneOutput(row, 'matched_expectation', 'stress');
    assertAtLeast(row.local_commit_overhead_ms, 0, `stress ${row.id}.local_commit_overhead_ms`);
    for (const field of receiptFields) assertBoolean(row[field], `stress ${row.id}.${field}`);
    const partial = row.decision === 'execute' && !row.receipt_persisted_before_commit;
    assertEqual(row.partial_commit_without_receipt, partial, `stress ${row.id}.partial_commit_without_receipt`);
  }
  const count = (predicate) => cases.filter(predicate).length;
  const fast = count((row) => row.observed_lane === 'fast');
  const partial = count((row) => row.partial_commit_without_receipt);
  assertFields(fastSlow.stress_matrix_summary, {
    total_cases: cases.length,
    family_count: new Set(cases.map((row) => row.family)).size,
    mutation_count: new Set(cases.map((row) => row.mutation)).size,
    ...laneSummary(cases),
    // Preserve archived all-case denominators; these are not the v2 lane metrics.
    safety_preserving_fast_path_coverage: rate(count((row) => row.expected_lane === 'fast' && row.observed_lane === 'fast'), cases.length),
    evidence_completeness: rate(count((row) => row.receipt_complete), cases.length),
    receipt_persisted_before_commit_rate: rate(count((row) => row.receipt_persisted_before_commit), cases.length),
    commit_receipt_integrity: rate(fast - partial, fast),
    partial_commit_without_receipt: partial,
  }, 'stress summary');

  const splits = fastSlow.dataset_audit?.splits;
  assertObject(splits, 'stress splits');
  assertArrayCount(splits.heldout_families, 4, 'heldout families');
  assertArrayCount(splits.heldout_mutations, 8, 'heldout mutations');
  for (const [field, values] of [['family', splits.heldout_families], ['mutation', splits.heldout_mutations]]) {
    if (new Set(values).size !== values.length || values.some((value) => !cases.some((row) => row[field] === value))) {
      fail(`stress heldout ${field}: expected unique values present in cases`);
    }
  }
  for (const [name, heldFamily, heldMutation] of [
    ['reference', false, false], ['heldout_family', true, false],
    ['heldout_mutation', false, true], ['heldout_cross', true, true],
  ]) {
    const rows = cases.filter((row) => splits.heldout_families.includes(row.family) === heldFamily
      && splits.heldout_mutations.includes(row.mutation) === heldMutation);
    assertFields(splits[name], { cases: rows.length, ...laneSummary(rows) }, `stress splits.${name}`);
  }

  // No per-case weights or expanded observations are shipped. Compare copies only.
  assertFields(fastSlow.representative_mix_summary, fastSlow.summary, 'weighted representative summary agreement');
  assertEqual(fastSlow.representative_case_count, 5760, 'weighted representative case count');
}

function verifyFixture(multiRuntime) {
  const cases = multiRuntime.cases;
  assertGrid(cases, { runtime: 12, family: 4, variant: 11 }, 'fixture');
  for (const row of cases) {
    assertLaneOutput(row, 'authorization_matched', 'fixture');
    assertBoolean(row.mapping_matched, `fixture ${row.id}.mapping_matched`);
    assertString(row.raw_event_id, `fixture ${row.id}.raw_event_id`);
    if (!['match', 'violation_mapped', 'abstain'].includes(row.expected_mapping)) {
      fail(`fixture ${row.id}.expected_mapping: unsupported mapping label`);
    }
  }
  const matches = (rows) => ({
    cases: rows.length,
    mapping_matches: rows.filter((row) => row.mapping_matched).length,
    authorization_matches: rows.filter((row) => row.expected_lane === row.observed_lane).length,
    mapping_accuracy: rate(rows.filter((row) => row.mapping_matched).length, rows.length),
    authorization_accuracy: rate(rows.filter((row) => row.expected_lane === row.observed_lane).length, rows.length),
  });
  const totals = matches(cases);
  assertFields(multiRuntime.summary, {
    total_cases: cases.length,
    runtimes: new Set(cases.map((row) => row.runtime)).size,
    skill_families: new Set(cases.map((row) => row.family)).size,
    variants: new Set(cases.map((row) => row.variant)).size,
    // Mapping flags can be aggregated, but cannot be independently re-evaluated here.
    runtime_to_action_mapping_accuracy: totals.mapping_accuracy,
    authorization_decision_accuracy: totals.authorization_accuracy,
    lane_distribution: countBy(cases, 'observed_lane'),
  }, 'fixture summary');
  for (const field of ['runtime', 'variant']) {
    const groups = Object.fromEntries([...new Set(cases.map((row) => row[field]))]
      .map((value) => [value, matches(cases.filter((row) => row[field] === value))]));
    const actual = multiRuntime.summary[`by_${field}`];
    assertObject(actual, `fixture by_${field}`);
    assertFields({ keys: Object.keys(actual).sort() }, { keys: Object.keys(groups).sort() }, `fixture by_${field}`);
    for (const [name, summary] of Object.entries(groups)) assertFields(actual[name], summary, `fixture by_${field}.${name}`);
  }
}

function verifySavedRecords(source, labeling, publicCorpus) {
  assertArrayCount(source.files, 302, 'source workflow files');
  assertUniqueRecords(source.files, 'source workflows', (row) => {
    for (const field of ['repository', 'ref', 'path', 'text']) assertString(row[field], `workflow ${field}`);
    return JSON.stringify([row.repository, row.ref, row.path]);
  });
  assertEqual(new Set(source.files.map((row) => row.repository)).size, publicCorpus.summary.source_repositories, 'source workflow repositories');
  assertFields(publicCorpus.source_snapshot, { workflow_files: source.files.length }, 'public source snapshot');
  assertArrayCount(labeling.records, 240, 'labeling records');
  assertEqual(labeling.selection_policy?.target_records, labeling.records.length, 'labeling target records');
  assertEqual(publicCorpus.labeling_pack?.records, labeling.records.length, 'public labeling records');
  assertUniqueRecords(labeling.records, 'labeling records');
  assertArrayCount(publicCorpus.sample_records, 30, 'public sample records');
  assertUniqueRecords(publicCorpus.sample_records, 'public sample records');
  const workflows = new Set(source.files.map((row) => JSON.stringify([row.repository, row.path])));
  for (const row of [...labeling.records, ...publicCorpus.sample_records]) {
    if (!workflows.has(JSON.stringify([row.repository, row.workflow_path]))) fail(`public record ${row.id}: missing source workflow`);
  }
}

for (const file of requiredFiles) {
  await assertFile(path.join(releaseDir, file), file);
}

await assertFile(path.join(rootDir, 'docs', 'zerogate-v0.1', 'dataset-audit.md'), 'docs/zerogate-v0.1/dataset-audit.md');
await assertFile(path.join(rootDir, 'papers', 'zerogate-v0.1', 'zerogate-action-pass.pdf'), 'papers/zerogate-v0.1/zerogate-action-pass.pdf');

const fastSlow = await readJson('fast-slow-benchmark.json');
const loadStudy = await readJson('load-study.json');
const publicCorpus = await readJson('public-runtime-corpus.json');
const multiRuntime = await readJson('multi-runtime-fixture.json');
const manifest = await readJson('release-manifest.json');
const source = await readJson('source-workflows.json');
const labeling = await readJson('labeling-pack.json');

for (const [label, report] of Object.entries({ fastSlow, loadStudy, publicCorpus, multiRuntime })) {
  assertObject(report, label);
  assertObject(report.summary, `${label} summary`);
}
assertObject(manifest, 'manifest');
assertObject(manifest.headline_metrics, 'manifest headline_metrics');
assertObject(source, 'source workflows');
assertObject(labeling, 'labeling pack');
verifyStress(fastSlow);
verifyFixture(multiRuntime);
verifySavedRecords(source, labeling, publicCorpus);

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
assertFields(manifest.headline_metrics, {
  weighted_common_case_observations: fastSlow.summary.total_cases,
  adversarial_stress_cases: fastSlow.stress_matrix_summary.total_cases,
  weighted_exact_lane_match: fastSlow.summary.exact_lane_match,
  weighted_false_allow_or_violation_rate: fastSlow.summary.violation_rate,
  weighted_fast_path_coverage: fastSlow.summary.fast_path_coverage,
  zero_wait_ratio: fastSlow.summary.zero_wait_ratio,
  public_workflow_files: publicCorpus.summary.workflow_files,
  public_canonicalization_coverage: publicCorpus.summary.canonicalization_success_rate,
  multi_runtime_fixture_cases: multiRuntime.summary.total_cases,
  runtime_surfaces: multiRuntime.summary.runtimes,
  concurrent_load_study_operations: loadStudy.summary.total_operations,
  load_study_false_allow_rate: loadStudy.summary.false_allow_rate,
  partial_commits_without_receipt: loadStudy.summary.partial_commit_without_receipt,
}, 'manifest headline_metrics');
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

console.log('ZeroGate v0.1 release snapshot integrity-only checks passed.');
console.log('Checked: 360 stress case outputs, 528 multi-runtime fixture outputs, 302 saved workflows, 240 labeling records, 30 public samples.');
console.log('Recomputed: stress lane/receipt and split summaries; fixture lane agreement and aggregation of recorded mapping flags.');
console.log('Scope: not evaluator replay or experiment re-execution; no independent mapping, receipt durability, or semantic accuracy validation.');
console.log('Unavailable here: weighted per-case inputs/weights, all 2500 public derived outputs, 700000 load-operation outputs, baseline trial inputs, and per-round timing samples.');
console.log('Preset historical comparisons are not recomputable empirical measurements; their claims are not validated by this check.');
console.log(`Stored load throughput (not remeasured): ${loadStudy.summary.throughput_ops_per_second} ops/s`);
