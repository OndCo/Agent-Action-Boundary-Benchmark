# Runtime Boundary Benchmark Methodology

This document explains how the 6,000-record OSuite Runtime Boundary Benchmark corpus is generated, scored, and bounded.

## Benchmark Question

The benchmark asks one operational security question:

> Given an approved or proposed agent action, can a boundary runner classify whether the action should be allowed, reviewed, dual-approved, or blocked before execution?

It does not evaluate model alignment, model capability, prompt toxicity, or every possible runtime exploit.

## Corpus Generation

The corpus is generated deterministically by:

```bash
npm run generate:runtime
```

Default configuration:

| Dimension | Value |
| --- | ---: |
| Records | 6,000 |
| Safe baselines | 1,000 |
| Risky records | 5,000 |
| Runtime surfaces | 18 |
| Scenario families | 46 |
| Locales | 6 |
| Obfuscation styles | 10 |
| Judgment-validity records | 750 |
| Contextual-risk records | 637 |

The generator is deterministic for a given seed. The default seed is:

```text
osuite-runtime-boundary-v1
```

Use a different count or seed:

```bash
node scripts/generate-runtime-boundary-corpus.mjs --count 10000 --seed your-seed
```

## Record Shape

Each record contains:

- `approved_action`: the action that is inside the reviewed boundary.
- `executed_action`: the action that would execute.
- `policy`: allowed effects, destinations, resource prefixes, identities, and approval posture.
- `expected`: the expected drift class and control result.
- `judgment_context`: optional independent-judgment inputs for cases where the boundary is valid but the action may still be contextually wrong.
- `family`, `severity`, `locale`, and `obfuscation`: metadata for analysis.

## Control Labels

| Label | Meaning |
| --- | --- |
| `allow` | The action stays inside the approved boundary. |
| `require_review` | The action changed, but the change is bounded and reviewable. |
| `require_dual_approval` | The action is in scope but needs stronger authority. |
| `block` | The action crosses a material boundary or violates policy. |

## Drift Classes

| Drift class | Meaning |
| --- | --- |
| `none` | No material drift. |
| `parameter_drift` | Material parameters changed. |
| `resource_drift` | Affected resource changed. |
| `boundary_drift` | Destination or visibility boundary changed. |
| `effect_drift` | Side effect changed. |
| `identity_drift` | Acting identity changed. |
| `policy_drift` | Execution no longer matches the policy checked. |

## Judgment-Validity Lane

Runtime firewalls and action-boundary proofs answer important but bounded questions:

- Is this action shape known to be unsafe?
- Did the executed action match the approved action?
- Was the approval reused outside its intended scope?

They do not always answer a separate question:

> Is this exact action, in this exact business context, still a sound action to take?

The judgment-validity lane covers cases where `approved_action` and `executed_action` remain fingerprint-identical, but the business context should produce an external verdict:

| Verdict | Meaning |
| --- | --- |
| `approve` | Boundary and context are acceptable. |
| `approve_with_concerns` | Boundary holds, but the evidence has concerns such as stale state, weak chain of custody, or possible raw-secret exposure. |
| `reject` | Boundary holds, but context creates a hard blocker such as account fraud hold, compliance hold, counterparty mismatch, or missing required business state. |

This lane is designed to model the seam between OSuite/CAVA-style action identity and an independent verifier such as Baby Blue / invinoveritas. It keeps boundary proof and contextual judgment separate so evaluators can decide which layer should own each failure mode.

## Scoring

Run:

```bash
npm run report:runtime
```

The report writes:

```text
reports/runtime-boundary-benchmark.md
reports/runtime-boundary-benchmark.json
reports/runtime-boundary-benchmark.baselines.csv
reports/runtime-boundary-benchmark.runtimes.csv
reports/runtime-boundary-benchmark.families.csv
```

The headline score combines:

- exact expected-control and drift match
- risky-record protection rate
- safe-baseline allow rate
- critical-control rate
- drift-detection rate

The report also emits judgment-specific metrics:

- judgment exact-match rate
- contextual-risk detection rate
- expected judgment distribution

## Baselines

The report compares the reference boundary runner against intentionally simple baselines:

| Baseline | What it checks |
| --- | --- |
| Runtime label | Whether the runtime name changed. |
| Operation only | Whether the operation string changed. |
| Effect/destination | Whether the side effect and destination changed. |
| Resource/effect/destination | Whether a partial resource and side-effect tuple changed. |

These baselines are not meant to be state-of-the-art security products. They represent common shortcuts that appear in agent governance discussions: allowlists by tool name, runtime name, operation name, or partial resource fields.

## How To Interpret 100% Results

The reference runner is expected to score perfectly against this generated corpus because the corpus is designed to test the action-boundary representation directly.

The useful comparison is not “100% means universal safety.” It is:

```text
boundary object > runtime label
boundary object > tool name
boundary object > operation string
boundary object > partial resource tuple
```

The benchmark demonstrates why action identity needs to include actor, policy, resource, effect, destination, approval posture, and rollback expectations.

## Limitations

- The corpus is synthetic.
- It does not include every real runtime adapter shape.
- It does not prove exploit prevention after execution.
- It does not replace tenant policy, human approval, or production evidence collection.
- It tests action-boundary classification once an action is represented.

Production OSuite adds runtime adapters, policy profiles, BAF approval leases, AREG runtime maps, proof bundles, and operational review workflows around this open benchmark model.
