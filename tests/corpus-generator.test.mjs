import test from 'node:test';
import assert from 'node:assert/strict';

import { generateRuntimeBoundaryCorpus } from '../lib/corpus-generator.mjs';
import { evaluateCases, CONTROL_OUTCOMES } from '../lib/boundary-core.mjs';

test('generateRuntimeBoundaryCorpus creates requested records with baselines and risky cases', () => {
  const cases = generateRuntimeBoundaryCorpus({ count: 600, seed: 'test-seed' });

  assert.equal(cases.length, 600);
  assert.equal(new Set(cases.map((item) => item.id)).size, 600);

  const safe = cases.filter((item) => item.expected.control === 'allow');
  const risky = cases.filter((item) => item.expected.control !== 'allow');
  const judgment = cases.filter((item) => item.generator?.lane === 'judgment-validity');
  assert.ok(safe.length >= 80, `expected at least 80 safe baselines, got ${safe.length}`);
  assert.ok(risky.length >= 450, `expected at least 450 risky records, got ${risky.length}`);
  assert.ok(judgment.length >= 40, `expected judgment-validity lane coverage, got ${judgment.length}`);

  const runtimes = new Set(cases.map((item) => item.runtime));
  const families = new Set(cases.map((item) => item.family));
  const locales = new Set(cases.map((item) => item.locale));
  const obfuscations = new Set(cases.map((item) => item.obfuscation));

  assert.ok(runtimes.size >= 10, `expected broad runtime coverage, got ${runtimes.size}`);
  assert.ok(families.size >= 20, `expected broad family coverage, got ${families.size}`);
  assert.ok(locales.size >= 5, `expected multilingual coverage, got ${locales.size}`);
  assert.ok(obfuscations.size >= 8, `expected obfuscation coverage, got ${obfuscations.size}`);
});

test('generated corpus is internally consistent with the reference boundary evaluator', () => {
  const cases = generateRuntimeBoundaryCorpus({ count: 720, seed: 'consistency-seed' });
  const { results, scoring } = evaluateCases(cases);

  assert.equal(scoring.summary.failed, 0);
  assert.equal(scoring.summary.total, 720);
  assert.equal(scoring.summary.safe_baseline_allow_rate, 1);
  assert.equal(scoring.summary.risky_protection_rate, 1);
  assert.equal(scoring.summary.runtime_boundary_score, 100);

  for (const outcome of Object.keys(scoring.distributions.expected_controls)) {
    assert.ok(CONTROL_OUTCOMES.includes(outcome), `unknown expected control: ${outcome}`);
  }
});
