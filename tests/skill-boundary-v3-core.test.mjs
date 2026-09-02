import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS,
  SKILL_BOUNDARY_V3_CASES,
  deriveRuntimeAuthorizationPolicyV3,
  evaluateSkillBoundaryV3Case,
  evaluateSkillBoundaryV3Experiment,
  mapRuntimeEvidenceToNeutralActionV3,
} from '../lib/skill-boundary-v3-core.mjs';

test('v3 skill contracts keep runtime policy fields out of requested authority', () => {
  const refundContract = NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS.refund_operations;

  assert.equal(refundContract.schema_version, 'skill-boundary-contract.v3');
  assert.equal(refundContract.runtime_lanes, undefined);
  assert.equal(refundContract.risk_level, undefined);
  assert.equal(refundContract.approval_required, undefined);
  assert.equal(refundContract.escalation, undefined);
  assert.ok(Array.isArray(refundContract.requested_authority.operations));
  assert.ok(refundContract.requested_authority.operations.every((operation) => operation.effect));
});

test('v3 binds operation, effect, destination, resource, and constraints per operation', () => {
  const malformedRefund = SKILL_BOUNDARY_V3_CASES.find((item) => (
    item.id === 'skill-boundary-v3-mcp-refund-combination-attack'
  ));
  const result = evaluateSkillBoundaryV3Case(malformedRefund);

  assert.equal(result.mapping.pass, true);
  assert.equal(result.authorization.actual_control, 'block');
  assert.deepEqual(result.authorization.reasons, ['effect_mismatch', 'destination_mismatch']);
});

test('v3 separates runtime-to-action mapping accuracy from authorization decision accuracy', () => {
  const experiment = evaluateSkillBoundaryV3Experiment();

  assert.equal(experiment.scoring.total_cases, 48);
  assert.equal(experiment.scoring.runtime_lanes, 4);
  assert.equal(experiment.scoring.skill_families, 2);
  assert.equal(experiment.scoring.runtime_to_action_mapping_accuracy, 1);
  assert.equal(experiment.scoring.authorization_decision_accuracy, 1);
  assert.equal(experiment.scoring.correct_review_escalation_rate, 1);
  assert.equal(experiment.scoring.false_allow_rate, 0);
  assert.equal(experiment.scoring.false_block_rate, 0);
  assert.ok(experiment.held_out.skill_families.includes('procurement_approval'));
  assert.ok(experiment.held_out.runtime_mappings.includes('deepseek_harness'));
});

test('runtime authorization can narrow or deny without mutating the skill contract', () => {
  const refundContract = NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS.refund_operations;
  const narrowed = deriveRuntimeAuthorizationPolicyV3(refundContract, {
    narrowed_constraints: {
      issue_refund: {
        amount_usd_lte: 75,
      },
    },
  });
  const denied = deriveRuntimeAuthorizationPolicyV3(refundContract, {
    denied_operations: ['issue_refund'],
  });

  assert.equal(refundContract.requested_authority.operations
    .find((operation) => operation.operation === 'issue_refund')
    .constraints.amount_usd_lte, 100);
  assert.equal(narrowed.operations.issue_refund.constraints.amount_usd_lte, 75);
  assert.equal(denied.operations.issue_refund.allowed, false);
});

test('v3 mapping reports incomplete evidence separately from authorization', () => {
  const missingAmount = SKILL_BOUNDARY_V3_CASES.find((item) => (
    item.id === 'skill-boundary-v3-sdk-refund-missing-amount'
  ));
  const mapped = mapRuntimeEvidenceToNeutralActionV3(missingAmount);
  const result = evaluateSkillBoundaryV3Case(missingAmount);

  assert.equal(mapped.mapping_status, 'mapped_with_missing_evidence');
  assert.deepEqual(mapped.missing_evidence, ['amount_usd']);
  assert.equal(result.mapping.pass, true);
  assert.equal(result.authorization.actual_control, 'require_review');
  assert.deepEqual(result.authorization.reasons, ['missing_required_evidence:amount_usd']);
});
