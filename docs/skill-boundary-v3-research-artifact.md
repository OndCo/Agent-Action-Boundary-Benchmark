# Vendor-Neutral Skill Boundary v3 Research Artifact

## Purpose

This artifact responds to the current Shuwen / OSuite research thread by making the skill boundary contract smaller and more neutral.

The core question is:

> Can a vendor-neutral skill boundary preserve its intended meaning when mapped into different runtime environments, while the runtime authorization layer can still narrow or deny what the skill requests?

v3 is deliberately a working artifact rather than a product integration. It is meant to give both sides a concrete object to refine before expanding the benchmark.

## What Changed From v2

v2 still mixed some runtime policy fields into the skill boundary contract. In particular, fields such as runtime lanes, risk level, approval requirement, and escalation behavior were useful for a product demo but too runtime-shaped for a neutral research contract.

v3 removes those fields from the core contract. The contract only describes requested authority. Runtime policy is supplied separately.

The second change is per-operation semantics. Instead of listing operations, effects, resources, destinations, and constraints independently, each requested operation binds them together:

```json
{
  "operation": "issue_refund",
  "effect": "transfer",
  "resource": {
    "type": "refund_case",
    "pattern": "refund_case/{case_id}",
    "prefix": "refund_case/"
  },
  "destination": "payment_ledger",
  "data_class": "payment_record",
  "constraints": {
    "amount_usd_lte": 100,
    "max_records": 1,
    "external_egress": false
  },
  "required_evidence": ["case_id", "amount_usd"]
}
```

This prevents a false allow caused by independently matching fields that were never intended to compose.

## Files

| File | Purpose |
| --- | --- |
| `schemas/neutral-skill-boundary-contract-v3.schema.json` | Minimal vendor-neutral contract schema. |
| `lib/skill-boundary-v3-core.mjs` | Reference contracts, runtime mappings, evaluator, and scoring. |
| `scripts/run-skill-boundary-v3-experiment.mjs` | Reproducible report runner. |
| `reports/skill-boundary-v3-experiment.md` | Human-readable output from the runner. |
| `reports/skill-boundary-v3-experiment.json` | Machine-readable output from the runner. |
| `tests/skill-boundary-v3-core.test.mjs` | Regression tests for v3 semantics. |

## Command

```bash
npm run skill-boundary:v3
```

## Layer Separation

| Layer | Responsibility |
| --- | --- |
| Skill boundary contract | Declares the authority the skill requests. |
| Runtime authorization context | Narrows, denies, or escalates based on user task, account, identity, workspace, and organization policy. |
| Runtime-to-action mapping | Maps MCP, SDK, shell, or workflow evidence into a concrete action object. |
| Authorization decision | Checks the mapped action against the effective operation-level boundary. |

## Current Scope

The v3 run uses two skill families:

- bounded refund operations;
- internal document review.

Each family is evaluated across four runtime lanes:

- MCP;
- SDK;
- shell;
- workflow.

Each family includes six scenario groups:

- unchanged allowed action;
- operation over requested constraint;
- runtime-narrowed authority;
- runtime-denied authority;
- missing required evidence;
- targeted boundary violation.

The current run therefore contains 48 cases.

## Metrics

v3 intentionally separates two measurements that were previously easy to collapse:

| Metric | Meaning |
| --- | --- |
| Runtime-to-action mapping accuracy | Whether runtime evidence was mapped to the expected neutral action object. |
| Authorization decision accuracy | Whether the mapped action was correctly allowed, blocked, or escalated. |
| Correct review escalation rate | Whether incomplete evidence was escalated instead of silently allowed. |
| False allow rate | Whether a non-allowed action was incorrectly allowed. |
| False block rate | Whether an allowed action was incorrectly blocked. |
| Cross-runtime consistency | Whether equivalent cases produce the same outcome across runtime lanes. |

Current expected result:

```text
Skill boundary v3 experiment: 48 cases
Skill families: 2
Runtime lanes: 4
Runtime-to-action mapping accuracy: 100.0%
Authorization decision accuracy: 100.0%
Correct review escalation rate: 100.0%
False allow rate: 0.0%
False block rate: 0.0%
Cross-runtime consistency rate: 100.0%
```

These numbers describe only this controlled working artifact. They should not be presented as a population-scale claim.

## Anticipated Review Questions

**Why are the current scores 100%?** Because v3 is a controlled semantics artifact, not a generalization benchmark. The point of this run is to check whether the proposed contract structure, runtime mappings, and evaluator agree on the same frozen examples. Generalization should be tested only after the contract semantics are jointly frozen.

**Who defines the expected outcomes?** In this version, expected outcomes are encoded in the case fixtures before the evaluator runs. For the next phase, the expectation is that OSuite and the academic collaborators jointly freeze the schema, threat model, held-out families, runtime mappings, and expected allow/block/review outcomes before running the expanded benchmark.

**Why only two skill families?** The small scope is intentional. Refund operations and document review exercise transfer, read, write, missing-evidence, runtime-narrowing, runtime-denial, and cross-runtime equivalence without expanding the vocabulary too early.

**Is this still OSuite-specific?** The contract schema avoids OSuite and CAVA field names. OSuite/CAVA appears only as one reference implementation for mapping runtime evidence and producing replayable proof.

**What should not be concluded yet?** v3 does not prove that the schema generalizes to every skill, every runtime, or every enterprise policy. It establishes a cleaner object for joint critique before a larger held-out evaluation.

## Held-Out Plan

The following skill families are held out until after the core semantics are frozen:

- procurement approval;
- calendar scheduling;
- cloud IAM change.

The following runtime mappings are also held out:

- browser agent;
- DeepSeek Harness;
- Dify workflow;
- n8n workflow.

The reason for holding them out is methodological: the schema and reference mappings should not be tuned only to the cases used during contract design.

## How This Connects To OSuite / CAVA

OSuite/CAVA is treated as one reference implementation, not as the definition of the neutral skill contract.

The neutral contract says what the skill requests. OSuite maps that request into an effective runtime policy and CAVA represents the concrete runtime action that is being checked. If the action is later approved, executed, or externally verified, OSuite can still export the CAVA proof bundle and verifier references as before.

That keeps the research question vendor-neutral while preserving a practical path into a working system.

## Suggested Next Research Step

Before expanding the benchmark, the next useful step is to jointly refine and freeze:

- the minimal operation-level vocabulary;
- the semantics of constraints and required evidence;
- the threat model for skill declarations that over-request authority;
- the distinction between mapping failure and authorization failure;
- the held-out evaluation plan.

After that, the benchmark can expand without becoming circular.
