import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NEUTRAL_REFUND_OPERATIONS_BOUNDARY,
  SKILL_BOUNDARY_V2_CASES,
  deriveEffectivePolicy,
  evaluateSkillBoundaryV2Case,
  evaluateSkillBoundaryV2Experiment,
  mapNeutralBoundaryToOsuitePolicy,
} from '../lib/skill-boundary-v2-core.mjs';

test('neutral boundary maps to OSuite policy without making OSuite part of the contract', () => {
  const policy = mapNeutralBoundaryToOsuitePolicy(NEUTRAL_REFUND_OPERATIONS_BOUNDARY);

  assert.equal(NEUTRAL_REFUND_OPERATIONS_BOUNDARY.boundary_id, 'boundary.refund-operations.v2');
  assert.equal(NEUTRAL_REFUND_OPERATIONS_BOUNDARY.osuite_policy_id, undefined);
  assert.equal(policy.policy_id, 'boundary.refund-operations.v2');
  assert.deepEqual(policy.allowed_operations, [
    'read_support_ticket',
    'draft_internal_refund_note',
    'issue_refund',
  ]);
  assert.equal(policy.max_amount_usd, 100);
});

test('runtime authorization can narrow a skill boundary without changing the skill contract', () => {
  const basePolicy = mapNeutralBoundaryToOsuitePolicy(NEUTRAL_REFUND_OPERATIONS_BOUNDARY);
  const narrowed = deriveEffectivePolicy(NEUTRAL_REFUND_OPERATIONS_BOUNDARY, {
    org_policy: { max_amount_usd: 75 },
  });

  assert.equal(basePolicy.max_amount_usd, 100);
  assert.equal(narrowed.max_amount_usd, 75);
  assert.equal(NEUTRAL_REFUND_OPERATIONS_BOUNDARY.constraints.max_amount_usd, 100);
});

test('bounded refund cases distinguish allowed, exceeded, narrowed, and missing amount semantics', () => {
  const byGroup = Object.fromEntries(
    SKILL_BOUNDARY_V2_CASES
      .filter((item) => item.runtime === 'mcp')
      .map((item) => [item.group, evaluateSkillBoundaryV2Case(item)])
  );

  assert.equal(byGroup['allowed-bounded-refund'].actual.control, 'allow');
  assert.deepEqual(byGroup['allowed-bounded-refund'].actual.drift, ['none']);

  assert.equal(byGroup['violation-refund-over-contract-limit'].actual.control, 'block');
  assert.deepEqual(byGroup['violation-refund-over-contract-limit'].actual.drift, ['policy_drift']);

  assert.equal(byGroup['runtime-narrowed-refund-limit'].actual.control, 'block');
  assert.deepEqual(byGroup['runtime-narrowed-refund-limit'].actual.drift, ['policy_drift']);

  assert.equal(byGroup['runtime-denied-refund-permission'].actual.control, 'block');
  assert.deepEqual(byGroup['runtime-denied-refund-permission'].actual.drift, ['policy_drift']);

  assert.equal(byGroup['missing-refund-amount'].actual.control, 'require_review');
  assert.deepEqual(byGroup['missing-refund-amount'].actual.drift, ['incomplete_evidence']);
});

test('v2 experiment measures semantic preservation across all runtime lanes', () => {
  const experiment = evaluateSkillBoundaryV2Experiment();

  assert.equal(experiment.scoring.total, 32);
  assert.equal(experiment.scoring.passed, 32);
  assert.equal(experiment.scoring.failed, 0);
  assert.equal(experiment.scoring.runtimes, 4);
  assert.equal(experiment.scoring.scenario_groups, 8);
  assert.equal(experiment.scoring.exact_control_match_rate, 1);
  assert.equal(experiment.scoring.allowed_action_pass_rate, 1);
  assert.equal(experiment.scoring.violation_block_rate, 1);
  assert.equal(experiment.scoring.escalation_match_rate, 1);
  assert.equal(experiment.scoring.boundary_consistency_rate, 1);
});
