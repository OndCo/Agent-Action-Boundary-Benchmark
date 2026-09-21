# Action Pass Dataset Audit

This note summarizes the dataset controls behind the ZeroGate / Action Pass benchmark. It is written for review, not marketing. The goal is to make clear which claims are supported by the artifact, which claims are not supported yet, and how a third party can rerun the evidence.

## Claim Boundary

The benchmark has eight validation views. They are not equally strong evidence for the same claim, so the supported claim is stated separately for each view.

| Layer | What it supports | What it does not support |
| --- | --- | --- |
| Synthetic stress oracle | Whether the reference evaluator preserves the frozen fast/slow/block lane semantics over authored action families and mutation classes. | Real-world semantic accuracy, production traffic distribution, or general parser accuracy. |
| Measured local decision-function comparison | Whether trivial local checks and the real ZeroGate evaluator differ on the same 360 pass/observation pairs. | Closed-vendor product performance, production SLA, or proof that the modeled baselines match every vendor implementation. |
| Noisy evidence calibration | Whether the system degrades conservatively under wrapper obfuscation, missing state evidence, locale/free-text noise, same-slot crowd pressure, and adversarial near misses. | Customer production rates or independently labeled accuracy. |
| Public GitHub Actions corpus | Parser coverage, abstention, unsupported surfaces, and routing distribution over real public workflow artifacts. | Semantic correctness, false-allow rate, or representativeness across all agent runtimes. |
| Multi-runtime fixture corpus | Whether one vendor-neutral boundary can be projected into multiple runtime event shapes and consumed by the same Action Pass evaluator. | Empirical parser accuracy over unconstrained customer or public runtime traffic. |
| Passage-envelope active-support model | Whether a Suica-like local boundary can stay inside a stated 100 ms design envelope under low and moderate action curvature. | Hosted OSuite SLA, JR East/Sony performance equivalence, or proof that high-risk actions should remain fast. |
| Action crowd-control and OR routing | Whether action streams can be classified, folded, coalesced, prioritized, and routed without widening authority. | Observed customer traffic distribution or proof that the selected capacity assumptions are universal. |
| Concurrent implementation load study | Whether the real evaluator path can sustain high local throughput under worker concurrency. | End-to-end hosted latency, adapter parsing latency, network latency, tool execution latency, or storage durability under customer load. |
| Production-path canaries | Whether OSuite can touch live hosted action-recording and external verifier/SaaS side-effect paths. | Customer production traffic distribution, broad adapter SLA, or proof that all customer deployments meet the same latency profile. |

## Synthetic Stress Oracle

The stress oracle contains 12 action families and 30 mutation classes, producing 360 unweighted stress cases. A weighted common-case mix expands those cases into 5,760 observations to model ordinary low-ambiguity traffic without claiming an empirical production distribution.

The artifact now records:

| Field | Value |
| --- | --- |
| Benchmark spec sha256 | `59c83f8ff16c721bd9d84131044273fdb22de76a1e8e4fa35ac5b707103ba2be` |
| Stress case manifest sha256 | `6d57134401eed72b62016e462d9494d894fa6cc08ab7df66b892a993046a3833` |
| Weighted representative manifest sha256 | `e4624aa23d848ce79dc378fbdbd60873481ba325baed5b5a5a10e94b1a7d7767` |
| Oracle leakage failures | `0 / 360` |
| Evaluator path | `packages/cava-core/src/action-pass.js:evaluateActionPassCommit` |

The oracle leakage audit checks that the pass and observation material consumed by the evaluator do not contain the expected lane or benchmark mutation metadata. The expected lane is only used after evaluation to score the returned lane.

## Frozen Split Views

The split is deterministic and recorded under seed `osuite-action-pass-split-v1`.

Held-out families:

| Family |
| --- |
| `database_export_prepare` |
| `kubernetes_restart` |
| `slack_announcement_post` |
| `vendor_invoice_schedule` |

Held-out mutation classes:

| Mutation |
| --- |
| `state_predicate_drift` |
| `revocation_epoch_stale` |
| `same_slot_resource_conflict` |
| `authority_scope_widening` |
| `aggregate_budget_exhausted` |
| `runtime_session_mismatch` |
| `privacy_boundary_exposed` |
| `pass_hash_tampered` |

| Split | Cases | Exact match | Fast path | Zero wait | Violation | Wilson 95% CI for exact match |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Reference | 176 | 1.0000 | 0.1364 | 0.6364 | 0 | 0.9786-1.0000 |
| Held-out families | 88 | 1.0000 | 0.1364 | 0.6364 | 0 | 0.9582-1.0000 |
| Held-out mutations | 64 | 1.0000 | 0.0000 | 0.5000 | 0 | 0.9434-1.0000 |
| Held-out cross | 32 | 1.0000 | 0.0000 | 0.5000 | 0 | 0.8928-1.0000 |

These split results do not prove real-world generalization. They only show that the reported lane agreement is not confined to the easiest reference families or common-case mutations.

## Measured Local Decision-Function Comparison

The baseline comparison runs three local decision functions over the same 360 pass/observation pairs. It is not a closed-vendor benchmark. Its purpose is to replace purely narrative baseline claims with a small, reproducible comparison on the exact same inputs.

| System | p50 ms | p95 ms | False allow | False block | Evidence completeness | Execute | Review | Deny |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Raw tool permission check | 0.000032 | 0.000077 | 0.9000 | 0 | 0 | 360 | 0 | 0 |
| Broad session approval check | 0.000059 | 0.000096 | 0.8333 | 0 | 0 | 336 | 0 | 24 |
| ZeroGate Action Pass evaluator | 0.086190 | 0.133322 | 0 | 0 | 1 | 36 | 144 | 180 |

The interpretation is deliberately modest. Raw permission and broad session approval are faster because they do not check the action boundary. The ZeroGate evaluator costs more than a trivial bit check but preserves the lane oracle and constructs receipt evidence.

## Noisy Evidence Calibration

The noisy calibration contains 72,750 records. It deliberately makes the results less clean by degrading the evidence available at the boundary.

| Metric | Value |
| --- | ---: |
| Oracle handling match | 0.8457 |
| Fast preservation rate | 0.8240 |
| Local terminal rate | 0.7736 |
| Review or abstain rate | 0.2264 |
| Unsupported rate | 0.0072 |
| Boundary-violation escape rate | 0 |
| Boundary-violation escape upper 95% bound | 0.0001 |

The intended interpretation is conservative: ZeroGate should not maintain an artificially high fast-path rate when evidence becomes noisy. It should preserve the fast lane for sufficiently bound actions and move uncertain cases to slow review, unsupported, or fail-closed outcomes.

## Public Runtime Corpus

The public corpus uses real public GitHub Actions workflow files. It is generated from a saved `source-workflows.json` snapshot rather than live network state unless the caller explicitly sets `ACTION_PASS_PUBLIC_CORPUS_FETCH=1`.

| Field | Value |
| --- | --- |
| Source repositories requested | 30 |
| Repositories with workflow files | 28 |
| Workflow files | 302 |
| Action-like records | 2,500 |
| Source snapshot sha256 | `349b3b7b233e929fc32b27341af194a5542feefe797dba867305caca946c0239` |
| Derived records sha256 | `7a9db3e06e4f67c2c4892f1b6676769d6741bbd29341d7378b640a2cc1733fea` |
| Labeling pack records | 240 |
| Labeling pack sha256 | `6ff7b7493928b3bd1d807800838ba40d0968de922368307c67903d5337811083` |

| Metric | Estimate | Wilson 95% CI |
| --- | ---: | --- |
| Canonicalization success | 0.8236 | 0.808165-0.838042 |
| Abstain or unsupported | 0.1764 | 0.161958-0.191835 |
| Fast lane | 0.3848 | 0.365918-0.404036 |
| Slow lane | 0.4372 | 0.417866-0.456726 |
| Unsupported lane | 0.1764 | 0.161958-0.191835 |

The corpus uses a deterministic repository-level split under seed `osuite-public-corpus-split-v1`.

| Split | Repositories | Records | Canonicalization | Abstain/unsupported | Fast | Slow | Unsupported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reference | 16 | 1,785 | 0.807843 | 0.192157 | 0.367507 | 0.438655 | 0.192157 |
| Held-out | 6 | 715 | 0.862937 | 0.137063 | 0.427972 | 0.433566 | 0.137063 |

Held-out repositories are `facebook/react`, `home-assistant/core`, `huggingface/transformers`, `langchain-ai/langchainjs`, `microsoft/semantic-kernel`, and `modelcontextprotocol/servers`.

The labeling pack is intentionally empty of human labels. It freezes a stratified subset so independent reviewers can later annotate intended action family, operation, effect, resource, destination, evidence completeness, expected boundary outcome, and confidence. Runtime-to-action mapping accuracy and authorization-decision accuracy should only be reported after those labels are frozen and inter-annotator agreement is computed.

## Independent Annotation Protocol

The current release should not be described as independently labeled. It is a frozen labeling pack plus a protocol.

| Item | Requirement |
| --- | --- |
| Annotators | At least two annotators who did not implement the parser or evaluator. A third adjudicator resolves disagreements. |
| Blind material | Annotators receive source workflow context and raw step text, but not expected benchmark labels, parser internals, or post-hoc implementation changes. |
| Label fields | Intended action family, operation, effect, resource, destination, evidence completeness, expected boundary outcome, confidence, and notes. |
| Agreement | Report Cohen's kappa for two annotators or Krippendorff's alpha for three or more before reporting accuracy. |
| Freeze rule | Label schema, adjudication instructions, labels, and held-out split are frozen before parser or evaluator updates are made against the pack. |
| Metrics after labels | Runtime-to-action mapping accuracy, authorization-decision accuracy, false-allow rate, false-block rate, correct review/escalation rate, and cross-runtime consistency. |

The reason for this protocol is simple: coverage is not accuracy. A parser can canonicalize a public runtime record and still misunderstand it. The paper therefore reports public-corpus coverage today and reserves semantic accuracy claims for a future labeled release.

## Production-Path and SLA Evidence

The benchmark distinguishes production-path canaries from production SLA. Two canaries are currently documented:

| Canary | Observed result | Supported claim | Excluded claim |
| --- | --- | --- | --- |
| Hosted Studio smoke | `osuite status` returned HTTP 200; `POST /api/actions` returned 201; `GET /api/actions/{action_id}` returned 200 for `act_86a9196a-e40d-463f-8a4d-5fff1a0b4070`. | The live hosted action-recording path is reachable and can persist a bounded research action record. | Fast-lane SLA, third-party runtime enforcement, customer traffic, or external SaaS execution. |
| Baby Blue v11 + GitHub issue canary | OSuite built a CAVA artifact, received an `approve_with_concerns` v11 verdict, self-submitted ledger entry 246, created GitHub issue 2, and verified the final issue-body hash against the approved body hash. | A real third-party SaaS side effect can be bound to an approved action artifact, signed external verdict, ledger entry, and post-execution content hash. | Universal caller-provenance evidence, broad customer SLA, or semantic parser accuracy on public corpora. |

An end-to-end SLA claim requires repeated tenant canaries with all clocks separated:

| Clock | Must be measured separately |
| --- | --- |
| Prepare | Policy load, state digest load, capability projection, verifier route, and receipt-template preparation. |
| Commit | Local pass consumption, hash/fingerprint/authority/freshness checks, nonce and budget consumption, receipt-sink check. |
| Receipt | Minimum receipt write before side effect. |
| Execute | External tool, SaaS, shell, wallet, browser, or workflow execution latency. |
| Enrich | Proof bundle export, external verifier, graph update, and human-readable replay. |

Until those repeated tenant canaries exist, the correct artifact value is `production_sla_claim=false`.

## Multi-Runtime Fixture Corpus

The multi-runtime fixture corpus contains 528 cases across 12 runtime surfaces, 4 skill families, and 11 variants. The surfaces are `mcp_tool_call`, `sdk_call`, `shell_command`, `workflow_node`, `browser_dom_action`, `saas_api`, `web3_transaction`, `a2a_message`, `agent_harness_hook`, `dify_workflow`, `n8n_workflow`, and `deepseek_harness_plugin`.

| Field | Value |
| --- | --- |
| Cases | 528 |
| Runtime surfaces | 12 |
| Skill families | 4 |
| Variants | 11 |
| Runtime-to-action mapping accuracy | 1.0000 |
| Authorization-decision accuracy | 1.0000 |
| Case manifest sha256 | `3cd1ce4de4376e651342cf6ca9ceca99aa73bc1d5cabc0722533c8cfbc393330` |

This is a fixture result, so the perfect numbers are acceptable only as a regression claim: if adapters project equivalent runtime events into the same CAVA action object, the same Action Pass semantics are consumed consistently. It is not a substitute for the public corpus or future independent labels.

## Passage-Envelope Active-Support Model

The passage-envelope model makes the transportation-system analogy explicit without turning it into a production latency claim. It uses a 100 ms common-boundary design envelope and decomposes the local commit path into six budgeted stages: pass presentation, envelope/hash verification, CAVA fingerprint and authority matching, policy/state/revocation/slot freshness, nonce/budget/receipt consumption, and execute-or-route dispatch.

| Field | Value |
| --- | ---: |
| Passage envelope | 100 ms |
| Batch local evaluator p95 | 0.096947 ms |
| Batch local evaluator p99 | 0.100367 ms |
| P95 budget utilization | 0.000969 |
| P99 budget utilization | 0.001004 |
| Static fast gate mean profile p95 | 197.841383 ms |
| ZeroGate active-support mean profile p95 | 93.404577 ms |
| Linear full-governance mean profile p95 | 980 ms |
| Raw permission modeled false-allow rate | 0.25 |

The active-support profiles vary action curvature rather than simply action count. Low and moderate curvature profiles fit inside the envelope after prewarming, slot reservation, receipt-capacity reservation, and slow-lane coalescing. Policy-churn and emergency-revocation profiles intentionally miss the envelope because the correct behavior is slow review or stop. Active support may reduce avoidable waiting; it may not widen the action, resource, destination, effect, identity, policy, state, budget, or receipt boundary carried by the pass.

## Reviewer Questions and Current Answers

| Likely question | Current answer |
| --- | --- |
| Are the 1.0000 numbers inflated? | They are synthetic regression-oracle agreement, not real-world semantic accuracy. The paper now states this explicitly and adds non-perfect noisy calibration plus real public corpus coverage. |
| Is there oracle leakage? | The artifact checks all 360 evaluator inputs for expected-lane and benchmark-mutation metadata and reports zero failures. |
| Is the public corpus cherry-picked? | The repo list is fixed, public, and reproducible. The report includes source and derived-record hashes, repository coverage, deterministic held-out splits, and stratified samples. |
| Are baselines only strawmen? | The paper still separates scenario baselines from named vendor products, but now adds a measured local decision-function comparison over the same 360 inputs. |
| Are confidence intervals reported? | Yes. Wilson intervals are included for synthetic exact-lane agreement and public-corpus coverage proportions. |
| Is this production traffic? | No. The paper separates synthetic oracle, public corpus, local load study, and hosted smoke check. |
| Is there any live production-path evidence? | Yes, but it is canary evidence rather than customer traffic: a hosted Studio action-recording smoke check and a Baby Blue v11 / GitHub issue side-effect binding run are documented separately. |
| Does the benchmark prove all agent runtimes are covered? | No. Current public-corpus evidence is GitHub Actions only. The new multi-runtime corpus is a fixture corpus, not empirical coverage. Browser, MCP, SaaS, shell, wallet, and workflow runtime corpora remain future evaluation work. |
| Does it prove semantic parser accuracy? | No. That requires independent labels and inter-annotator agreement. The current public corpus reports coverage and abstention only. |
| Does the passage-envelope model prove hosted SLA? | No. It is a local evaluator and deterministic queueing/control model. Hosted latency, storage, network, adapter parsing, and tool execution need separate production evidence. |
| What would count as an end-to-end SLA? | Repeated tenant canaries that separately report prepare, commit, receipt, execute, and proof-enrichment latency by adapter, region, verifier mode, and storage mode. |

## Next Work Before a Stronger Submission

The next dataset upgrade should complete the independently labeled subset. The annotation pack now exists; a defensible version would have at least two annotators label the intended action family and boundary outcome, compute inter-annotator agreement, freeze the labels, and then report mapping accuracy separately from authorization-decision accuracy.

The second upgrade should replace or supplement the fixture corpus with non-GitHub empirical runtime corpora: MCP calls, browser actions, SaaS API mutations, CLI/shell sessions, wallet or contract calls, and workflow-engine traces. Each should report adapter enforcement level: enforce-before-execute, hook-mediated, or observe-only.

The third upgrade should run SLA-style tenant canaries across hosted Studio, at least one enforce-before-execute adapter, one observe-only adapter, and one external SaaS side effect. The output should report p50/p95/p99 separately for prepare, commit, receipt, execute, and enrich rather than folding them into one optimistic average.
