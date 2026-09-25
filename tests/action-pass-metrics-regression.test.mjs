import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateActionPassLaneBenchmark,
  scoreActionPassLaneResults,
} from '../lib/action-pass-core.mjs';

function result(expected, control = 'allow', lane = 'fast') {
  return {
    pass: expected === control,
    expected: { control: expected },
    actual: { control, lane, receipt_state: 'not_committed', blockers: [], slow_reasons: [] },
  };
}

test('forcing every fixture to fast allow cannot exceed full safety-preserving coverage', () => {
  const rows = evaluateActionPassLaneBenchmark().results.map((row) => ({
    ...row,
    pass: row.expected.control === 'allow',
    actual: { ...row.actual, lane: 'fast', control: 'allow' },
  }));
  const scored = scoreActionPassLaneResults(rows);
  assert.equal(scored.safety_preserving_fast_path_coverage, 1);
  assert.equal(scored.false_fast_allow_rate, 1);
});

test('safety-preserving coverage counts only expected allows that actually fast allow', () => {
  const scored = scoreActionPassLaneResults([
    result('allow'), result('allow', 'block', 'block'), result('block'),
  ]);
  assert.equal(scored.safety_preserving_fast_path_coverage, 0.5);
  assert.equal(scored.zero_wait_ratio, 0.6667);
  assert.equal(scored.fast_path_coverage, 0.6667);
});

test('false-fast-allow rate is conditional on all expected non-allow cases', () => {
  const scored = scoreActionPassLaneResults([
    result('allow'), result('allow'), result('block'),
    result('require_review', 'require_review', 'slow'),
    result('require_dual_approval', 'require_dual_approval', 'slow'),
    result('block', 'block', 'block'),
  ]);
  assert.equal(scored.false_fast_allow_rate, 0.25);
});

test('padding a workload with benign cases cannot dilute conditional false-fast-allow rate', () => {
  const risky = [result('block'), result('block', 'block', 'block')];
  const padded = [...risky, ...Array.from({ length: 8 }, () => result('allow'))];
  assert.equal(scoreActionPassLaneResults(risky).false_fast_allow_rate, 0.5);
  assert.equal(scoreActionPassLaneResults(padded).false_fast_allow_rate, 0.5);
});

test('lane metrics expose the exact conditional numerators and denominators', () => {
  const scored = scoreActionPassLaneResults([
    result('allow'), result('allow', 'require_review', 'slow'), result('block'),
    result('require_review', 'require_review', 'slow'),
  ]);
  assert.equal(scored.expected_allowed_cases, 2);
  assert.equal(scored.expected_disallowed_cases, 2);
  assert.equal(scored.safety_preserving_fast_allows, 1);
  assert.equal(scored.false_fast_allows, 1);
});

test('zero-denominator lane metrics retain legacy zero values with explicit empty counts', () => {
  const allDisallowed = scoreActionPassLaneResults([result('block')]);
  assert.equal(allDisallowed.safety_preserving_fast_path_coverage, 0);
  assert.equal(allDisallowed.expected_allowed_cases, 0);
  assert.equal(allDisallowed.safety_preserving_fast_allows, 0);
  const allAllowed = scoreActionPassLaneResults([result('allow')]);
  assert.equal(allAllowed.false_fast_allow_rate, 0);
  assert.equal(allAllowed.expected_disallowed_cases, 0);
  assert.equal(allAllowed.false_fast_allows, 0);
  const empty = scoreActionPassLaneResults([]);
  assert.equal(empty.expected_allowed_cases, 0);
  assert.equal(empty.expected_disallowed_cases, 0);
});

test('corrected lane metrics are versioned separately from the unchanged Action Pass schema', () => {
  const benchmark = evaluateActionPassLaneBenchmark();
  assert.equal(benchmark.schema_version, 'osuite.action-pass.v0.1');
  assert.equal(benchmark.scoring.metrics_schema_version, 'osuite.action-pass-lane-metrics.v2');
  assert.equal(benchmark.workload_mix.scoring.metrics_schema_version, 'osuite.action-pass-lane-metrics.v2');
});
