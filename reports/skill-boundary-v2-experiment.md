# Skill Boundary Runtime Consistency Experiment v2

Generated: 2026-08-26T02:31:53.339Z

## Research Question

Can a vendor-neutral skill boundary preserve its intended meaning when mapped into different runtime environments, while a runtime authorization layer can still narrow, deny, or escalate what the skill requests?

## Three-Layer Separation

| Layer | Responsibility | Example |
| --- | --- | --- |
| Skill boundary | Declares what the skill expects or requests to do. | A refund skill requests authority to issue refunds up to USD 100. |
| Runtime authorization | Decides what is actually allowed in this workspace, identity, task, and policy context. | The workspace narrows the refund limit to USD 75, or requires review when amount evidence is missing. |
| CAVA / proof | Represents the concrete runtime action, checks it against the effective boundary, and records replayable evidence. | A USD 73 refund is allowed, a USD 125 refund is blocked, and a missing amount is escalated. |

## Vendor-Neutral Boundary Contract

| Field | Value |
| --- | --- |
| schema_version | skill-boundary-contract.v2 |
| boundary_id | boundary.refund-operations.v2 |
| skill.name | Bounded Refund Operations Skill |
| runtime_lanes | mcp, sdk, shell, workflow |
| requested_authority.operations | read_support_ticket, draft_internal_refund_note, issue_refund |
| requested_authority.effects | read, write, transfer |
| requested_authority.destinations | support_workspace, internal_ticket_note, payment_ledger |
| requested_authority.resource_prefixes | ticket/T-, refund_case/ |
| requested_authority.data_classes | support_ticket, refund_policy, payment_record |
| constraints.max_records | 1 |
| constraints.max_amount_usd | 100 |
| constraints.amount_limited_operations | issue_refund |

The contract intentionally does not contain OSuite-specific field names. OSuite is used here as one reference runtime-governance implementation.

## OSuite / CAVA Reference Mapping

| Neutral boundary | OSuite policy | CAVA action object |
| --- | --- | --- |
| boundary_id | policy.policy_id | action.parameters.skill_boundary_id |
| requested_authority.operations | policy.allowed_operations | action.operation |
| requested_authority.effects | policy.allowed_effects | action.effect |
| requested_authority.destinations | policy.allowed_destinations | action.destination |
| requested_authority.resource_prefixes | policy.allowed_resource_prefixes | action.resource |
| requested_authority.data_classes | policy.allowed_data_classes | action.parameters.data_classification |
| principals.requested_identities | policy.allowed_identities | action.identity |
| constraints.max_records | policy.max_records | action.parameters.record_count |
| constraints.max_amount_usd | policy.max_amount_usd | action.parameters.amount_usd |
| constraints.amount_limited_operations | policy.amount_limited_operations | action.operation |

## Base Policy Produced By The Mapping

```json
{
  "policy_id": "boundary.refund-operations.v2",
  "allowed_operations": [
    "read_support_ticket",
    "draft_internal_refund_note",
    "issue_refund"
  ],
  "allowed_effects": [
    "read",
    "write",
    "transfer"
  ],
  "allowed_destinations": [
    "support_workspace",
    "internal_ticket_note",
    "payment_ledger"
  ],
  "allowed_resource_prefixes": [
    "ticket/T-",
    "refund_case/"
  ],
  "allowed_identities": [
    "skill:refund-ops:v2"
  ],
  "allowed_data_classes": [
    "support_ticket",
    "refund_policy",
    "payment_record"
  ],
  "approval_required": false,
  "max_records": 1,
  "max_amount_usd": 100,
  "amount_limited_operations": [
    "issue_refund"
  ],
  "risk_level": 45,
  "external_egress_allowed": false
}
```

## Results

| Cases | Runtimes | Scenario groups | Exact control match | Allowed pass rate | Violation block rate | Escalation match | Boundary consistency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 32 | 4 | 8 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |

## Scenario Consistency

| Scenario group | Runtimes | Cases | Expected | Observed | Boundary keys | Consistent |
| --- | --- | --- | --- | --- | --- | --- |
| allowed-bounded-refund | mcp, sdk, shell, workflow | 4 | allow | allow | 1 | yes |
| allowed-draft-internal-note | mcp, sdk, shell, workflow | 4 | allow | allow | 1 | yes |
| allowed-read-single-ticket | mcp, sdk, shell, workflow | 4 | allow | allow | 1 | yes |
| missing-refund-amount | mcp, sdk, shell, workflow | 4 | require_review | require_review | 1 | yes |
| runtime-denied-refund-permission | mcp, sdk, shell, workflow | 4 | block | block | 1 | yes |
| runtime-narrowed-refund-limit | mcp, sdk, shell, workflow | 4 | block | block | 1 | yes |
| violation-customer-email | mcp, sdk, shell, workflow | 4 | block | block | 1 | yes |
| violation-refund-over-contract-limit | mcp, sdk, shell, workflow | 4 | block | block | 1 | yes |

## Case Details

| Case | Runtime | Group | Expected | Observed | Drift | Boundary key | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| skill-boundary-v2-mcp-allowed-read-single-ticket | mcp | allowed-read-single-ticket | allow | allow | none | 52258356c428 | PASS |
| skill-boundary-v2-sdk-allowed-read-single-ticket | sdk | allowed-read-single-ticket | allow | allow | none | 52258356c428 | PASS |
| skill-boundary-v2-shell-allowed-read-single-ticket | shell | allowed-read-single-ticket | allow | allow | none | 52258356c428 | PASS |
| skill-boundary-v2-workflow-allowed-read-single-ticket | workflow | allowed-read-single-ticket | allow | allow | none | 52258356c428 | PASS |
| skill-boundary-v2-mcp-allowed-draft-internal-note | mcp | allowed-draft-internal-note | allow | allow | none | 2db5d86013b6 | PASS |
| skill-boundary-v2-sdk-allowed-draft-internal-note | sdk | allowed-draft-internal-note | allow | allow | none | 2db5d86013b6 | PASS |
| skill-boundary-v2-shell-allowed-draft-internal-note | shell | allowed-draft-internal-note | allow | allow | none | 2db5d86013b6 | PASS |
| skill-boundary-v2-workflow-allowed-draft-internal-note | workflow | allowed-draft-internal-note | allow | allow | none | 2db5d86013b6 | PASS |
| skill-boundary-v2-mcp-allowed-bounded-refund | mcp | allowed-bounded-refund | allow | allow | none | a04da8d3110c | PASS |
| skill-boundary-v2-sdk-allowed-bounded-refund | sdk | allowed-bounded-refund | allow | allow | none | a04da8d3110c | PASS |
| skill-boundary-v2-shell-allowed-bounded-refund | shell | allowed-bounded-refund | allow | allow | none | a04da8d3110c | PASS |
| skill-boundary-v2-workflow-allowed-bounded-refund | workflow | allowed-bounded-refund | allow | allow | none | a04da8d3110c | PASS |
| skill-boundary-v2-mcp-violation-customer-email | mcp | violation-customer-email | block | block | policy_drift | a526870feefe | PASS |
| skill-boundary-v2-sdk-violation-customer-email | sdk | violation-customer-email | block | block | policy_drift | a526870feefe | PASS |
| skill-boundary-v2-shell-violation-customer-email | shell | violation-customer-email | block | block | policy_drift | a526870feefe | PASS |
| skill-boundary-v2-workflow-violation-customer-email | workflow | violation-customer-email | block | block | policy_drift | a526870feefe | PASS |
| skill-boundary-v2-mcp-violation-refund-over-contract-limit | mcp | violation-refund-over-contract-limit | block | block | policy_drift | 513c6e56c401 | PASS |
| skill-boundary-v2-sdk-violation-refund-over-contract-limit | sdk | violation-refund-over-contract-limit | block | block | policy_drift | 513c6e56c401 | PASS |
| skill-boundary-v2-shell-violation-refund-over-contract-limit | shell | violation-refund-over-contract-limit | block | block | policy_drift | 513c6e56c401 | PASS |
| skill-boundary-v2-workflow-violation-refund-over-contract-limit | workflow | violation-refund-over-contract-limit | block | block | policy_drift | 513c6e56c401 | PASS |
| skill-boundary-v2-mcp-runtime-narrowed-refund-limit | mcp | runtime-narrowed-refund-limit | block | block | policy_drift | cb83c9345ce2 | PASS |
| skill-boundary-v2-sdk-runtime-narrowed-refund-limit | sdk | runtime-narrowed-refund-limit | block | block | policy_drift | cb83c9345ce2 | PASS |
| skill-boundary-v2-shell-runtime-narrowed-refund-limit | shell | runtime-narrowed-refund-limit | block | block | policy_drift | cb83c9345ce2 | PASS |
| skill-boundary-v2-workflow-runtime-narrowed-refund-limit | workflow | runtime-narrowed-refund-limit | block | block | policy_drift | cb83c9345ce2 | PASS |
| skill-boundary-v2-mcp-runtime-denied-refund-permission | mcp | runtime-denied-refund-permission | block | block | policy_drift | a04da8d3110c | PASS |
| skill-boundary-v2-sdk-runtime-denied-refund-permission | sdk | runtime-denied-refund-permission | block | block | policy_drift | a04da8d3110c | PASS |
| skill-boundary-v2-shell-runtime-denied-refund-permission | shell | runtime-denied-refund-permission | block | block | policy_drift | a04da8d3110c | PASS |
| skill-boundary-v2-workflow-runtime-denied-refund-permission | workflow | runtime-denied-refund-permission | block | block | policy_drift | a04da8d3110c | PASS |
| skill-boundary-v2-mcp-missing-refund-amount | mcp | missing-refund-amount | require_review | require_review | incomplete_evidence | c0493b61f05f | PASS |
| skill-boundary-v2-sdk-missing-refund-amount | sdk | missing-refund-amount | require_review | require_review | incomplete_evidence | c0493b61f05f | PASS |
| skill-boundary-v2-shell-missing-refund-amount | shell | missing-refund-amount | require_review | require_review | incomplete_evidence | c0493b61f05f | PASS |
| skill-boundary-v2-workflow-missing-refund-amount | workflow | missing-refund-amount | require_review | require_review | incomplete_evidence | c0493b61f05f | PASS |

## Interpretation

The experiment separates requested skill authority from effective runtime authority. The skill boundary requests refund authority up to USD 100. The runtime authorization layer can still narrow that authority to USD 75 for a workspace, deny an operation, or require review when a required typed predicate is missing.

CAVA is not the policy language. It is the action representation used to test whether a concrete runtime action satisfies the effective boundary. This keeps the skill contract vendor-neutral while still making the runtime evidence executable and replayable.

## Limitations

- This is a small controlled artifact, not a population-scale benchmark.
- The contract semantics are deliberately minimal and should be sharpened before any paper submission.
- The experiment checks semantic preservation across runtime forms, not whether a language model reliably chooses safe actions.
- OSuite is used as one reference implementation; the research question should remain open to other runtime-governance implementations.

