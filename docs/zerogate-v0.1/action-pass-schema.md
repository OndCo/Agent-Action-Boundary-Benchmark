# OSuite Action Pass schema

Action Pass is the bounded execution ticket for a CAVA action. It is not a generic auth token and not an audit log. It is a short-lived, locally checkable object that lets a runtime decide whether a concrete action may cross the execution boundary without synchronously calling every governance dependency.

The design follows a Suica-style rule: move slow account, policy, approval, verifier, and evidence preparation out of the gate; keep only the minimum deterministic checks at commit time. Fast lane is available only for uncontended passage. Same-slot resource conflicts, stale state, verifier dependency, or missing receipt material leave the fast lane.

## Schema version

`osuite.action_pass.v1`

## Required fields

| Field | Purpose |
| --- | --- |
| `pass_id` | Stable identifier for this pass instance. |
| `issuer` | OSuite authority that minted the pass. |
| `holder` | Agent, principal, workspace, and optional runtime session allowed to present the pass. |
| `authority.requested_ref` | Optional link to the upstream skill, task, or policy request. |
| `authority.granted` | Runtime-granted authority after policy narrowing. |
| `authority.narrowing_rule` | Fixed to `runtime_may_narrow_never_widen`. |
| `action_binding.allowed_fingerprint` | CAVA fingerprint this pass can authorize. |
| `policy_binding.policy_digest` | Policy snapshot compiled into the pass. |
| `state_binding.state_digest` | Runtime state snapshot compiled into the pass. |
| `state_binding.predicates` | Optional named state predicates required for fast-lane use. |
| `revocation_binding` | Revocation epoch or registry digest used to detect stale issuer state. |
| `budget` | Local consumption limit for bounded reuse. |
| `budget.aggregate_key` | Optional shared quota/spend boundary outside the single pass. |
| `validity` | `issued_at`, `not_before`, and `expires_at`. |
| `nonce` | Replay protection value. |
| `risk` | Risk class and score used when deciding whether fast lane is allowed. |
| `commit_profile` | Whether this pass may commit locally or must enter slow path. |
| `evidence_profile` | Synchronous minimal receipt and asynchronous proof enrichment posture. |
| `privacy_profile` | Boundary-material minimization requirement. |
| `pass_hash` | Canonical hash over every pass field except itself. This is reference integrity material, not deployable authorization by itself. |
| `signature` / signed envelope | Required in production so the pass is bound to an issuer key rather than only to local bytes. |

## Minimal example

```json
{
  "schema_version": "osuite.action_pass.v1",
  "pass_id": "ap_...",
  "issuer": {
    "id": "osuite-runtime-authorizer",
    "key_ref": "osuite:key:prod"
  },
  "holder": {
    "agent_id": "agent:ops-bot",
    "principal_id": "operator:jw-ond",
    "workspace_id": "workspace:osuite",
    "runtime_session_id": "session:agent-run-123"
  },
  "authority": {
    "requested_ref": "skill:refund-review:v1",
    "narrowing_rule": "runtime_may_narrow_never_widen",
    "granted": {
      "operations": ["issue_refund"],
      "resource_scope": ["order:ORD-73"],
      "destinations": ["payment_ledger"],
      "systems_touched": ["payment_ledger"],
      "constraints": {
        "max_amount_usd": 100,
        "requires_issue_body_hash": true
      }
    }
  },
  "action_binding": {
    "mode": "cava_fingerprint",
    "allowed_fingerprint": "..."
  },
  "policy_binding": {
    "policy_id": "policy:refund-under-100",
    "policy_version": "v1",
    "policy_digest": "..."
  },
  "state_binding": {
    "state_version": "support-case@123",
    "state_digest": "...",
    "predicates": {
      "order_status": "refund_eligible",
      "data_boundary": "internal"
    }
  },
  "revocation_binding": {
    "epoch": "revocation-epoch-7",
    "digest": "..."
  },
  "budget": {
    "unit": "action",
    "limit": 1,
    "consumed": 0,
    "aggregate_key": "refund-daily:team-a"
  },
  "validity": {
    "issued_at": "2026-09-20T00:00:00.000Z",
    "not_before": "2026-09-20T00:00:00.000Z",
    "expires_at": "2026-09-20T00:05:00.000Z"
  },
  "nonce": "nonce-1",
  "risk": {
    "class": "low",
    "score": 20
  },
  "commit_profile": {
    "lane": "fast",
    "local_only": true,
    "remote_verifier_required": false,
    "evidence_mode": "receipt_first"
  },
  "evidence_profile": {
    "synchronous_receipt": true,
    "asynchronous_proof_enrichment": true,
    "receipt_sink": "local_append_only_buffer",
    "verifier_profile": "optional"
  },
  "privacy_profile": {
    "material_class": "customer_context",
    "disclosure": "minimized",
    "fast_lane_requires_minimized": true
  },
  "pass_hash": "...",
  "signature": {
    "format": "deployment-envelope",
    "key_ref": "osuite:key:prod",
    "value": "..."
  }
}
```

## Commit-time decisions

| Condition | Lane | Decision |
| --- | --- | --- |
| Pass hash valid, fresh, action fingerprint matches, required authority is within granted authority, policy digest matches, state digest matches, no same-slot resource conflict exists, nonce unused, budget available, receipt sink available, fast profile allowed | `fast` | `execute` |
| Policy digest changed | `slow` | `review` |
| State digest changed | `slow` | `review` |
| Required state predicate is missing or changed | `slow` | `review` |
| Revocation epoch changed | `slow` | `review` |
| Same-slot resource or sequence conflict detected | `slow` | `review` |
| Remote verifier required | `slow` | `review` |
| Pass was not compiled for fast lane | `slow` | `review` |
| Required authority evidence is missing | `slow` | `review` |
| Privacy-sensitive boundary material is exposed where minimization is required | `slow` | `review` |
| Action fingerprint differs from approved CAVA fingerprint | `block` | `deny` |
| Runtime-required authority exceeds granted operations, resources, destinations, systems, or constraints | `block` | `deny` |
| Observed agent, principal, workspace, or runtime session differs from the pass holder | `block` | `deny` |
| Pass id or action fingerprint is explicitly revoked | `block` | `deny` |
| Requested units exceed shared aggregate budget evidence | `block` | `deny` |
| A synchronous receipt is required but unavailable | `block` | `deny` |
| Receipt object is constructed but cannot be persisted before commit | `block` | `deny` |
| Pass expired or not yet valid | `block` | `deny` |
| Nonce replay detected | `block` | `deny` |
| Budget exhausted | `block` | `deny` |

## Observation fields

The pass carries the grant. The runtime observation carries what is happening at the boundary. Useful observation fields include:

| Field | Purpose |
| --- | --- |
| `canonical_action` or `action_fingerprint` | The concrete action being executed. |
| `required_authority` / `authority_required` | Authority required by the concrete runtime action. It must be covered by `authority.granted`. |
| `agent_id`, `principal_id`, `workspace_id`, `runtime_session_id` | Observed holder/session evidence. If the pass binds one of these fields and the observation omits or changes it, the gate blocks. |
| `policy_digest` | Current policy snapshot at commit time. |
| `state_digest` | Current state snapshot at commit time. |
| `state_predicates` | Named state facts required by the pass. Missing or changed predicates leave the fast lane. |
| `revocation_epoch` / `current_revocation_epoch` | Current revocation snapshot. Epoch drift leaves the fast lane; explicit revocation blocks. |
| `revoked_pass_ids` / `revoked_action_fingerprints` | Explicit revocation evidence. |
| `consumed_nonces` | Nonce set or cache used to reject replay. |
| `aggregate_budget_remaining` | Shared quota evidence beyond the single pass budget. |
| `receipt_sink_available` | Whether the minimum synchronous receipt can be written before side effect. |
| `time_slot_conflict` / `resource_slot_conflict` | Runtime-detected same-slot resource or sequence contention. This routes to slow review rather than fast execution. |
| `pass_material_exposed` | Indicates raw sensitive material is being carried where minimized commitments were required. |

## Relationship to PCAA, CAVA, BAF, and AREG

| Primitive | Role in Action Pass |
| --- | --- |
| CAVA | Produces the stable action fingerprint bound into the pass. |
| PCAA | Defines route-review-prove; Action Pass is the execution ticket between review and proof. |
| BAF | Supplies bounded reuse, expiry, budget, and scope constraints. |
| AREG | Explains why a pass was fast-laned, slowed, blocked, or exposed. |

Action Pass does not let a skill authorize itself. A skill may request authority; OSuite runtime authorization narrows, denies, or mints a pass.

## Operations-research routing metadata

Action Pass authorization and fleet routing are intentionally separate. The pass answers whether this concrete action may cross this boundary. A routing layer may then decide whether the action is consumed locally, folded into another receipt, delayed, batched, escalated, or blocked under finite capacity. Routing metadata must never widen the authority granted by the pass.

Useful routing metadata includes:

| Field | Purpose |
| --- | --- |
| `routing.priority_class` | Separates critical collisions from lower-urgency ambiguity. |
| `routing.deadline_at` | Latest acceptable decision time before the action becomes stale or unsafe. |
| `routing.coalescing_key` | Groups related collisions, ambiguous evidence, or same-resource actions into one review task. |
| `routing.queue` | Target queue such as `local_fast_gate`, `slow_critical`, `slow_batch`, `defer_until_capacity`, or `fail_closed`. |
| `routing.capacity_class` | Capacity pool consumed by this item, such as reviewer, verifier, settlement, or local receipt storage. |
| `routing.fairness_group` | Tenant, workspace, team, or agent group used to prevent one fleet from starving another. |
| `routing.deferred_evidence_allowed` | Whether non-critical proof enrichment may happen after the minimum receipt is persisted. |

The reference benchmark treats this as an operations-research layer over the action stream: classify first, fold context baggage, contain dependent subactions, block tailgating actions, coalesce collisions, then schedule remaining slow-lane work by deadline and risk. This changes queue behavior, not authorization semantics.

## Production hardening notes

The reference evaluator is intentionally small and inspectable. A production deployment should wrap the same pass semantics with additional operational controls:

| Requirement | Why it matters |
| --- | --- |
| Signed pass envelope such as JWS or COSE | `pass_hash` detects local mutation; a signed envelope binds the pass to a trusted issuer key. |
| Issuer key rotation and `key_ref` pinning | Auditors need to know which issuer key was valid when the pass was minted. |
| Atomic nonce and budget consumption | Replay resistance requires a shared consumption boundary, not only a caller-supplied nonce list. |
| Append-only or tamper-evident receipt sink | The runtime must not execute a side effect if it cannot write the minimum receipt. |
| Bounded clock skew policy | Fast-lane validity depends on `not_before` and `expires_at` being interpreted consistently. |
| Revocation epoch and emergency revocation channel | A short-lived pass can still need immediate invalidation. |
| Aggregate budget or quota service | Many individually valid passes must not bypass a tenant, team, account, wallet, or daily limit. |
| Privacy-safe pass material policy | Fast-lane objects should carry commitments and labels, not raw secrets or regulated data. |
| Runtime enforcement disclosure | Adapters must state whether they enforce before execution or only observe after execution. |

These hardening controls do not change the Action Pass object. They make the same object safe to issue and consume in production topologies.

## Claim boundaries

Action Pass is a commit-boundary object. It does not, by itself, prove that the upstream policy was wise, that a skill was allowed to request the authority it declared, or that every adapter can block before execution.

| Boundary | Current reference behavior | Production evidence needed |
| --- | --- | --- |
| Pass minting quality | The evaluator rejects required authority that widens beyond the granted pass. | Minting tests over real policy templates, TTLs, destinations, and operator-approved scopes. |
| CAVA canonicalization | The pass binds to a CAVA fingerprint and blocks mismatches. | Held-out runtime mappings and larger multilingual/framework-specific corpora. |
| Policy and state freshness | Digest drift routes to slow review. | Live canaries where policy or SaaS state changes between mint and commit. |
| State predicates | Missing or drifted named predicates route to slow review. | Domain-specific predicate definitions and independent expected-outcome labels. |
| Revocation freshness | Explicit pass revocation blocks; epoch drift routes to slow review. | Live revocation-channel and issuer-registry propagation tests. |
| Distributed replay | Replayed nonces are rejected in the evaluator path. | Atomic nonce and budget consumption across processes, regions, and adapters. |
| Aggregate budget | Aggregate-budget exhaustion blocks even when the individual pass is otherwise valid. | Shared quota evidence across tenants, wallets, teams, and action families. |
| Holder or runtime-session confusion | Observed holder/session evidence must match the pass holder/session before commit. | Adapter-level session attestation and signed runtime identity for every enforce-before-execute lane. |
| Receipt availability | Missing synchronous receipt sink or missing persisted-before-commit evidence blocks before side effect. | Durable local buffers, reconciliation, and fault-injection runs. |
| Privacy minimization | Privacy-boundary exposure routes to slow review. | Redaction, secret scanning, and privacy-safe proof-bundle policies. |
| Adapter enforcement | Schema can describe receipt and commit requirements. | Public adapter-mode disclosure: enforce-before-execute, hook-mediated, or observe-only. |
| Performance generality | Local benchmark and load study exercise the real evaluator code path. | Hosted tenant canaries and external SaaS mutation latency distributions. |

These boundaries are intentional. They keep the fast path narrow enough to defend: ZeroGate accelerates consumption of an already narrowed action boundary; it does not replace policy design, runtime mapping evaluation, storage correctness, or adapter enforcement.
