# Skill Boundary v3: One-Page Research Summary

## Working Question

Can a vendor-neutral skill boundary preserve its intended authority semantics when mapped into different runtime environments, while the runtime authorization layer can still narrow, deny, or require review for what the skill requests?

This summary treats OSuite/CAVA as one reference implementation for runtime mapping and replayable evidence, not as the definition of the boundary contract.

## Core Separation

The v3 artifact separates three layers that were previously easy to mix:

| Layer | What it does | What it should not do |
| --- | --- | --- |
| Skill boundary contract | Declares the authority a skill requests. | It should not grant authority to itself. |
| Runtime authorization context | Narrows, denies, or requires review based on user task, identity, account permissions, workspace policy, and organizational constraints. | It should not widen the skill-declared boundary. |
| Runtime-to-action mapping | Maps concrete MCP, SDK, shell, or workflow evidence into a neutral action object. | It should not decide whether the action is authorized. |

The central invariant is:

> The skill-declared boundary is an upper bound. Runtime authorization may narrow, deny, or require review, but it must never widen the requested authority.

## Contract Shape

The core contract is deliberately small and vendor-neutral. It excludes runtime lanes, risk scores, approval requirements, and escalation behavior. Those are runtime policy concerns, not skill-requested authority.

Requested authority is represented per operation. Each operation binds:

| Field | Meaning |
| --- | --- |
| `operation` | The semantic action requested by the skill, such as `issue_refund`. |
| `effect` | The consequence type, such as `read`, `write`, `transfer`, or `notify`. |
| `resource` | The resource type and pattern the operation may affect. |
| `destination` | The destination or system boundary the effect may reach. |
| `data_class` | The class of data involved. |
| `constraints` | Quantitative or boolean limits, such as `amount_usd_lte` or `external_egress`. |
| `required_evidence` | Runtime evidence required before an action can be evaluated without review. |

This avoids checking fields independently in a way that could admit a combination that was never intended. For example, `issue_refund` is not just a permitted operation name; it is a transfer effect to the payment ledger, over a refund-case resource, under an amount constraint, with required evidence for both `case_id` and `amount_usd`.

## Evaluation Protocol

The v3 evaluation separates two measurements:

| Measurement | Question |
| --- | --- |
| Runtime-to-action mapping accuracy | Did the adapter map runtime evidence into the expected neutral action object? |
| Authorization-decision accuracy | Given the mapped action and effective runtime policy, did the evaluator allow, block, or require review correctly? |

This separation matters because a failure can occur in either layer. A runtime adapter may misread the action, or the authorization evaluator may make the wrong decision after a correct mapping. The protocol should attribute those failures separately.

## Current Controlled Artifact

The current v3 run is intentionally small and controlled:

| Scope item | Current value |
| --- | --- |
| Skill families | Bounded refund operations; internal document review |
| Runtime lanes | MCP, SDK, shell, workflow |
| Controlled cases | 48 |
| Scenario types | Allowed action, over-limit action, runtime-narrowed authority, runtime-denied authority, missing evidence, targeted boundary violation |

Observed result in the reference runner:

| Metric | Result |
| --- | --- |
| Runtime-to-action mapping accuracy | 100.0% |
| Authorization-decision accuracy | 100.0% |
| Correct review escalation rate | 100.0% |
| False allow rate | 0.0% |
| False block rate | 0.0% |
| Cross-runtime consistency | 100.0% |

These are not population-scale claims. They show that the proposed v3 semantics, reference mappings, and evaluator are internally consistent on the controlled examples before a larger held-out evaluation.

## Held-Out Design

The following skill families are intentionally held out until after the core semantics and evaluation protocol are frozen:

| Held-out skill family | Why useful |
| --- | --- |
| Procurement approval | Tests approval, purchase authority, vendor/resource scope, and amount limits. |
| Calendar scheduling | Tests delegated scheduling, participant scope, external invitation boundaries, and reversible/non-reversible effects. |
| Cloud IAM change | Tests high-risk identity, permission widening, infrastructure mutation, and least-privilege constraints. |

The following runtime mappings are also held out:

| Held-out runtime mapping |
| --- |
| Browser agent |
| DeepSeek Harness |
| Dify workflow |
| n8n workflow |

The goal is to reduce circularity: the schema and reference mapper should not be tuned only to the families and runtimes used while designing the contract.

## What Needs To Be Frozen Next

Before expanding the benchmark, the useful joint work is to freeze:

1. The minimal operation-level vocabulary.
2. The semantics of the narrowing-only rule.
3. The treatment of missing, ambiguous, or conflicting runtime evidence.
4. The held-out skill families and runtime mappings.
5. The expected allow/block/review outcomes before running the evaluator.

If those semantics hold, the next phase can expand from a controlled artifact into a stronger research benchmark and potential joint paper.
