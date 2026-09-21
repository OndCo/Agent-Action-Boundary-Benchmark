# OSuite Action Pass fast/slow lane benchmark

This disclosure-safe benchmark models a Suica-inspired governed-action runtime. The pass is prepared before execution, and the commit boundary only performs local deterministic checks over the CAVA action fingerprint, policy digest, state digest, authority subset, nonce, expiry, budget, and receipt condition.

## Summary

| Metric | Value |
| --- | ---: |
| Weighted synthetic common-case mix | 5760 |
| Stress matrix cases | 360 |
| Action families | 12 |
| Mutations per family | 30 |
| Weighted common-case exact lane match | 1 |
| Weighted common-case fast-path coverage | 0.75 |
| Safety-preserving fast-path coverage | 0.75 |
| Zero-wait ratio | 0.8771 |
| Violation rate | 0 |
| Receipt object constructed rate | 1 |
| Receipt persisted-before-commit rate | 0.9917 |
| Fast commit receipt integrity | 1 |
| Partial commit without receipt | 0 |
| Stress exact lane match | 1 |
| Stress fast-path coverage | 0.1 |
| Diagnostic single-case local commit p50 ms | 0.0763 |
| Diagnostic single-case local commit p95 ms | 0.7615 |
| Diagnostic single-case local commit p99 ms | 1.1582 |
| Estimated p50 latency reduction vs full synchronous governance | 0.999818 |

## Dataset audit for IEEE/AAAI-style review

This section makes the benchmark's review boundary explicit. The deterministic stress oracle is an authored regression oracle, the noisy calibration is a specified evidence-degradation model, and the public corpus is a real-artifact coverage study. They should not be collapsed into one accuracy claim.

| Field | Value |
| --- | --- |
| Dataset audit schema | osuite.action_pass.dataset_audit.v1 |
| Benchmark spec sha256 | 59c83f8ff16c721bd9d84131044273fdb22de76a1e8e4fa35ac5b707103ba2be |
| Stress manifest sha256 | 6d57134401eed72b62016e462d9494d894fa6cc08ab7df66b892a993046a3833 |
| Representative manifest sha256 | e4624aa23d848ce79dc378fbdbd60873481ba325baed5b5a5a10e94b1a7d7767 |
| Families | 12 |
| Mutations | 30 |
| Stress cases | 360 |
| Weighted representative cases | 5760 |
| Oracle leakage failures | 0 |
| Evaluator path | packages/cava-core/src/action-pass.js:evaluateActionPassCommit |
| Stress exact-match 95% CI | 0.9894--1 |
| Weighted exact-match 95% CI | 0.9993--1 |
| Noisy escape upper 95% bound | 0.0001 |

### Frozen split views

| Split | Cases | Exact match | Fast path | Zero wait | Violation | Exact-match Wilson 95% CI |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| reference | 176 | 1 | 0.1364 | 0.6364 | 0 | 0.9786--1 |
| heldout_family | 88 | 1 | 0.1364 | 0.6364 | 0 | 0.9582--1 |
| heldout_mutation | 64 | 1 | 0 | 0.5 | 0 | 0.9434--1 |
| heldout_cross | 32 | 1 | 0 | 0.5 | 0 | 0.8928--1 |

Held-out families: database_export_prepare, kubernetes_restart, slack_announcement_post, vendor_invoice_schedule

Held-out mutations: state_predicate_drift, revocation_epoch_stale, same_slot_resource_conflict, authority_scope_widening, aggregate_budget_exhausted, runtime_session_mismatch, privacy_boundary_exposed, pass_hash_tampered

### Remaining review risks

| Risk |
| --- |
| Synthetic oracle labels are authored by the system designers. |
| No human inter-annotator agreement exists yet for runtime-to-action semantic labels. |
| Public GitHub Actions corpus is a useful real artifact surface but not representative of all agent runtimes. |
| Scenario baselines are design-pattern comparisons, not measured closed-vendor product benchmarks. |
| Local evaluator latency is not end-to-end customer SLA latency. |

## Critical-path step model

| Model | Commit steps | Remote dependencies on commit | Minimum receipt before side effect |
| --- | ---: | ---: | --- |
| Full synchronous governance | 8 | 4 | yes |
| ZeroGate Action Pass | 5 | 0 | yes |

ZeroGate does not prove speed by a fragile timing number alone; it removes remote dependencies from the common commit boundary and leaves only local deterministic checks.

### Sensitivity to full-governance latency assumptions

The remote full-governance latency is a scenario model, not a measured OSuite production SLA. This sensitivity table keeps the same local commit p50 and varies the assumed synchronous full-governance p50.

| Full-governance p50 model ms | Local commit p50 ms | Estimated p50 wait reduction | Remote dependencies removed |
| ---: | ---: | ---: | ---: |
| 50 | 0.0763 | 0.998474 | 4 |
| 100 | 0.0763 | 0.999237 | 4 |
| 250 | 0.0763 | 0.999695 | 4 |
| 420 | 0.0763 | 0.999818 | 4 |
| 1000 | 0.0763 | 0.999924 | 4 |

## Local timing study

The timing study uses batch measurement after warmup with `process.hrtime.bigint`. It measures only the local commit evaluator, not pass minting, adapter parsing, durable storage, network calls, verifier calls, UI approval, tool execution, or production queueing.

| Metric | Value |
| --- | ---: |
| Warmup rounds | 8 |
| Measured rounds | 40 |
| Operations per round | 360 |
| Total measured operations | 14400 |
| Mean ms/op | 0.060251 |
| Stddev ms/op | 0.001626 |
| CI95 low ms/op | 0.059747 |
| CI95 high ms/op | 0.060755 |
| Production SLA claim | false |

## Concurrent implementation load study

Run `npm run action-pass:load-study` to exercise the real `packages/cava-core` Action Pass evaluator path under worker concurrency. The generated `load-study.json` and `load-study.md` files record worker count, operation count, throughput, p50/p95/p99 commit latency, lane match, false-allow rate, receipt-object construction, persisted-before-commit rate, duplicate nonce blocking, same-slot conflict routing, holder/session checks, missing authority evidence, and receipt-sink failures.

This load study is not live customer production traffic. It is a real implementation stress run over deterministic synthetic observations.

## Weighted common-case lane counts

| Lane | Count |
| --- | ---: |
| block | 732 |
| fast | 4320 |
| slow | 708 |

## Stress matrix lane counts

| Lane | Count |
| --- | ---: |
| block | 180 |
| fast | 36 |
| slow | 144 |

## Scenario baseline model

| System | p50 ms | Zero-wait ratio | False-allow rate | Evidence completeness | Decision equivalence |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw_tool_permission | 0.02 | 1 | 0.25 | 0 | 0.75 |
| audit_only | 0.04 | 1 | 0.25 | 0.35 | 0.75 |
| session_approval | 0.08 | 1 | 0.1537 | 0.55 | 0.8463 |
| synchronous_full_governance | 420 | 0 | 0 | 1 | 1 |
| zerogate_action_pass | 0.0763 | 0.8771 | 0 | 1 | 1 |

## Measured local decision-function comparison

This comparison runs three local decision functions over the same 360 pass/observation pairs. It is not a closed-vendor benchmark and not an end-to-end production SLA, but it prevents the baseline section from being purely narrative.

| System | p50 ms | p95 ms | False allow | False block | Evidence completeness | Execute | Review | Deny |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| raw_tool_permission_check | 0.000035 | 0.000039 | 0.9 | 0 | 0 | 360 | 0 | 0 |
| broad_session_approval_check | 0.000085 | 0.000161 | 0.8333 | 0 | 0 | 336 | 0 | 24 |
| zerogate_action_pass_evaluator | 0.065081 | 0.069927 | 0 | 0 | 1 | 36 | 144 | 180 |

## Mainstream governance comparison

This table compares design patterns, not named-vendor production systems. Non-ZeroGate rows are scenario models for common industry approaches; they should not be read as measured OpenAI, Anthropic, Microsoft, or MCP product benchmarks.

| System | Category | Commit remote deps | p50 ms | p95 ms | Zero-wait ratio | Action identity binding | Divergence detection | Replayable receipt | Basis |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| osuite_v0_synchronous_review | earlier_osuite_design | 4 | 420 | 980 | 0 | true | true | true | scenario_model_for_full_remote_governance |
| vendor_native_control_plane | mainstream_platform_control_plane | 2 | 160 | 420 | 0.45 | platform_scoped | platform_scoped | vendor_internal_or_export_dependent | scenario_model_not_vendor_benchmark |
| harness_policy_hook | mainstream_agent_harness | 1 | 35 | 120 | 0.7 | hook_payload_dependent | false | false | scenario_model_not_vendor_benchmark |
| iam_or_mcp_scope_gate | mainstream_access_control | 0 | 0.02 | 0.05 | 1 | false | false | false | local_capability_check_model |
| zerogate_action_pass | action_boundary_pass | 0 | 0.0763 | 0.7615 | 0.8771 | true | true | true | measured_local_evaluator_plus_scenario_model |

## Architecture ablations

| Variant | Fast-path coverage | False-allow rate | Evidence completeness | Lesson |
| --- | ---: | ---: | ---: | --- |
| full_zerogate | 0.75 | 0 | 1 | Compiled authority preserves full-governance lane decisions while keeping common cases local. |
| without_action_binding | 0.961 | 0.0505 | 1 | Removing CAVA fingerprint binding admits operation/resource/destination drift. |
| without_capsule_policy_digest | 0.844 | 0.0183 | 1 | Policy drift becomes invisible to the fast lane. |
| without_state_digest | 0.844 | 0.0183 | 1 | State drift can reuse a stale approval. |
| without_nonce_budget | 0.849 | 0.0183 | 1 | Replay and repeated spend become possible. |
| without_holder_session_binding | 0.7667 | 0.0167 | 1 | A copied pass can become transferable authority across agents or sessions. |
| without_revocation_binding | 0.7604 | 0.0104 | 1 | Emergency revocations and registry freshness gaps become invisible to the local gate. |
| without_state_predicates | 0.7625 | 0.0125 | 1 | A digest can match while required semantic state evidence is missing or stale. |
| without_receipt_persistence_gate | 0.7667 | 0.0167 | 0.9917 | The system can execute side effects whose minimum receipt was not durably captured. |
| without_fast_slow_separation | 0 | 0 | 1 | Safety remains, but every action pays full synchronous governance tax. |
| without_async_evidence | 0.75 | 0 | 1 | Decision safety remains, but durable proof construction moves back into the critical path. |

## Tap-and-go simulation

The simulation models the FeliCa/Suica design lesson at the agent boundary: pre-poll slow facts before the boundary, resolve same-slot conflicts explicitly, keep the synchronous transaction short, apply an anti-tear-inspired rule that requires minimum receipt material before execution, and defer evidence enrichment after the commit.

| Profile | Actions | Agents | Fast | Slow | Block | Tap-go ratio | ZeroGate p95 ms | Sync p95 ms | Queue reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| single_agent_repeated_tap | 120 | 1 | 90 | 14 | 16 | 0.8833 | 115.006 | 980 | 0.882765 |
| team_burst | 480 | 12 | 343 | 71 | 66 | 0.8521 | 145.6072 | 980 | 0.851535 |
| enterprise_gate_hour | 9600 | 240 | 6900 | 1419 | 1281 | 0.8522 | 145.5052 | 980 | 0.851639 |
| incident_policy_churn | 1200 | 40 | 630 | 397 | 173 | 0.6692 | 324.7262 | 980 | 0.668736 |

### Collision and anti-tear checks

| Check | Value |
| --- | ---: |
| Slots tested | 12 |
| Duplicate nonce block rate | 1 |
| Conflicting resource slow rate | 1 |
| Missing receipt sink block rate | 1 |
| Partial commits without receipt | 0 |

### Workflow accumulation

| Workflow steps | Fast | Slow | Block | ZeroGate expected wait ms | Sync expected wait ms | Avoided ratio |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 6 | 1 | 1 | 985.3305 | 7840 | 0.87432 |
| 64 | 48 | 8 | 8 | 7882.644 | 62720 | 0.87432 |
| 256 | 192 | 31 | 33 | 30551.3375 | 250880 | 0.878223 |
| 1024 | 768 | 126 | 130 | 124163.827 | 1003520 | 0.876272 |

## Passage-envelope active-support model

This model makes the gate analogy more precise. It treats the common boundary as a 100 ms passage envelope, then decomposes the local commit path into stage budgets and tests whether burst, collision, and policy-curvature profiles can stay inside the envelope without widening authority. The numbers are a deterministic scenario model grounded in the measured local evaluator time; they are not a JR East/Sony performance claim and not an OSuite hosted SLA.

| Metric | Value |
| --- | ---: |
| Passage envelope ms | 100 |
| Measured local p50 ms | 0.059493 |
| Measured local p95 ms | 0.062964 |
| Measured local p99 ms | 0.08 |
| P95 budget utilization | 0.00063 |
| P99 budget utilization | 0.0008 |
| P95 headroom ms | 99.937036 |
| P99 headroom ms | 99.92 |

| Stage | Budget ms | Estimated p95 ms | Active support |
| --- | ---: | ---: | --- |
| present_pass_and_runtime_observation | 8 | 0.005037 | runtime pre-assembles holder/session and final action observation before commit |
| verify_pass_envelope_and_hash | 18 | 0.011334 | issuer envelope and pass hash are already local material |
| match_cava_fingerprint_and_authority | 24 | 0.01763 | CAVA fingerprint and granted-authority projection are compiled before the side effect |
| check_policy_state_revocation_and_slot | 22 | 0.015111 | policy/state digests, revocation epoch, and per-resource slot state are cached with freshness limits |
| consume_nonce_budget_and_receipt | 18 | 0.010074 | nonce, aggregate budget, and minimum receipt are committed before the side effect |
| dispatch_execute_or_route | 10 | 0.003778 | decision is terminal locally: execute, slow-review, unsupported, or block |

| Profile | Actions | Agents | Curvature | P95 before support ms | P95 after support ms | Support gain ms | Envelope met | Zero-wait after support |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| straight_line_common_operations | 9600 | 240 | 0.07 | 59.839123 | 18.120257 | 41.718867 | true | 0.957 |
| baggage_and_dependent_work | 14400 | 320 | 0.14 | 115.695534 | 32.218745 | 83.476789 | true | 0.933 |
| rush_hour_resource_collision | 18000 | 600 | 0.31 | 223.488608 | 68.375912 | 155.112696 | true | 0.888 |
| sharp_curve_policy_churn | 6000 | 180 | 0.58 | 384.198282 | 206.005901 | 178.192381 | false | 0.729 |
| emergency_revocation_curve | 2400 | 90 | 0.86 | 205.849742 | 142.153834 | 63.695907 | false | 0.855 |

| System | Mean profile p95 ms | Envelope-met profiles | False allow | Boundary weakness |
| --- | ---: | ---: | ---: | --- |
| linear_full_governance | 980 | 0 | 0 | safe but misses the passage envelope for ordinary traffic |
| static_fast_gate_without_active_support | 197.814258 | 1 | 0 | keeps authority safe but lets burst and collision pressure leak into user-facing wait |
| zerogate_active_support | 93.37493 | 3 | 0 | still must miss the envelope in emergency revocation or high-assurance windows |
| raw_permission_gate | 0.05 | 5 | 0.25 | fast because it does not bind the exact action, freshness, receipt, or execution divergence |

Invariant: Active support may precompute, coalesce, reserve capacity, or slow/block work. It may not widen the action, resource, destination, effect, holder, policy, state, budget, or receipt boundary carried by the pass.

## Action crowd control

This model extends the gate analogy from raw throughput to recognition. A high-volume enterprise does not merely need to process more action-like objects per second; it needs to distinguish primary side effects from context baggage, dependent subactions, tailgating side effects, resource collisions, and ambiguous boundary evidence.

| Metric | Value |
| --- | ---: |
| Total action-like items | 144000 |
| Agents | 1200 |
| Classification accuracy | 1 |
| False passenger rate | 0 |
| Tailgater block rate | 1 |
| Baggage context preservation rate | 1 |
| Dependent action containment rate | 1 |
| Collision slow-review rate | 1 |
| Nonlinear reduction ratio | 0.875 |

| Class | Gate analogy | Count | Expected handling | Observed handling | Interpretation |
| --- | --- | ---: | --- | --- | --- |
| primary_action | passenger | 72000 | fast_or_policy_slow | fast_or_policy_slow | The action that actually changes external state and must carry a pass. |
| context_baggage | luggage | 36000 | attach_to_primary_receipt | attach_to_primary_receipt | Evidence, files, trace context, or prompt fragments that travel with the action but are not independent side effects. |
| dependent_subaction | child_or_companion | 18000 | contained_by_primary_pass | contained_by_primary_pass | Bounded helper steps such as metadata writes or internal notifications that must inherit, not widen, the primary pass. |
| tailgating_action | fare_evasion_or_piggyback | 9000 | block | block | A second side effect trying to ride through under a pass minted for another action. |
| crowd_collision | same_gate_same_slot_conflict | 6000 | slow_review | slow_review | Multiple agents contend for the same resource slot, quota, wallet, or state transition. |
| ambiguous_boundary | unclear_passage | 3000 | slow_review | slow_review | The runtime cannot prove whether an item is context, dependent work, or a new side effect. |

| System | Expected reviews | Expected blocks | Local terminal actions | Interpretation |
| --- | ---: | ---: | ---: | --- |
| linear_per_action_review | 144000 | 0 | 0 | Every action-like item is treated as a passenger, including context and dependent work. |
| tool_permission_counter | 0 | 0 | 144000 | Everything with a permitted tool shape passes locally, including tailgating actions and collisions. |
| zerogate_crowd_control | 9000 | 9000 | 135000 | Primary actions carry passes, context baggage is folded into receipts, dependent subactions inherit narrowed authority, tailgaters block, and collisions slow down. |

## Noisy recognition calibration

This calibration is the deliberately non-perfect counterpart to the deterministic crowd-control oracle. It asks what happens when runtime evidence is structured, obfuscated, missing, locale-heavy, crowded, or adversarially near-miss. The intended safe degradation is not to keep the same fast-path number; it is to move uncertain records into slow review, unsupported, or fail-closed handling without letting boundary violations escape through the fast lane.

| Profile | Records | Oracle handling match | Fast preservation | Review/abstain | Unsupported | Violation escape | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| clean_structured_runtime | 12000 | 0.971 | 0.964 | 0.0915 | 0 | 0 | Near-clean structured evidence preserves most fast-path actions while still slowing collisions and ambiguous boundaries. |
| wrapper_obfuscation | 12000 | 0.8662 | 0.85 | 0.1963 | 0 | 0 | Obfuscation reduces fast-lane preservation; the intended safe behavior is abstention or slow review, not forced local execution. |
| missing_state_evidence | 12000 | 0.7333 | 0.7 | 0.3292 | 0 | 0 | Missing freshness evidence creates a deliberate uncertainty tax; the pass remains safe by leaving the fast lane. |
| locale_free_text_noise | 12000 | 0.8225 | 0.8 | 0.24 | 525 | 0 | The model does not claim language understanding from free text; structured fields preserve some fast path, while unclear records abstain. |
| same_slot_crowd_pressure | 12750 | 0.9169 | 0.9 | 0.2008 | 0 | 0 | High contention increases slow-lane load but should not turn resource conflicts into normal passengers. |
| mixed_adversarial_near_miss | 12000 | 0.76 | 0.73 | 0.3025 | 0 | 0 | Near-miss semantic drift is intentionally costly: many records leave the fast lane, but piggybacked side effects still fail closed. |

Aggregate noisy-calibration metrics: oracle handling match 0.8457; fast preservation 0.824; local terminal 0.7736; review/abstain 0.2264; unsupported 0.0072; boundary-violation escape 0.

## Operations-research routing

Recognition alone is not enough at fleet scale. After the action stream is separated into primary actions, context baggage, dependent subactions, tailgating actions, collisions, and ambiguous boundaries, the boundary still has to allocate scarce slow-lane capacity. This deterministic scenario model treats the governed runtime as a finite-capacity routing problem rather than a linear approval queue.

| Metric | Value |
| --- | ---: |
| Planning horizon minutes | 60 |
| Slow review capacity / minute | 180 |
| Raw review capacity over horizon | 10800 |
| Linear review backlog after horizon | 133200 |
| ZeroGate review backlog after horizon | 0 |
| Slow items before coalescing | 9000 |
| Coalesced review tasks | 2000 |
| Coalesced review task reduction | 0.777778 |
| Local terminal ratio | 0.9375 |
| Slow capacity utilization | 0.1852 |
| P95 critical wait minutes | 2.4 |
| P95 ambiguous wait minutes | 8.6 |
| Reviewer capacity freed vs linear | 0.986111 |

| Route | Input class | Count | Coalesced tasks | Scheduler | P95 wait minutes |
| --- | --- | ---: | ---: | --- | ---: |
| local_fast_gate | primary_action | 72000 |  | local pass consumption | 0.000013 |
| receipt_fold | context_baggage | 36000 |  | attach to primary receipt before or after commit according to evidence profile | 0.000013 |
| dependent_containment | dependent_subaction | 18000 |  | inherit narrowed pass authority; cannot widen resource, destination, or effect | 0.000013 |
| fail_closed | tailgating_action | 9000 |  | terminal block | 0.000013 |
| slow_critical | crowd_collision | 6000 | 1000 | earliest-deadline-first with per-resource batching | 2.4 |
| slow_batch | ambiguous_boundary | 3000 | 1000 | risk-weighted batch review | 8.6 |
| defer_until_capacity | low_deadline_evidence_enrichment | 36000 |  | background settlement queue | 10.8 |

| Policy | Reviewed items | Review tasks | Blocks | Local terminal | Backlog after horizon | P95 critical wait | P95 ambiguous wait |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| linear_full_review | 144000 | 144000 | 0 | 0 | 133200 | 760 | 760 |
| fifo_exception_review | 9000 | 9000 | 9000 | 135000 | 0 | 31.5 | 31.5 |
| priority_exception_review | 9000 | 9000 | 9000 | 135000 | 0 | 5.7 | 42 |
| zerogate_or_router | 9000 | 2000 | 9000 | 135000 | 0 | 2.4 | 8.6 |

## First cases

| Case | Expected | Observed | Reason | Local commit ms |
| --- | --- | --- | --- | ---: |
| support_ticket_note:common_case | fast | fast | local_commit_satisfied | 1.1582 |
| support_ticket_note:equivalent_runtime_projection | fast | fast | local_commit_satisfied | 0.74 |
| support_ticket_note:durable_evidence_backend_down | fast | fast | local_commit_satisfied | 0.803 |
| support_ticket_note:policy_drift | slow | slow | policy_digest_drift | 0.7769 |
| support_ticket_note:state_drift | slow | slow | state_digest_drift | 0.7615 |
| support_ticket_note:state_predicate_drift | slow | slow | state_predicate_drift | 0.7109 |
| support_ticket_note:state_predicate_evidence_missing | slow | slow | state_predicate_evidence_missing | 0.695 |
| support_ticket_note:revocation_epoch_stale | slow | slow | revocation_epoch_drift | 0.7585 |
| support_ticket_note:pass_revoked | block | block | pass_revoked | 0.7072 |
| support_ticket_note:tool_schema_drift | slow | slow | policy_digest_drift | 0.6505 |
| support_ticket_note:same_slot_resource_conflict | slow | slow | time_slot_collision_detected | 0.9594 |
| support_ticket_note:remote_verifier_required | slow | slow | remote_verifier_required | 0.6531 |
| support_ticket_note:slow_lane_by_design | slow | slow | not_compiled_for_fast_lane | 0.1308 |
| support_ticket_note:high_risk_scope | slow | slow | risk_exceeds_fast_lane | 0.1209 |
| support_ticket_note:approval_execution_divergence | block | block | approval_execution_divergence | 0.1032 |
| support_ticket_note:resource_substitution | block | block | approval_execution_divergence | 0.1295 |
| support_ticket_note:destination_substitution | block | block | approval_execution_divergence | 0.102 |
| support_ticket_note:authority_scope_widening | block | block | authority_scope_widened | 0.0855 |
| support_ticket_note:expired_pass | block | block | pass_not_current | 0.0772 |
| support_ticket_note:replay_nonce | block | block | replay_nonce_seen | 0.0846 |
| support_ticket_note:budget_exhausted | block | block | budget_exhausted | 0.2274 |
| support_ticket_note:aggregate_budget_exhausted | block | block | aggregate_budget_exhausted | 0.1086 |
| support_ticket_note:receipt_sink_unavailable | block | block | receipt_sink_unavailable | 0.088 |
| support_ticket_note:receipt_not_persisted | block | block | receipt_not_persisted_before_commit | 0.08 |
| support_ticket_note:holder_identity_mismatch | block | block | holder_identity_mismatch | 0.0798 |
| support_ticket_note:runtime_session_mismatch | block | block | runtime_session_mismatch | 0.0755 |
| support_ticket_note:authority_evidence_missing | slow | slow | authority_evidence_missing | 0.0852 |
| support_ticket_note:privacy_boundary_exposed | slow | slow | privacy_boundary_review_required | 0.0875 |
| support_ticket_note:not_yet_valid_clock_skew | block | block | pass_not_current | 0.0756 |
| support_ticket_note:pass_hash_tampered | block | block | invalid_action_pass | 0.179 |
| github_issue_create:common_case | fast | fast | local_commit_satisfied | 0.0859 |
| github_issue_create:equivalent_runtime_projection | fast | fast | local_commit_satisfied | 0.0847 |
| github_issue_create:durable_evidence_backend_down | fast | fast | local_commit_satisfied | 0.0993 |
| github_issue_create:policy_drift | slow | slow | policy_digest_drift | 0.0777 |
| github_issue_create:state_drift | slow | slow | state_digest_drift | 0.0754 |
| github_issue_create:state_predicate_drift | slow | slow | state_predicate_drift | 0.0801 |

## Read the result carefully

The weighted synthetic common-case mix is an explicit model of common-case traffic, not a production traffic claim. The stress matrix is intentionally adversarial. Together they check whether a bounded action pass can preserve the same gate semantics while moving common-case governance work out of the synchronous execution path. Drift, replay, expiry, verifier-required, widened-authority, missing-receipt, and approval/execution divergence cases leave the fast lane.

Fast path does not mean weaker governance. It means the full governance decision has been compiled into local material whose decision is equivalent when policy, state, identity, capability, authority, and action fingerprint remain fresh and matching.
