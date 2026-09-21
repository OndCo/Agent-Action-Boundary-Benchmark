# OSuite Action Pass Lane Benchmark

## Research Question

Can agent governance behave like a local runtime gate for the common case, while routing stale, ambiguous, high-risk, or divergent actions into slow review or fail-closed outcomes?

## Core Idea

An Action Pass is a bounded, consumable execution ticket. It carries enough signed state for a local runtime gate to decide whether a specific canonical action can commit without a remote policy lookup, verifier call, approval database read, or synchronous proof-bundle export.

The benchmark is intentionally scoped as lane classification and critical-path modeling. It does not claim measured production latency. It tests whether the gate chooses the right path before side effects form.

## Metrics

| Cases | Exact match | Fast path coverage | Slow path rate | Fail-closed rate | Zero-wait ratio | Safety-preserving fast path | False fast allow | Fast receipt emission |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 16 | 100.0% | 25.0% | 31.3% | 43.8% | 25.0% | 100.0% | 0.0% | 100.0% |

## Lane Distribution

| Lane | Cases |
| --- | --- |
| block | 7 |
| fast | 4 |
| slow | 5 |

## Why This Is Different From A2A Or Tool Auth

A2A, MCP, OAuth, mTLS, and API keys help establish who is communicating and how a task or tool call moves. An Action Pass answers a narrower runtime question: is this exact canonical action allowed to pass this gate now, under this policy digest, with this nonce, budget, state, and receipt obligation?

Identity gets the agent to the gate. The Action Pass decides whether the action gets through it.

## Case Results

| Case | Runtime | Pass | Lane | Control | Blockers | Slow reasons | Receipt | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fast-mcp-read-support-ticket | mcp | ap_support_1042_fast_lane | fast | allow | none | none | complete | PASS |
| fast-sdk-bounded-refund | sdk | ap_refund_1042_73usd | fast | allow | none | none | complete | PASS |
| fast-workflow-note-proof-enrichment-down | workflow | ap_internal_note_1042 | fast | allow | none | none | minimum_receipt_only | PASS |
| fast-a2a-internal-handoff | a2a | ap_a2a_internal_handoff_1042 | fast | allow | none | none | complete | PASS |
| slow-policy-digest-drift | mcp | ap_support_1042_fast_lane | slow | require_review | none | policy_digest_drift | not_committed | PASS |
| slow-tool-schema-drift | mcp | ap_support_1042_fast_lane | slow | require_review | none | tool_schema_drift | not_committed | PASS |
| slow-missing-required-evidence | sdk | ap_refund_missing_amount | slow | require_review | none | missing_required_evidence:amount_usd | not_committed | PASS |
| slow-external-verifier-not-warmed | sdk | ap_refund_verifier_required | slow | require_review | none | external_verifier_not_prepared | not_committed | PASS |
| slow-critical-not-fast-eligible | sdk | ap_critical_refund_no_fast_lane | slow | require_review | none | not_fast_path_eligible, high_risk_requires_review | not_committed | PASS |
| block-action-hash-mismatch | mcp | ap_support_1042_fast_lane | block | block | effect_out_of_scope, destination_out_of_scope, action_hash_mismatch | none | not_committed | PASS |
| block-expired-pass | mcp | ap_expired_support_read | block | block | pass_expired | none | not_committed | PASS |
| block-consumed-nonce | mcp | ap_duplicate_support_read | block | block | nonce_replay | none | not_committed | PASS |
| block-identity-revoked | mcp | ap_support_1042_fast_lane | block | block | identity_revoked | none | not_committed | PASS |
| block-budget-exhausted | sdk | ap_refund_budget_exhausted | block | block | budget_exhausted | none | not_committed | PASS |
| block-receipt-sink-down | mcp | ap_support_1042_fast_lane | block | block | minimum_receipt_unavailable | none | not_committed | PASS |
| block-invalid-signature | mcp | ap_invalid_signature | block | block | invalid_signature | none | not_committed | PASS |

## Interpretation

The fast lane is not weaker governance. It is the subset of governance whose required facts have already been compiled into a signed, fresh, scoped, non-replayed pass and can be checked locally. The slow lane is where the system deliberately refuses to pretend that stale or ambiguous facts are safe. The fail-closed lane is where a pass is missing, stale, unbound, reused, or impossible to receipt.

## Design Principle

Do not make every agent action ask for permission from scratch. Issue bounded action passes, consume them at the runtime gate, and settle the full proof after the local receipt is safely emitted.
