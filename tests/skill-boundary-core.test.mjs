import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REFUND_REVIEW_SKILL_CONTRACT,
  SKILL_BOUNDARY_CASES,
  contractViolations,
  evaluateSkillBoundaryExperiment,
  mapSkillBoundaryContractToPolicy,
  mapRuntimeEvidenceToCavaAction,
  skillBoundaryKey,
} from '../lib/skill-boundary-core.mjs';

test('skill boundary contract maps into OSuite policy fields', () => {
  const policy = mapSkillBoundaryContractToPolicy(REFUND_REVIEW_SKILL_CONTRACT);

  assert.equal(policy.policy_id, 'skill.refund-review.v1');
  assert.deepEqual(policy.allowed_operations, ['read_support_ticket', 'draft_internal_refund_note']);
  assert.deepEqual(policy.allowed_effects, ['read', 'write']);
  assert.deepEqual(policy.allowed_destinations, ['support_workspace', 'internal_ticket_note']);
  assert.deepEqual(policy.allowed_resource_prefixes, ['ticket/T-', 'knowledge_base/refund_policy']);
  assert.deepEqual(policy.allowed_identities, ['skill:refund-review:v1']);
  assert.deepEqual(policy.allowed_data_classes, ['support_ticket', 'refund_policy']);
  assert.equal(policy.max_records, 1);
});

test('skill boundary contract can express bounded refund amount predicates', () => {
  const boundedRefundContract = {
    ...REFUND_REVIEW_SKILL_CONTRACT,
    contract_id: 'skill.bounded-refund.v1',
    skill: {
      name: 'Bounded Refund Skill',
      version: '1.0.0',
      purpose: 'Issue refunds only within a bounded payment threshold.',
    },
    allowed: {
      operations: ['issue_refund'],
      effects: ['transfer'],
      destinations: ['payment_ledger'],
      resource_prefixes: ['refund_case/'],
      data_classes: ['payment_record'],
    },
    constraints: {
      ...REFUND_REVIEW_SKILL_CONTRACT.constraints,
      max_amount_usd: 100,
    },
  };

  const policy = mapSkillBoundaryContractToPolicy(boundedRefundContract);
  const underThreshold = mapRuntimeEvidenceToCavaAction({
    id: 'bounded-refund-mcp-73',
    group: 'bounded-refund-under-threshold',
    runtime: 'mcp',
    expected_control: 'allow',
    evidence: {
      tool_name: 'payments.issue_refund',
      args: { case_id: 'CASE-1042', amount_usd: 73, record_count: 1 },
      identity: 'skill:refund-review:v1',
    },
  }, boundedRefundContract);
  const overThreshold = mapRuntimeEvidenceToCavaAction({
    id: 'bounded-refund-mcp-125',
    group: 'bounded-refund-over-threshold',
    runtime: 'mcp',
    expected_control: 'block',
    evidence: {
      tool_name: 'payments.issue_refund',
      args: { case_id: 'CASE-1042', amount_usd: 125, record_count: 1 },
      identity: 'skill:refund-review:v1',
    },
  }, boundedRefundContract);

  assert.equal(policy.max_amount_usd, 100);
  assert.deepEqual(contractViolations(underThreshold, boundedRefundContract), []);
  assert.deepEqual(contractViolations(overThreshold, boundedRefundContract), ['amount_usd']);
});

test('equivalent support-ticket reads preserve one skill boundary across MCP, SDK, and shell', () => {
  const cases = SKILL_BOUNDARY_CASES.filter((item) => item.group === 'allowed-read-single-ticket');
  const keys = new Set(
    cases.map((item) => skillBoundaryKey(mapRuntimeEvidenceToCavaAction(item)))
  );

  const experiment = evaluateSkillBoundaryExperiment({ cases });

  assert.equal(cases.length, 3);
  assert.equal(keys.size, 1);
  assert.equal(experiment.scoring.exact_control_match_rate, 1);
  assert.equal(experiment.results.every((item) => item.actual.control === 'allow'), true);
});

test('boundary-violating customer email is blocked across all runtimes', () => {
  const cases = SKILL_BOUNDARY_CASES.filter((item) => item.group === 'violation-customer-email');
  const experiment = evaluateSkillBoundaryExperiment({ cases });

  assert.equal(cases.length, 3);
  assert.equal(experiment.scoring.exact_control_match_rate, 1);
  assert.equal(experiment.results.every((item) => item.actual.control === 'block'), true);
  assert.equal(experiment.results.every((item) => item.contract_violations.includes('operation')), true);
  assert.equal(experiment.results.every((item) => item.contract_violations.includes('effect')), true);
  assert.equal(experiment.results.every((item) => item.contract_violations.includes('destination')), true);
});

test('full skill-boundary experiment measures consistent enforcement across runtimes', () => {
  const experiment = evaluateSkillBoundaryExperiment();

  assert.equal(experiment.scoring.total, 15);
  assert.equal(experiment.scoring.passed, 15);
  assert.equal(experiment.scoring.failed, 0);
  assert.equal(experiment.scoring.runtimes, 3);
  assert.equal(experiment.scoring.scenario_groups, 5);
  assert.equal(experiment.scoring.exact_control_match_rate, 1);
  assert.equal(experiment.scoring.allowed_action_pass_rate, 1);
  assert.equal(experiment.scoring.violation_block_rate, 1);
  assert.equal(experiment.scoring.boundary_consistency_rate, 1);
});
