import { canonicalizeAction, sha256, stableJson } from './boundary-core.mjs';

export const ACTION_PASS_SCHEMA_VERSION = 'osuite.action-pass.v0.1';

const CLOCK = '2026-09-20T00:00:00.000Z';
const BASE_POLICY_DIGEST = sha256('policy:support-fast-lane:v1');
const BASE_STATE_DIGEST = sha256('workspace:qqq:policy:support-fast-lane:v1:state:42');

const ACTIONS = {
  supportRead: {
    runtime: 'mcp',
    operation: 'read_support_ticket',
    resource: 'ticket/CASE-1042',
    effect: 'read',
    destination: 'support_workspace',
    identity: 'agent:support-copilot',
    parameters: {
      ticket_id: 'CASE-1042',
      record_count: 1,
      data_classification: 'support_ticket',
    },
    rollback: { available: true, method: 'read-only action' },
  },
  refund73: {
    runtime: 'sdk',
    operation: 'issue_refund',
    resource: 'refund_case/CASE-1042',
    effect: 'transfer',
    destination: 'payment_ledger',
    identity: 'agent:support-copilot',
    parameters: {
      case_id: 'CASE-1042',
      amount_usd: 73,
      record_count: 1,
      data_classification: 'payment_record',
    },
    rollback: { available: true, method: 'finance reversal' },
  },
  internalNote: {
    runtime: 'workflow',
    operation: 'draft_internal_refund_note',
    resource: 'ticket/CASE-1042',
    effect: 'write',
    destination: 'internal_ticket_note',
    identity: 'agent:support-copilot',
    parameters: {
      ticket_id: 'CASE-1042',
      record_count: 1,
      data_classification: 'support_ticket',
    },
    rollback: { available: true, method: 'delete internal note' },
  },
  a2aHandoff: {
    runtime: 'a2a',
    operation: 'handoff_support_context',
    resource: 'ticket/CASE-1042',
    effect: 'notify',
    destination: 'internal_agent:refund-reviewer',
    identity: 'agent:support-copilot',
    parameters: {
      ticket_id: 'CASE-1042',
      record_count: 1,
      data_classification: 'support_ticket',
    },
    rollback: { available: true, method: 'cancel internal handoff' },
  },
};

function actionPolicy(action, overrides = {}) {
  return {
    policy_id: overrides.policy_id || `${action.operation}-policy`,
    policy_version: '2026-09-20',
    policy_digest: overrides.policy_digest || BASE_POLICY_DIGEST,
    approval_id: overrides.approval_id || `approval:${action.operation}:preapproved`,
    approval_digest: sha256(overrides.approval_id || `approval:${action.operation}:preapproved`),
    approval_state: overrides.approval_state || 'preapproved',
    risk_class: overrides.risk_class || 'low',
    scope: {
      operations: [action.operation],
      effects: [action.effect],
      destinations: [action.destination],
      resource_prefixes: [String(action.resource).split('/')[0] + '/'],
      principals: ['support-ops'],
      ...(overrides.scope || {}),
    },
    constraints: {
      max_records: 1,
      max_consumptions: 1,
      requires_local_receipt: true,
      requires_external_verifier: false,
      allows_async_proof_enrichment: true,
      ...(overrides.constraints || {}),
    },
  };
}

export function makeActionPass(overrides = {}) {
  const action = overrides.action || ACTIONS.supportRead;
  const canonical = canonicalizeAction(action);
  const policy = overrides.authority || actionPolicy(action, { policy_digest: overrides.policy_digest });

  return {
    schema_version: ACTION_PASS_SCHEMA_VERSION,
    pass_id: overrides.pass_id || 'ap_support_1042_fast_lane',
    issuer: {
      issuer_id: 'osuite-workspace:qqq',
      issuer_type: 'osuite_workspace',
      key_id: 'osuite-local-gate-2026-09',
      ...(overrides.issuer || {}),
    },
    issued_at: overrides.issued_at || CLOCK,
    expires_at: overrides.expires_at || '2026-09-20T00:10:00.000Z',
    subject: {
      workspace_id: 'workspace:qqq',
      agent_id: 'agent:support-copilot',
      principal: 'support-ops',
      runtime_session_id: 'session:suica-runtime-001',
      ...(overrides.subject || {}),
    },
    canonical_action: {
      profile: 'cava.action.v1',
      action_hash: canonical.fingerprint,
      operation: canonical.normalized.operation,
      effect: canonical.normalized.effect,
      resource: canonical.normalized.resource,
      destination: canonical.normalized.destination,
      data_boundary: canonical.normalized.parameters.data_classification || 'unspecified',
      ...(overrides.canonical_action || {}),
    },
    authority: policy,
    commit_conditions: {
      state_digest: overrides.state_digest || BASE_STATE_DIGEST,
      state_version: overrides.state_version || 'state:42',
      nonce: overrides.nonce || `nonce:${action.operation}:1042`,
      replay_scope: overrides.replay_scope || 'single_use',
      fast_path_eligible: overrides.fast_path_eligible ?? true,
      local_commit_profile: 'deterministic-local-gate',
      slow_path_reason_if_failed: 'refresh pass or route to reviewer',
      ...(overrides.commit_conditions || {}),
    },
    receipt: {
      receipt_profile: 'osuite.minimum-commit-receipt.v0.1',
      minimum_fields: [
        'pass_id',
        'action_hash',
        'policy_digest',
        'state_digest',
        'nonce',
        'commit_result',
        'receipt_sequence',
      ],
      async_enrichment: [
        'runtime_trace',
        'proof_bundle',
        'external_verifier_refs',
        'operator_replay_view',
      ],
      ...(overrides.receipt || {}),
    },
    signature: {
      algorithm: 'ed25519-simulated',
      key_id: 'osuite-local-gate-2026-09',
      value: 'simulated-valid-signature',
      ...(overrides.signature || {}),
    },
  };
}

function runtimeState(overrides = {}) {
  return {
    clock: CLOCK,
    policy_digest: BASE_POLICY_DIGEST,
    signature_state: 'valid',
    nonce_state: 'unused',
    budget_remaining: 3,
    identity_state: 'active',
    tool_schema_state: 'stable',
    proof_enrichment_state: 'available',
    receipt_sink_state: 'available',
    verifier_state: 'not_required',
    ...(overrides || {}),
  };
}

function caseDef(id, title, action, actionPass, runtime, expected) {
  return {
    id,
    title,
    action,
    action_pass: actionPass,
    runtime_state: runtime,
    expected,
  };
}

const refundPolicyDigest = sha256('policy:refund-bounded-fast-lane:v1');
const notePolicyDigest = sha256('policy:support-internal-note:v1');
const a2aPolicyDigest = sha256('policy:a2a-internal-support-handoff:v1');
const criticalPolicyDigest = sha256('policy:refund-critical-slow-lane:v1');

const refundPass = (overrides = {}) => makeActionPass({
  pass_id: overrides.pass_id || 'ap_refund_1042_73usd',
  action: overrides.action || ACTIONS.refund73,
  policy_digest: refundPolicyDigest,
  state_digest: sha256('workspace:qqq:policy:refund-bounded-fast-lane:v1:state:10'),
  authority: actionPolicy(overrides.action || ACTIONS.refund73, {
    policy_id: 'refund-bounded-fast-lane',
    policy_digest: refundPolicyDigest,
    approval_id: 'approval:refund-case-1042-73usd',
    approval_state: 'approved',
    risk_class: 'medium',
    constraints: {
      max_amount_usd: 100,
      max_records: 1,
      max_consumptions: 1,
      requires_local_receipt: true,
      requires_external_verifier: false,
      allows_async_proof_enrichment: true,
      ...(overrides.constraints || {}),
    },
  }),
  ...overrides,
});

export const ACTION_PASS_LANE_CASES = [
  caseDef(
    'fast-mcp-read-support-ticket',
    'MCP support read consumes a fresh bounded pass',
    ACTIONS.supportRead,
    makeActionPass(),
    runtimeState(),
    { lane: 'fast', control: 'allow', receipt_state: 'complete' },
  ),
  caseDef(
    'fast-sdk-bounded-refund',
    'SDK refund action uses a preapproved bounded pass',
    ACTIONS.refund73,
    refundPass(),
    runtimeState({ policy_digest: refundPolicyDigest, budget_remaining: 1 }),
    { lane: 'fast', control: 'allow', receipt_state: 'complete' },
  ),
  caseDef(
    'fast-workflow-note-proof-enrichment-down',
    'Workflow note commits with a minimum receipt while proof enrichment is delayed',
    ACTIONS.internalNote,
    makeActionPass({
      pass_id: 'ap_internal_note_1042',
      action: ACTIONS.internalNote,
      policy_digest: notePolicyDigest,
      authority: actionPolicy(ACTIONS.internalNote, {
        policy_id: 'support-internal-note',
        policy_digest: notePolicyDigest,
      }),
    }),
    runtimeState({ policy_digest: notePolicyDigest, proof_enrichment_state: 'delayed' }),
    { lane: 'fast', control: 'allow', receipt_state: 'minimum_receipt_only' },
  ),
  caseDef(
    'fast-a2a-internal-handoff',
    'A2A handoff carries the pass but OSuite gates the action',
    ACTIONS.a2aHandoff,
    makeActionPass({
      pass_id: 'ap_a2a_internal_handoff_1042',
      action: ACTIONS.a2aHandoff,
      policy_digest: a2aPolicyDigest,
      authority: actionPolicy(ACTIONS.a2aHandoff, {
        policy_id: 'a2a-internal-support-handoff',
        policy_digest: a2aPolicyDigest,
      }),
    }),
    runtimeState({ policy_digest: a2aPolicyDigest }),
    { lane: 'fast', control: 'allow', receipt_state: 'complete' },
  ),
  caseDef(
    'slow-policy-digest-drift',
    'Policy digest drift moves the action to the slow lane',
    ACTIONS.supportRead,
    makeActionPass(),
    runtimeState({ policy_digest: sha256('policy:support-fast-lane:v2') }),
    { lane: 'slow', control: 'require_review', receipt_state: 'not_committed' },
  ),
  caseDef(
    'slow-tool-schema-drift',
    'Tool schema drift requires pass refresh before local commit',
    ACTIONS.supportRead,
    makeActionPass(),
    runtimeState({ tool_schema_state: 'changed' }),
    { lane: 'slow', control: 'require_review', receipt_state: 'not_committed' },
  ),
  caseDef(
    'slow-missing-required-evidence',
    'Missing amount evidence prevents bounded refund from local commit',
    { ...ACTIONS.refund73, parameters: { case_id: 'CASE-1042', record_count: 1, data_classification: 'payment_record' } },
    refundPass({ pass_id: 'ap_refund_missing_amount', constraints: { required_parameters: ['amount_usd'] } }),
    runtimeState({ policy_digest: refundPolicyDigest, budget_remaining: 1 }),
    { lane: 'slow', control: 'require_review', receipt_state: 'not_committed' },
  ),
  caseDef(
    'slow-external-verifier-not-warmed',
    'Verifier-required action waits when the verifier is not prepared',
    ACTIONS.refund73,
    refundPass({ pass_id: 'ap_refund_verifier_required', constraints: { requires_external_verifier: true } }),
    runtimeState({ policy_digest: refundPolicyDigest, budget_remaining: 1, verifier_state: 'not_warmed' }),
    { lane: 'slow', control: 'require_review', receipt_state: 'not_committed' },
  ),
  caseDef(
    'slow-critical-not-fast-eligible',
    'Critical action without a fast-lane profile routes to slow governance',
    { ...ACTIONS.refund73, parameters: { ...ACTIONS.refund73.parameters, amount_usd: 5000 } },
    makeActionPass({
      pass_id: 'ap_critical_refund_no_fast_lane',
      action: { ...ACTIONS.refund73, parameters: { ...ACTIONS.refund73.parameters, amount_usd: 5000 } },
      policy_digest: criticalPolicyDigest,
      fast_path_eligible: false,
      authority: actionPolicy({ ...ACTIONS.refund73, parameters: { ...ACTIONS.refund73.parameters, amount_usd: 5000 } }, {
        policy_id: 'refund-critical-slow-lane',
        policy_digest: criticalPolicyDigest,
        approval_state: 'requires_review',
        risk_class: 'critical',
        constraints: {
          max_amount_usd: 10000,
          max_records: 1,
          max_consumptions: 1,
          requires_local_receipt: true,
          requires_external_verifier: true,
          allows_async_proof_enrichment: false,
        },
      }),
    }),
    runtimeState({ policy_digest: criticalPolicyDigest, budget_remaining: 1, verifier_state: 'warmed' }),
    { lane: 'slow', control: 'require_review', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-action-hash-mismatch',
    'Changed destination invalidates the pass',
    { ...ACTIONS.supportRead, effect: 'notify', destination: 'external_email' },
    makeActionPass(),
    runtimeState(),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-expired-pass',
    'Expired pass fails closed instead of asking the agent again',
    ACTIONS.supportRead,
    makeActionPass({ pass_id: 'ap_expired_support_read', expires_at: '2026-09-19T23:59:59.000Z' }),
    runtimeState(),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-consumed-nonce',
    'Duplicate pass consumption fails closed',
    ACTIONS.supportRead,
    makeActionPass({ pass_id: 'ap_duplicate_support_read' }),
    runtimeState({ nonce_state: 'consumed' }),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-identity-revoked',
    'Revoked agent identity fails closed at the gate',
    ACTIONS.supportRead,
    makeActionPass(),
    runtimeState({ identity_state: 'revoked' }),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-budget-exhausted',
    'Budget exhaustion fails closed before a transfer can commit',
    ACTIONS.refund73,
    refundPass({ pass_id: 'ap_refund_budget_exhausted' }),
    runtimeState({ policy_digest: refundPolicyDigest, budget_remaining: 0 }),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-receipt-sink-down',
    'Minimum receipt failure blocks execution',
    ACTIONS.supportRead,
    makeActionPass(),
    runtimeState({ receipt_sink_state: 'down' }),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
  caseDef(
    'block-invalid-signature',
    'Invalid issuer signature fails closed',
    ACTIONS.supportRead,
    makeActionPass({ pass_id: 'ap_invalid_signature' }),
    runtimeState({ signature_state: 'invalid' }),
    { lane: 'block', control: 'block', receipt_state: 'not_committed' },
  ),
];

function normalizeSet(values = []) {
  return new Set(Array.isArray(values) ? values : []);
}

function withinAnyPrefix(value, prefixes = []) {
  if (!prefixes.length) return true;
  return prefixes.some((prefix) => String(value || '').startsWith(prefix));
}

function missingRequiredParameters(action, pass) {
  const configured = pass?.authority?.constraints?.required_parameters;
  const required = Array.isArray(configured) ? configured : [];
  const parameters = action.normalized.parameters || {};
  return required.filter((field) => parameters[field] === undefined || parameters[field] === null || parameters[field] === '');
}

function amountWithinBudget(action, pass) {
  const limit = Number(pass?.authority?.constraints?.max_amount_usd);
  if (!Number.isFinite(limit)) return true;
  const amount = Number(action.normalized.parameters?.amount_usd);
  return Number.isFinite(amount) && amount <= limit;
}

function recordsWithinBudget(action, pass) {
  const limit = Number(pass?.authority?.constraints?.max_records);
  if (!Number.isFinite(limit)) return true;
  const count = Number(action.normalized.parameters?.record_count ?? 1);
  return Number.isFinite(count) && count <= limit;
}

function timeState(clock, pass) {
  const now = new Date(clock || CLOCK).getTime();
  const issued = new Date(pass?.issued_at || 0).getTime();
  const expires = new Date(pass?.expires_at || 0).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(issued) || !Number.isFinite(expires)) return 'invalid_time';
  if (now < issued) return 'not_yet_valid';
  if (now >= expires) return 'expired';
  return 'fresh';
}

function buildReceipt(action, pass, lane, receiptState) {
  if (lane !== 'fast') return null;
  const receiptPayload = {
    pass_id: pass.pass_id,
    action_hash: action.fingerprint,
    policy_digest: pass.authority.policy_digest,
    state_digest: pass.commit_conditions.state_digest,
    nonce: pass.commit_conditions.nonce,
    commit_result: 'allow',
    receipt_sequence: 1,
    receipt_state: receiptState,
  };
  return {
    ...receiptPayload,
    receipt_hash: sha256(stableJson(receiptPayload)),
  };
}

export function evaluateActionPassCase(caseItem = {}) {
  const pass = caseItem.action_pass;
  const action = canonicalizeAction(caseItem.action || {});
  const runtime = caseItem.runtime_state || {};
  const blockers = [];
  const slowReasons = [];

  if (!pass) {
    blockers.push('missing_action_pass');
  } else {
    if (pass.schema_version !== ACTION_PASS_SCHEMA_VERSION) blockers.push('unsupported_pass_schema');
    if (runtime.signature_state !== 'valid') blockers.push('invalid_signature');
    if (pass.authority?.approval_state === 'denied') blockers.push('approval_denied');

    const time = timeState(runtime.clock, pass);
    if (time !== 'fresh') blockers.push(`pass_${time}`);

    if (runtime.identity_state === 'revoked') blockers.push('identity_revoked');
    if (runtime.nonce_state === 'consumed') blockers.push('nonce_replay');
    if (runtime.receipt_sink_state === 'down' && pass.authority?.constraints?.requires_local_receipt) {
      blockers.push('minimum_receipt_unavailable');
    }

    const scope = pass.authority?.scope || {};
    if (!normalizeSet(scope.operations).has(action.normalized.operation)) blockers.push('operation_out_of_scope');
    if (!normalizeSet(scope.effects).has(action.normalized.effect)) blockers.push('effect_out_of_scope');
    if (!normalizeSet(scope.destinations).has(action.normalized.destination)) blockers.push('destination_out_of_scope');
    if (!normalizeSet(scope.principals).has(pass.subject?.principal)) blockers.push('principal_out_of_scope');
    if (!withinAnyPrefix(action.normalized.resource, scope.resource_prefixes || [])) blockers.push('resource_out_of_scope');
    if (pass.subject?.agent_id && pass.subject.agent_id !== action.normalized.identity) blockers.push('agent_identity_mismatch');
    const missing = missingRequiredParameters(action, pass);
    if (!missing.length && pass.canonical_action?.action_hash !== action.fingerprint) blockers.push('action_hash_mismatch');
    if (!missing.length && !amountWithinBudget(action, pass)) blockers.push('amount_constraint_exceeded_or_missing');
    if (!recordsWithinBudget(action, pass)) blockers.push('record_constraint_exceeded_or_missing');
    if (Number(runtime.budget_remaining ?? 0) <= 0) blockers.push('budget_exhausted');

    if (missing.length) slowReasons.push(`missing_required_evidence:${missing.join(',')}`);
    if (runtime.policy_digest !== pass.authority?.policy_digest) slowReasons.push('policy_digest_drift');
    if (runtime.tool_schema_state && runtime.tool_schema_state !== 'stable') slowReasons.push('tool_schema_drift');
    if (runtime.nonce_state === 'unknown') slowReasons.push('nonce_cache_unavailable');
    if (pass.authority?.constraints?.requires_external_verifier && runtime.verifier_state !== 'warmed') {
      slowReasons.push('external_verifier_not_prepared');
    }
    if (!pass.commit_conditions?.fast_path_eligible) slowReasons.push('not_fast_path_eligible');
    if (['high', 'critical'].includes(pass.authority?.risk_class) && pass.authority?.approval_state !== 'approved') {
      slowReasons.push('high_risk_requires_review');
    }
  }

  const receiptState = runtime.proof_enrichment_state === 'delayed'
    ? 'minimum_receipt_only'
    : 'complete';
  const lane = blockers.length ? 'block' : slowReasons.length ? 'slow' : 'fast';
  const control = lane === 'fast' ? 'allow' : lane === 'slow' ? 'require_review' : 'block';
  const receipt = buildReceipt(action, pass, lane, receiptState);
  const expected = caseItem.expected || {};
  const passResult = lane === expected.lane
    && control === expected.control
    && (expected.receipt_state ? (receipt?.receipt_state || 'not_committed') === expected.receipt_state : true);

  return {
    id: caseItem.id,
    title: caseItem.title,
    pass: passResult,
    expected,
    actual: {
      lane,
      control,
      blockers,
      slow_reasons: slowReasons,
      receipt_state: receipt?.receipt_state || 'not_committed',
      receipt,
    },
    action: action.normalized,
    action_hash: action.fingerprint,
    pass_id: pass?.pass_id || null,
    runtime: action.normalized.runtime,
  };
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function scoreActionPassLaneResults(results) {
  const total = results.length;
  const passed = results.filter((result) => result.pass).length;
  const fast = results.filter((result) => result.actual.lane === 'fast');
  const slow = results.filter((result) => result.actual.lane === 'slow');
  const blocked = results.filter((result) => result.actual.lane === 'block');
  const expectedAllowed = results.filter((result) => result.expected.control === 'allow');
  const fastAllowed = results.filter((result) => result.actual.lane === 'fast' && result.actual.control === 'allow');
  const falseFastAllows = results.filter((result) => (
    result.expected.control !== 'allow'
    && result.actual.lane === 'fast'
    && result.actual.control === 'allow'
  ));
  const minimumReceiptOnly = results.filter((result) => result.actual.receipt_state === 'minimum_receipt_only');
  const receipts = results.filter((result) => result.actual.receipt);

  return {
    total_cases: total,
    passed,
    failed: total - passed,
    exact_match_rate: percent(passed, total),
    fast_path_coverage: percent(fast.length, total),
    slow_path_rate: percent(slow.length, total),
    fail_closed_rate: percent(blocked.length, total),
    zero_wait_ratio: percent(fastAllowed.length, total),
    safety_preserving_fast_path_coverage: percent(fastAllowed.length, expectedAllowed.length),
    false_fast_allow_rate: percent(falseFastAllows.length, total),
    minimum_receipt_only_rate: percent(minimumReceiptOnly.length, total),
    receipt_emission_rate: percent(receipts.length, fast.length),
    distributions: {
      lanes: countBy(results.map((result) => result.actual.lane)),
      controls: countBy(results.map((result) => result.actual.control)),
      receipt_states: countBy(results.map((result) => result.actual.receipt_state)),
      blockers: countBy(results.flatMap((result) => result.actual.blockers.length ? result.actual.blockers : ['none'])),
      slow_reasons: countBy(results.flatMap((result) => result.actual.slow_reasons.length ? result.actual.slow_reasons : ['none'])),
    },
  };
}

function expandWorkloadMix(cases) {
  const weights = new Map([
    ['fast-mcp-read-support-ticket', 40],
    ['fast-workflow-note-proof-enrichment-down', 25],
    ['fast-a2a-internal-handoff', 12],
    ['fast-sdk-bounded-refund', 10],
    ['slow-policy-digest-drift', 4],
    ['slow-tool-schema-drift', 3],
    ['slow-missing-required-evidence', 3],
    ['slow-external-verifier-not-warmed', 2],
    ['block-action-hash-mismatch', 1],
  ]);
  return cases.flatMap((caseItem) => (
    Array.from({ length: weights.get(caseItem.id) || 0 }, (_unused, index) => ({
      ...caseItem,
      id: `${caseItem.id}-mix-${String(index + 1).padStart(3, '0')}`,
    }))
  ));
}

export function evaluateActionPassLaneBenchmark() {
  const results = ACTION_PASS_LANE_CASES.map(evaluateActionPassCase);
  const workloadResults = expandWorkloadMix(ACTION_PASS_LANE_CASES).map(evaluateActionPassCase);
  return {
    benchmark: 'osuite-action-pass-lane-benchmark',
    schema_version: ACTION_PASS_SCHEMA_VERSION,
    description: 'Reference benchmark for classifying OSuite Action Pass decisions into fast lane, slow lane, or fail-closed outcomes.',
    boundary: 'Lane classification and critical-path model. Not a production latency claim.',
    action_pass_schema: 'schemas/action-pass.schema.json',
    cases: ACTION_PASS_LANE_CASES.length,
    scoring: scoreActionPassLaneResults(results),
    workload_mix: {
      description: 'A deterministic common-path mix that weights ordinary bounded actions more heavily than injected drift and fail-closed cases.',
      records: workloadResults.length,
      scoring: scoreActionPassLaneResults(workloadResults),
    },
    results,
  };
}
