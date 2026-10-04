import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_BOUNDARY_V3_CASES,
  NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS,
  evaluateSkillBoundaryV3Case,
  mapRuntimeEvidenceToNeutralActionV3,
} from '../lib/skill-boundary-v3-core.mjs';
import {
  authorizeNeutralActionV31,
  evaluateSkillBoundaryV31Case as evaluateUnderTest,
} from '../lib/skill-boundary-v3.1-core.mjs';
import { buildDevelopmentReport, scoreDevelopmentRecords } from '../scripts/run-skill-boundary-v3.1-experiment.mjs';

// Authored neutral input: deliberately independent of the reference mapper.
const REFUND = {
  operation: 'issue_refund', effect: 'transfer', resource: 'refund_case/CASE-1042',
  destination: 'payment_ledger', identity: 'skill:refund-ops:v3',
  parameters: { data_classification: 'payment_record', amount_usd: 73, record_count: 1 },
};
const complete = { status: 'complete', missing_fields: [] };
function request(overrides = {}) {
  return {
    contract: structuredClone(NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS.refund_operations),
    action: structuredClone(REFUND), evidence: structuredClone(complete),
    runtime_authorization: {}, ...overrides,
  };
}
function refundRule(input) {
  return input.contract.requested_authority.operations.find((rule) => rule.operation === 'issue_refund');
}

for (const original of SKILL_BOUNDARY_V3_CASES.filter((item) => item.group === 'refund-over-contract-limit')) {
  test(`SB-01: ${original.runtime} runtime 1000 cannot widen skill 100 for action 125`, () => {
    const input = structuredClone(original);
    input.runtime_authorization = { narrowed_constraints: { issue_refund: { amount_usd_lte: 1000 } } };
    assert.equal(evaluateUnderTest(input).authorization.actual_control, 'block');
  });
}

test('legacy v3 remains explicitly unchanged', () => {
  const input = structuredClone(SKILL_BOUNDARY_V3_CASES.find((item) => item.group === 'refund-over-contract-limit'));
  input.runtime_authorization = { narrowed_constraints: { issue_refund: { amount_usd_lte: 1000 } } };
  assert.equal(evaluateSkillBoundaryV3Case(input).authorization.actual_control, 'allow');
});

for (const [maximum, amount, expected] of [
  [1000, 125, 'block'], [1000, 100, 'allow'], [75, 90, 'block'],
  [75, 75, 'allow'], [75, 75.01, 'block'], [0, 0, 'allow'],
  [0, 0.01, 'block'], [0.1, 0.1, 'allow'], [0.1, 0.11, 'block'],
]) {
  test(`intersection and exact USD cents: runtime ${maximum}, action ${amount} -> ${expected}`, () => {
    const input = request({ runtime_authorization: { narrowed_constraints: { issue_refund: { amount_usd_lte: maximum } } } });
    input.action.parameters.amount_usd = amount;
    const before = structuredClone(input);
    assert.equal(authorizeNeutralActionV31(input).actual_control, expected);
    assert.deepEqual(input, before);
  });
}

test('monotonicity on a bounded USD grid; broadening runtime never exceeds skill', () => {
  for (const amount of [0, 0.01, 50, 75, 75.01, 100, 100.01, 125]) {
    for (const limit of [0, 50, 75, 100, 1000]) {
      const input = request({ runtime_authorization: { narrowed_constraints: { issue_refund: { amount_usd_lte: limit } } } });
      input.action.parameters.amount_usd = amount;
      assert.equal(authorizeNeutralActionV31(input).actual_control, amount <= Math.min(limit, 100) ? 'allow' : 'block');
    }
  }
});

test('max_records also intersects and exact zero is meaningful', () => {
  const input = request({ runtime_authorization: { narrowed_constraints: { issue_refund: { max_records: 100 } } } });
  input.action.parameters.record_count = 2;
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
  input.runtime_authorization.narrowed_constraints.issue_refund.max_records = 0;
  input.action.parameters.record_count = 0;
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'allow');
});

test('complete tuples are disjunctions, never a Cartesian product', () => {
  const input = request();
  const first = structuredClone(refundRule(input));
  const second = { ...structuredClone(first), effect: 'read', destination: 'support_workspace' };
  input.contract.requested_authority.operations = [first, second];
  input.action.destination = 'support_workspace';
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
  input.action.effect = 'read';
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'allow');
});

test('empty operation or principal intersections deny', () => {
  for (const policy of [
    { allowed_operations: [] }, { allowed_operations: ['read_document'] },
    { allowed_principals: [] }, { allowed_principals: ['other:principal'] },
  ]) assert.equal(authorizeNeutralActionV31(request({ runtime_authorization: policy })).actual_control, 'block');
});

test('applicable policy deny dominates missing amount; review is never allow', () => {
  const input = request({ runtime_authorization: { denied_operations: ['issue_refund'] } });
  delete input.action.parameters.amount_usd;
  input.evidence = { status: 'missing', missing_fields: ['amount_usd'] };
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
  input.runtime_authorization = {};
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
});

test('known applicable explicit denial dominates absent or malformed evidence metadata', () => {
  for (const evidence of [undefined, null, {}, 'unknown', { status: 'missing' }, { status: 'complete', missing_fields: null }]) {
    const input = request({ evidence, runtime_authorization: { denied_operations: ['issue_refund'] } });
    const result = authorizeNeutralActionV31(input);
    assert.equal(result.actual_control, 'block', JSON.stringify(evidence));
    assert.deepEqual(result.reasons, ['operation_denied_by_runtime']);
  }
});

test('unknown action does not establish applicability of an operation denial', () => {
  for (const action of [undefined, null, {}, { operation: '' }, { operation: null }, { operation: 7 }]) {
    const input = request({ action, evidence: undefined, runtime_authorization: { denied_operations: ['issue_refund'] } });
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
  }
});

test('established tuple violation is not erased by unrelated missing amount', () => {
  const input = request();
  input.action.destination = 'external_email';
  delete input.action.parameters.amount_usd;
  input.evidence = { status: 'missing', missing_fields: ['amount_usd'] };
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
});

for (const evidence of [undefined, {}, { status: 'unmapped' }, { status: 'ambiguous' }, { status: 'contradictory' }, { status: 'untrusted' }]) {
  test(`unresolved evidence ${JSON.stringify(evidence)} withholds admission`, () => {
    assert.equal(authorizeNeutralActionV31(request({ evidence })).actual_control, 'require_review');
  });
}

test('missing required neutral fields and unsupported currency do not execute', () => {
  for (const field of ['operation', 'effect', 'resource', 'destination', 'identity']) {
    const input = request();
    delete input.action[field];
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review', field);
  }
  const input = request();
  input.action.parameters.currency = 'EUR';
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
  input.action.parameters.currency = 'USD';
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'allow');
});

for (const invalid of [null, undefined, '75', -1, NaN, Infinity, true, 0.001, Number.MAX_SAFE_INTEGER]) {
  test(`invalid monetary bound ${String(invalid)} rejects configuration on either side`, () => {
    for (const side of ['requested', 'runtime']) {
      const input = request();
      if (side === 'requested') refundRule(input).constraints.amount_usd_lte = invalid;
      else input.runtime_authorization = { narrowed_constraints: { issue_refund: { amount_usd_lte: invalid } } };
      const result = authorizeNeutralActionV31(input);
      assert.equal(result.actual_control, 'block');
      assert.equal(result.outcome, 'invalid_configuration');
    }
  });
}

test('invalid action amounts are unresolved evidence, never coerced or rounded', () => {
  for (const amount of [undefined, null, '73', -1, NaN, Infinity, 0.001, 0.1 + 0.2]) {
    const input = request();
    input.action.parameters.amount_usd = amount;
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
  }
});

test('optional undefined USD amount is absent for a nonmonetary operation, not invalid evidence', () => {
  const input = {
    contract: structuredClone(NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS.document_review),
    action: {
      operation: 'read_document', effect: 'read', resource: 'document/DOC-77',
      destination: 'document_workspace', identity: 'skill:document-review:v3',
      parameters: { data_classification: 'internal_document', record_count: 1 },
    },
    evidence: structuredClone(complete), runtime_authorization: {},
  };
  const absent = authorizeNeutralActionV31(input);
  assert.equal(absent.actual_control, 'allow');
  input.action.parameters.amount_usd = undefined;
  assert.deepEqual(authorizeNeutralActionV31(input), absent);
  for (const value of [null, '73', NaN, -1, 0.001]) {
    input.action.parameters.amount_usd = value;
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
  }
  input.action.parameters.amount_usd = undefined;
  input.runtime_authorization = { narrowed_constraints: { read_document: { amount_usd_lte: 100 } } };
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
});

for (const input of SKILL_BOUNDARY_V3_CASES.filter((item) => ['document-allowed-read', 'document-allowed-internal-summary'].includes(item.group))) {
  test(`optional amount placeholder does not suppress ${input.group} in ${input.runtime}`, () => {
    const mapped = mapRuntimeEvidenceToNeutralActionV3(input);
    assert.equal(Object.hasOwn(mapped.action.parameters, 'amount_usd'), true);
    assert.equal(mapped.action.parameters.amount_usd, undefined);
    assert.equal(evaluateUnderTest(input).authorization.actual_control, 'allow');
  });
}

test('invalid or unsupported restrictions fail closed rather than disappearing', () => {
  for (const policy of [
    null, [], { allowed_operations: null }, { denied_operations: 'issue_refund' },
    { narrowed_constraints: { issue_refund: { max_records: 0.5 } } },
    { narrowed_constraints: { issue_refund: { external_egress: 'false' } } },
    { narrowed_constraints: { issue_refund: { amount_usd_gte: 150 } } },
    { narrowed_constraints: { typo_operation: { amount_usd_lte: 1 } } },
    { unknown_policy_field: true },
  ]) {
    const result = authorizeNeutralActionV31(request({ runtime_authorization: policy }));
    assert.equal(result.actual_control, 'block');
    assert.equal(result.outcome, 'invalid_configuration');
  }
});

test('external-egress prohibition cannot be widened by true', () => {
  const input = request({ runtime_authorization: { narrowed_constraints: { issue_refund: { external_egress: true } } } });
  input.action.parameters.external_egress = true;
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
});

test('known external destination cannot be hidden by external_egress false', () => {
  for (const destination of ['external_email', 'customer_email']) {
    const input = request();
    refundRule(input).destination = destination;
    input.action.destination = destination;
    input.action.parameters.external_egress = false;
    const result = authorizeNeutralActionV31(input);
    assert.equal(result.actual_control, 'block', destination);
    assert.deepEqual(result.reasons, ['external_egress_not_requested']);
  }
});

test('unknown destination with unresolved egress evidence stays review-only', () => {
  for (const flag of [undefined, null, 'false']) {
    const input = request();
    refundRule(input).destination = 'unclassified_receiver';
    input.action.destination = 'unclassified_receiver';
    input.action.parameters.external_egress = flag;
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
  }
});

test('runtime-required evidence is unioned, never removes requested evidence', () => {
  const input = request({ runtime_authorization: { required_evidence: { issue_refund: [] } } });
  delete input.action.parameters.amount_usd;
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
  input.action.parameters.amount_usd = 73;
  input.runtime_authorization.required_evidence.issue_refund = ['recipient_domain'];
  assert.equal(authorizeNeutralActionV31(input).actual_control, 'require_review');
});

test('resource namespace matching rejects traversal, aliases and extra segments', () => {
  for (const resource of ['refund_case/', 'refund_case/../CASE-1042', 'refund_case/CASE-1042/child', 'refund_case/%2e%2e', 'other/CASE-1042']) {
    const input = request();
    input.action.resource = resource;
    assert.equal(authorizeNeutralActionV31(input).actual_control, 'block');
  }
});

test('unknown mapping reviews and scorer labels never enter the mapper', () => {
  const input = structuredClone(SKILL_BOUNDARY_V3_CASES.find((item) => item.runtime === 'mcp'));
  input.evidence.tool_name = 'unknown.tool';
  const result = evaluateUnderTest(input, { mapper: (safeInput) => {
    assert.deepEqual(Object.keys(safeInput).sort(), ['evidence', 'runtime', 'skill_family']);
    return mapRuntimeEvidenceToNeutralActionV3(safeInput);
  } });
  assert.equal(result.authorization.actual_control, 'require_review');
});

test('mapper fault changes pipeline but cannot change oracle-input authorization', () => {
  const input = structuredClone(SKILL_BOUNDARY_V3_CASES.find((item) => item.group === 'refund-allowed-bounded-transfer'));
  const oracle = { action: structuredClone(REFUND), evidence: structuredClone(complete) };
  const normal = evaluateUnderTest(input, { oracle });
  const mutated = evaluateUnderTest(input, { oracle, mapper: (safeInput) => {
    const mapped = mapRuntimeEvidenceToNeutralActionV3(safeInput);
    mapped.action.parameters.amount_usd = 125;
    return mapped;
  } });
  assert.equal(normal.authorization.actual_control, 'allow');
  assert.equal(mutated.authorization.actual_control, 'block');
  assert.deepEqual(mutated.oracle_authorization, normal.oracle_authorization);
  assert.equal(mutated.oracle_authorization.actual_control, 'allow');
  assert.deepEqual(oracle.action, REFUND);
});

test('mapped entry point does not discard an explicitly invalid runtime policy', () => {
  const input = structuredClone(SKILL_BOUNDARY_V3_CASES[0]);
  input.runtime_authorization = null;
  assert.equal(evaluateUnderTest(input).authorization.outcome, 'invalid_configuration');
});

for (const input of SKILL_BOUNDARY_V3_CASES.filter((item) => item.group === 'document-missing-document-id')) {
  test(`${input.runtime} missing document ID is unresolved, not a fabricated resource`, () => {
    const result = evaluateUnderTest(input);
    assert.equal(result.mapping.action.resource, null);
    assert.equal(result.mapping.action_fingerprint, null);
    assert.equal(result.authorization.actual_control, 'require_review');
    assert.equal(mapRuntimeEvidenceToNeutralActionV3(input).action.resource, 'document/unknown');
  });
}

test('development report retains independent resource uncertainty and all records', () => {
  const report = buildDevelopmentReport();
  assert.equal(report.records.length, 52);
  assert.equal(report.scoring.mapping.correct, 52);
  assert.equal(report.scoring.oracle_authorization.correct, 52);
  assert.equal(report.scoring.mapped_pipeline.correct, 52);
  assert.deepEqual(scoreDevelopmentRecords(report.records), report.scoring);
  for (const row of report.records.filter((item) => item.variant === 'SB-01-runtime-widening')) {
    assert.equal(row.prediction.authorization.actual_control, 'block');
  }
});

test('scorer exposes mapper faults without changing oracle authorization scores', () => {
  const normal = buildDevelopmentReport();
  const broken = buildDevelopmentReport({ mapper: (input) => {
    const mapped = mapRuntimeEvidenceToNeutralActionV3(input);
    if (mapped.action) mapped.action.destination = 'external_email';
    return mapped;
  } });
  assert.ok(broken.scoring.mapping.correct < normal.scoring.mapping.correct);
  assert.ok(broken.scoring.mapped_pipeline.correct < normal.scoring.mapped_pipeline.correct);
  assert.deepEqual(broken.scoring.oracle_authorization, normal.scoring.oracle_authorization);
});

test('offline scorer exposes decision faults, missing results and invalid configuration', () => {
  const report = buildDevelopmentReport();
  const original = structuredClone(report.scoring);
  report.records[0].prediction.oracle_authorization.actual_control = 'block';
  report.records[0].prediction.authorization = null;
  const blockRow = report.records.find((row) => row.oracle.expected_control === 'block');
  blockRow.prediction.authorization.outcome = 'invalid_configuration';
  const rescored = scoreDevelopmentRecords(report.records);
  assert.equal(rescored.oracle_authorization.correct, original.oracle_authorization.correct - 1);
  assert.equal(rescored.mapped_pipeline.correct, original.mapped_pipeline.correct - 2);
  assert.deepEqual(rescored.mapping, original.mapping);
});
