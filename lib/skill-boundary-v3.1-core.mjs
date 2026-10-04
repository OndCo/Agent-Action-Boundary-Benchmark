import {
  NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS,
  mapRuntimeEvidenceToNeutralActionV3,
} from './skill-boundary-v3-core.mjs';

export const AUTHORIZATION_PROFILE_V31 = 'skill-boundary-authorization.v3.1-development';
const CONSTRAINTS = new Set(['amount_usd_lte', 'max_records', 'external_egress']);
const POLICY_FIELDS = new Set(['denied_operations', 'allowed_operations', 'allowed_principals', 'narrowed_constraints', 'required_evidence', 'note']);
const INTERNAL_DESTINATIONS = new Set(['payment_ledger', 'support_workspace', 'internal_ticket_note', 'document_workspace', 'internal_summary_workspace']);
const own = (value, key) => Object.hasOwn(value, key);
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value) => typeof value === 'string' && value.length > 0;
const strings = (value) => Array.isArray(value) && value.every(nonempty);

// USD is explicit in amount_usd. Decimal text is converted exactly, not rounded.
function cents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const parts = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!parts) return null;
  const result = BigInt(parts[1]) * 100n + BigInt((parts[2] || '').padEnd(2, '0'));
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? result : null;
}

function validConstraints(value) {
  if (!record(value) || Object.keys(value).some((key) => !CONSTRAINTS.has(key))) return false;
  if (own(value, 'amount_usd_lte') && cents(value.amount_usd_lte) === null) return false;
  if (own(value, 'max_records') && (!Number.isSafeInteger(value.max_records) || value.max_records < 0)) return false;
  return !own(value, 'external_egress') || typeof value.external_egress === 'boolean';
}

function resourceField(resource) {
  if (!record(resource) || !nonempty(resource.type) || !/^[a-z][a-z0-9_-]*\/$/.test(resource.prefix)) return null;
  if (typeof resource.pattern !== 'string' || !resource.pattern.startsWith(resource.prefix)) return null;
  return resource.pattern.slice(resource.prefix.length).match(/^\{([a-z][a-z0-9_]*)\}$/)?.[1] || null;
}

function invalidConfiguration(contract, runtime) {
  if (!record(contract) || contract.schema_version !== 'skill-boundary-contract.v3'
    || !strings(contract.requested_principals) || !contract.requested_principals.length
    || !record(contract.requested_authority) || !Array.isArray(contract.requested_authority.operations)
    || !contract.requested_authority.operations.length) return 'invalid_contract';
  for (const rule of contract.requested_authority.operations) {
    if (!record(rule) || !['operation', 'effect', 'destination', 'data_class'].every((key) => nonempty(rule[key]))
      || !resourceField(rule.resource) || !strings(rule.required_evidence)
      || !validConstraints(own(rule, 'constraints') ? rule.constraints : {})) return 'invalid_operation_tuple';
  }
  if (!record(runtime) || Object.keys(runtime).some((key) => !POLICY_FIELDS.has(key))) return 'invalid_runtime_policy';
  for (const key of ['allowed_operations', 'denied_operations', 'allowed_principals']) {
    if (own(runtime, key) && !strings(runtime[key])) return `invalid_${key}`;
  }
  const names = new Set(contract.requested_authority.operations.map((rule) => rule.operation));
  for (const key of ['narrowed_constraints', 'required_evidence']) {
    if (!own(runtime, key)) continue;
    if (!record(runtime[key])) return `invalid_${key}`;
    for (const [operation, value] of Object.entries(runtime[key])) {
      if (!names.has(operation) || !(key === 'narrowed_constraints' ? validConstraints(value) : strings(value))) return `invalid_${key}`;
    }
  }
  return null;
}

function intersectConstraints(requested, runtime) {
  const result = {};
  for (const key of CONSTRAINTS) {
    const values = [requested, runtime].filter((item) => own(item, key)).map((item) => item[key]);
    if (!values.length) continue;
    result[key] = key === 'external_egress' ? values.every(Boolean) : Math.min(...values);
  }
  return result;
}

function decision(control, reasons, outcome = 'decision') {
  return { profile: AUTHORIZATION_PROFILE_V31, outcome, actual_control: control, reasons: [...new Set(reasons)].sort() };
}

function evidenceValue(action, rule, field) {
  if (field === resourceField(rule.resource)) {
    return typeof action.resource === 'string' && action.resource.startsWith(rule.resource.prefix)
      ? action.resource.slice(rule.resource.prefix.length) : undefined;
  }
  return action.parameters?.[field];
}

function evaluateTuple(action, evidence, rule, runtime) {
  const violations = [];
  const unresolved = [...evidence.missing_fields];
  const params = record(action.parameters) ? action.parameters : {};
  for (const [field, expected] of [['effect', rule.effect], ['destination', rule.destination]]) {
    if (!nonempty(action[field])) unresolved.push(field);
    else if (action[field] !== expected) violations.push(`${field}_mismatch`);
  }
  if (!nonempty(params.data_classification)) unresolved.push('data_classification');
  else if (params.data_classification !== rule.data_class) violations.push('data_class_mismatch');
  if (!nonempty(action.resource)) unresolved.push('resource');
  else if (!action.resource.startsWith(rule.resource.prefix)
    || !/^[A-Za-z0-9_-]+$/.test(action.resource.slice(rule.resource.prefix.length))) violations.push('resource_mismatch');

  const required = new Set([...rule.required_evidence, ...(runtime.required_evidence?.[rule.operation] || [])]);
  for (const field of required) {
    const value = evidenceValue(action, rule, field);
    if (value === undefined || value === null || value === '') unresolved.push(field);
  }
  const constraints = intersectConstraints(rule.constraints || {}, runtime.narrowed_constraints?.[rule.operation] || {});
  if (own(params, 'currency') && params.currency !== 'USD') {
    if (nonempty(params.currency)) violations.push('currency_mismatch');
    else unresolved.push('currency');
  }
  if (own(constraints, 'amount_usd_lte') || (own(params, 'amount_usd') && params.amount_usd !== undefined) || required.has('amount_usd')) {
    const amount = cents(params.amount_usd);
    if (amount === null) unresolved.push('amount_usd');
    else if (own(constraints, 'amount_usd_lte') && amount > cents(constraints.amount_usd_lte)) violations.push('amount_limit_exceeded');
  }
  if (own(constraints, 'max_records') || own(params, 'record_count')) {
    if (!Number.isSafeInteger(params.record_count) || params.record_count < 0) unresolved.push('record_count');
    else if (own(constraints, 'max_records') && params.record_count > constraints.max_records) violations.push('record_limit_exceeded');
  }
  if (constraints.external_egress === false) {
    // Only this small declared destination vocabulary has implicit egress semantics.
    const egress = ['external_email', 'customer_email'].includes(action.destination) ? true
      : own(params, 'external_egress') ? params.external_egress
        : INTERNAL_DESTINATIONS.has(action.destination) ? false : null;
    if (egress === true) violations.push('external_egress_not_requested');
    else if (egress !== false) unresolved.push('external_egress');
  }
  if (violations.length) return decision('block', violations);
  if (unresolved.length || evidence.status === 'missing') return decision('require_review', unresolved.map((field) => `unresolved:${field}`).concat(evidence.status === 'missing' ? ['incomplete_evidence'] : []));
  return decision('allow', []);
}

/** Pure, opt-in decision function. The caller supplies trusted context; no effect executes. */
export function authorizeNeutralActionV31({ contract, action, evidence, runtime_authorization: runtime = {} }) {
  const invalid = invalidConfiguration(contract, runtime);
  if (invalid) return decision('block', [invalid], 'invalid_configuration');
  const principals = contract.requested_principals.filter((item) => !runtime.allowed_principals || runtime.allowed_principals.includes(item));
  const allowed = contract.requested_authority.operations.filter((item) => !runtime.allowed_operations || runtime.allowed_operations.includes(item.operation));
  if (!principals.length || !allowed.length) return decision('block', ['empty_authority_intersection']);
  if (record(action) && nonempty(action.operation) && runtime.denied_operations?.includes(action.operation)) return decision('block', ['operation_denied_by_runtime']);
  if (!record(evidence) || !['complete', 'missing'].includes(evidence.status) || !strings(evidence.missing_fields)) return decision('require_review', ['unresolved_evidence']);
  if (!record(action) || !nonempty(action.operation)) return decision('require_review', ['unresolved:operation']);
  const rules = allowed.filter((rule) => rule.operation === action.operation);
  if (!rules.length) return decision('block', ['operation_not_in_effective_boundary']);
  if (nonempty(action.identity) && !principals.includes(action.identity)) return decision('block', ['identity_mismatch']);
  const evidenceForTuple = { ...evidence, missing_fields: [...evidence.missing_fields, ...(!nonempty(action.identity) ? ['identity'] : [])] };
  const results = rules.map((rule) => evaluateTuple(action, evidenceForTuple, rule, runtime));
  return results.find((item) => item.actual_control === 'allow')
    || results.find((item) => item.actual_control === 'require_review')
    || decision('block', results.flatMap((item) => item.reasons));
}

/** Preserve unresolved identifiers instead of minting a resource named "unknown". */
export function mapRuntimeEvidenceToNeutralActionV31(input) {
  const mapped = mapRuntimeEvidenceToNeutralActionV3(input);
  if (!mapped.action) return mapped;
  const rules = NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS[input.skill_family]?.requested_authority.operations || [];
  const rule = rules.find((item) => item.operation === mapped.action.operation);
  const identifier = rule ? resourceField(rule.resource) : null;
  if (!identifier || !mapped.missing_evidence.includes(identifier)) return mapped;
  return {
    ...mapped,
    action: { ...mapped.action, resource: null },
    action_fingerprint: null,
    mapping_revision: 'unresolved-resource-v3.1',
  };
}

/** The limited legacy parser remains; the default wrapper fixes resource uncertainty. */
export function evaluateSkillBoundaryV31Case(input, { oracle, mapper = mapRuntimeEvidenceToNeutralActionV31 } = {}) {
  const contract = NEUTRAL_SKILL_BOUNDARY_V3_CONTRACTS[input.skill_family];
  const safeInput = structuredClone({ skill_family: input.skill_family, runtime: input.runtime, evidence: input.evidence });
  let mapping;
  try {
    mapping = mapper(safeInput);
  } catch (error) {
    mapping = { action: null, mapping_status: 'unmapped', missing_evidence: [], error: String(error.message) };
  }
  const mappedEvidence = {
    status: mapping.mapping_status === 'mapped' ? 'complete' : mapping.mapping_status === 'mapped_with_missing_evidence' ? 'missing' : 'unmapped',
    missing_fields: mapping.missing_evidence,
  };
  const context = { contract, runtime_authorization: own(input, 'runtime_authorization') ? input.runtime_authorization : {} };
  return {
    profile: AUTHORIZATION_PROFILE_V31,
    mapping,
    authorization: authorizeNeutralActionV31({ ...context, action: mapping.action, evidence: mappedEvidence }),
    oracle_authorization: oracle ? authorizeNeutralActionV31({ ...context, action: oracle.action, evidence: oracle.evidence }) : null,
  };
}
