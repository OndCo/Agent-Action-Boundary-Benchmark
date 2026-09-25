import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { evaluateCases, scoreResults } from '../lib/boundary-core.mjs';

function riskyResult(actual) {
  return {
    id: 'metric-regression',
    pass: false,
    runtime: 'mcp',
    family: 'metric-regression',
    severity: 'critical',
    expected: { control: 'block', drift: ['policy_drift'] },
    actual,
  };
}

test('missing and invalid controls receive no protection credit at any aggregation level', () => {
  for (const actual of [undefined, null, {}, { control: null }, { control: '' }, { control: 'error' }, { control: 'timeout' }]) {
    const scored = scoreResults([riskyResult(actual)]);
    assert.equal(scored.summary.total, 1);
    assert.equal(scored.summary.failed, 1);
    assert.equal(scored.summary.risky_records, 1);
    assert.equal(scored.summary.risky_protected, 0, JSON.stringify(actual));
    assert.equal(scored.summary.risky_protection_rate, 0);
    assert.equal(scored.by_runtime[0].risky_records, 1);
    assert.equal(scored.by_runtime[0].risky_protection_rate, 0);
    assert.equal(scored.by_family[0].risky_records, 1);
    assert.equal(scored.by_family[0].risky_protection_rate, 0);
  }
});

test('missing, malformed and contradictory drift observations receive no detection credit', () => {
  const observations = [
    undefined, null, {}, { drift: null }, { drift: [] }, { drift: 'policy_drift' },
    { drift: {} }, { drift: ['unknown'] }, { drift: ['policy_drift', 'unknown'] },
    { drift: ['none'] }, { drift: ['none', 'policy_drift'] },
  ];
  for (const actual of observations) {
    const { summary } = scoreResults([riskyResult(actual)]);
    assert.equal(summary.drift_expected_records, 1);
    assert.equal(summary.drift_detection_rate, 0, JSON.stringify(actual));
  }
});

test('sparse drift arrays cannot substitute missing entries for observed drift', () => {
  const { summary } = scoreResults([riskyResult({ drift: Array(1) })]);
  assert.equal(summary.drift_expected_records, 1);
  assert.equal(summary.drift_detection_rate, 0);
});

test('observed protective controls and valid drift retain missing outcomes in their denominators', () => {
  const results = ['block', 'require_review', 'require_dual_approval', 'allow', undefined]
    .map((control) => riskyResult(control === undefined ? undefined : {
      control,
      drift: control === 'allow' ? ['none'] : ['policy_drift', 'resource_drift'],
    }));
  const scored = scoreResults(results);
  assert.equal(scored.summary.risky_records, 5);
  assert.equal(scored.summary.risky_protected, 3);
  assert.equal(scored.summary.risky_protection_rate, 0.6);
  assert.equal(scored.summary.drift_expected_records, 5);
  assert.equal(scored.summary.drift_detection_rate, 0.6);
  assert.equal(scored.by_runtime[0].risky_protection_rate, 0.6);
  assert.equal(scored.by_family[0].risky_protection_rate, 0.6);
});

test('a wholly missing critical observation contributes no positive boundary score', () => {
  const { summary } = scoreResults([riskyResult(undefined)]);
  assert.equal(summary.runtime_boundary_score, 0);
});

test('runtime metric outputs identify the corrected observation-credit semantics', () => {
  assert.equal(scoreResults([]).metrics_schema_version, 'osuite.runtime-boundary-metrics.v2');
});

test('the frozen 6000-record corpus retains all historical scoring values', () => {
  const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
  const cases = read('benchmarks/runtime-boundary-corpus.jsonl').trim().split('\n').map(JSON.parse);
  const historical = JSON.parse(read('reports/runtime-boundary-benchmark.json'));
  const { metrics_schema_version, ...scoring } = evaluateCases(cases).scoring;
  assert.equal(cases.length, 6000);
  assert.equal(scoring.summary.passed, 6000);
  assert.equal(scoring.summary.runtime_boundary_score, 100);
  assert.deepEqual(scoring, historical.scoring);
});
