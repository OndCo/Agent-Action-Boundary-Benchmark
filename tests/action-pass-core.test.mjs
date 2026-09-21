import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_PASS_LANE_CASES,
  evaluateActionPassCase,
  evaluateActionPassLaneBenchmark,
  makeActionPass,
} from '../lib/action-pass-core.mjs';

test('fresh bounded pass enters the fast lane and emits a receipt', () => {
  const result = evaluateActionPassCase(ACTION_PASS_LANE_CASES.find((item) => item.id === 'fast-mcp-read-support-ticket'));

  assert.equal(result.actual.lane, 'fast');
  assert.equal(result.actual.control, 'allow');
  assert.equal(result.actual.receipt_state, 'complete');
  assert.equal(result.actual.receipt.pass_id, 'ap_support_1042_fast_lane');
  assert.equal(result.actual.receipt.action_hash, result.action_hash);
});

test('A2A can carry a pass but OSuite still gates the action', () => {
  const result = evaluateActionPassCase(ACTION_PASS_LANE_CASES.find((item) => item.id === 'fast-a2a-internal-handoff'));

  assert.equal(result.runtime, 'a2a');
  assert.equal(result.actual.lane, 'fast');
  assert.equal(result.actual.control, 'allow');
});

test('policy drift routes to slow lane rather than pretending the old pass is fresh', () => {
  const result = evaluateActionPassCase(ACTION_PASS_LANE_CASES.find((item) => item.id === 'slow-policy-digest-drift'));

  assert.equal(result.actual.lane, 'slow');
  assert.equal(result.actual.control, 'require_review');
  assert.deepEqual(result.actual.slow_reasons, ['policy_digest_drift']);
});

test('changed action hash fails closed at commit time', () => {
  const result = evaluateActionPassCase(ACTION_PASS_LANE_CASES.find((item) => item.id === 'block-action-hash-mismatch'));

  assert.equal(result.actual.lane, 'block');
  assert.equal(result.actual.control, 'block');
  assert.ok(result.actual.blockers.includes('action_hash_mismatch'));
});

test('expired, replayed, revoked, and unsigned passes never fast-allow', () => {
  const ids = [
    'block-expired-pass',
    'block-consumed-nonce',
    'block-identity-revoked',
    'block-invalid-signature',
  ];

  for (const id of ids) {
    const result = evaluateActionPassCase(ACTION_PASS_LANE_CASES.find((item) => item.id === id));
    assert.equal(result.actual.lane, 'block');
    assert.notEqual(result.actual.control, 'allow');
  }
});

test('makeActionPass binds the pass to the canonical action hash', () => {
  const pass = makeActionPass();

  assert.equal(pass.schema_version, 'osuite.action-pass.v0.1');
  assert.match(pass.canonical_action.action_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(pass.authority.constraints.requires_local_receipt, true);
});

test('benchmark reports safety-preserving fast path and no false fast allows', () => {
  const benchmark = evaluateActionPassLaneBenchmark();

  assert.equal(benchmark.scoring.total_cases, 16);
  assert.equal(benchmark.scoring.exact_match_rate, 1);
  assert.equal(benchmark.scoring.false_fast_allow_rate, 0);
  assert.equal(benchmark.scoring.safety_preserving_fast_path_coverage, 1);
  assert.equal(benchmark.workload_mix.scoring.total_cases, 100);
  assert.equal(benchmark.workload_mix.scoring.fast_path_coverage, 0.87);
  assert.equal(benchmark.workload_mix.scoring.false_fast_allow_rate, 0);
  assert.ok(benchmark.scoring.fast_path_coverage > 0);
  assert.ok(benchmark.scoring.slow_path_rate > 0);
  assert.ok(benchmark.scoring.fail_closed_rate > 0);
});
