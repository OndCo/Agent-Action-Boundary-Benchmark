# Action Pass

An Action Pass is a bounded, consumable execution ticket for an AI agent action.

The design borrows the operating idea behind transit cards: the common path should not depend on a remote conversation at the gate. The pass carries enough signed state for a local runtime gate to make a deterministic commit decision, while exceptions fall back to a slower governance path.

## What The Pass Is

The pass is not an agent identity token. It is not a broad permission grant. It is not a transcript log.

It is a short-lived authority object bound to:

- one canonical action hash;
- one agent, principal, workspace, and runtime session;
- one policy digest and version;
- one bounded resource, effect, destination, and constraint set;
- one replay condition, expiry window, and nonce;
- one minimum receipt shape that must be emitted synchronously.

The schema is published at:

```text
schemas/action-pass.schema.json
```

## Layering

| Layer | Question | OSuite primitive |
| --- | --- | --- |
| A2A / MCP / harness | Who is communicating and where does the task travel? | Runtime lane |
| Skill boundary | What authority does the skill request? | Neutral skill contract |
| Runtime authorization | What authority is granted now? | Policy evaluator |
| Action Pass | What may pass this gate exactly once? | Bounded execution ticket |
| CAVA | What concrete action is this? | Canonical action hash |
| PCAA | Who held authority and what proof remains? | Proof-carrying action |
| BAF | What boundaries make approval non-reusable? | Bounded lease |
| AREG | Where can exposure travel? | Runtime exposure graph |

Identity gets an agent to the gate. The Action Pass decides whether that specific action can go through it.

## Fast Lane

The fast lane is intentionally small:

```text
canonicalize action
verify pass shape and signature state
check identity, policy digest, capability, expiry, nonce, budget
compare action hash and material boundary fields
emit minimum receipt
commit
```

No LLM call, remote verifier call, approval lookup, policy-server round trip, or full proof export is required on the common path.

## Slow Lane

The slow lane exists for cases that should not be locally committed:

- policy digest drift;
- tool schema drift;
- missing required evidence;
- high-risk or irreversible actions without preapproval;
- external verifier required but not prepared;
- runtime ambiguity;
- operator review required.

The slow lane is not a failure of the design. It is how the system preserves safety while keeping the ordinary path short.

## Fail-Closed Conditions

Some failures do not go to slow review. They fail closed at the gate:

- missing pass;
- invalid pass signature;
- expired or revoked pass;
- consumed nonce;
- action hash mismatch;
- identity mismatch;
- operation/effect/destination outside scope;
- resource outside the granted prefix;
- budget exhaustion;
- inability to emit the minimum synchronous receipt.

## Receipt First, Proof Later

The fast lane emits a small receipt before execution:

```text
pass_id
action_hash
policy_digest
state_digest
nonce
commit_result
receipt_sequence
```

The full proof bundle can be enriched asynchronously, but the later proof must remain cryptographically bound to the synchronous receipt. Otherwise the system is only producing delayed logs, not governed evidence.

## Benchmark

Run the reference lane benchmark:

```bash
npm run action-pass:lanes
```

The report is written to:

```text
reports/action-pass-lane-benchmark.md
reports/action-pass-lane-benchmark.json
```

The benchmark compares fast-lane, slow-lane, and fail-closed outcomes. It is a lane-classification and critical-path model, not a production latency claim.

## ZeroGate v0.1 Research Release

The larger paper-facing release is stored separately from the lightweight runner:

```text
docs/zerogate-v0.1/research-release.md
reports/zerogate-v0.1/
papers/zerogate-v0.1/zerogate-action-pass.pdf
```

Verify the release snapshot:

```bash
npm run zerogate:v0.1:verify
```

The snapshot includes 5,760 weighted common-case observations, 360 adversarial stress cases, 2,500 public GitHub Actions records, 528 multi-runtime fixture cases, and a 700,000-operation concurrent load study over the local evaluator path.
