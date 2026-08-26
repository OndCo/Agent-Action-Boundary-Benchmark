# Materials for Skill Boundary Collaboration

This note collects the materials to send for the first asynchronous discussion with Shuwen.

## Suggested order to send

1. v2 research artifact note: `docs/skill-boundary-v2-research-artifact.md`
2. Runnable v2 experiment report: `reports/skill-boundary-v2-experiment.md`
3. Machine-readable v2 experiment output: `reports/skill-boundary-v2-experiment.json`
4. Original one-page experiment brief: `docs/skill-boundary-experiment-one-pager.md`
5. External verifier reference run: `runs/baby-blue-v11-github-saas-run/2026-08-18-1816z/README.md`

## What the one-page brief covers

The brief frames the shared research question:

> Can a skill-level boundary contract be translated into runtime constraints, and can the same boundary be preserved when equivalent or violating actions appear through MCP, SDK, and shell runtimes?

The designer-facing page should include:

- a compact skill contract block;
- a mapping diagram: `Skill Contract -> OSuite Policy -> CAVA Action -> Runtime Evidence`;
- a 3-by-5 runtime matrix for MCP, SDK, and shell;
- metrics for exact control match, allowed-action pass rate, violation block rate, and boundary consistency.

## What the runnable experiments do

The prototype defines a `skill.refund-review.v1` contract. The skill is allowed to read one support ticket and draft an internal refund-risk note. It is not allowed to send customer email, export production ticket data, or issue refunds.

The experiment maps that contract into OSuite policy fields and CAVA action fields, then evaluates 15 runtime cases:

- 2 allowed scenario groups;
- 3 boundary-violating scenario groups;
- 3 runtime lanes: MCP, SDK, shell.

After Shuwen's follow-up question, the boundary evaluator also includes a concrete numeric predicate check for bounded payment actions: `max_amount_usd`. In the minimal refund example, `amount_usd = 73` stays inside `max_amount_usd = 100`, while `amount_usd = 125` is treated as policy drift and blocked. This keeps CAVA as the action representation layer while making the policy predicate explicit.

Run it with:

```bash
npm run skill-boundary
```

Current result:

```text
Skill boundary experiment: 15/15 exact matches
Runtimes: 3
Scenario groups: 5
Allowed action pass rate: 100.0%
Violation block rate: 100.0%
Boundary consistency rate: 100.0%
```

The v2 artifact responds to Shuwen's follow-up framing by separating three layers:

- a vendor-neutral skill boundary that describes requested authority;
- runtime authorization that can narrow, deny, or escalate that request;
- OSuite/CAVA as one reference mapping from the neutral boundary into concrete runtime action evidence.

The v2 experiment uses a bounded refund operations skill. It checks MCP, SDK, shell, and workflow representations of equivalent and violating actions. The concrete numeric predicate is the refund example from the email thread: a `refund $73` action satisfies `max_amount_usd = 100`, a `refund $125` action is blocked, a runtime-narrowed `refund $90` action is blocked when the workspace limit is `$75`, a runtime-denied `$73` refund is blocked when the current identity lacks refund authority, and a refund with no amount evidence is escalated to review.

Run it with:

```bash
npm run skill-boundary:v2
```

Expected current result:

```text
Skill boundary v2 experiment: 32/32 exact matches
Runtimes: 4
Scenario groups: 8
Allowed action pass rate: 100.0%
Violation block rate: 100.0%
Escalation match rate: 100.0%
Boundary consistency rate: 100.0%
```

## External verifier run to include as background

The Baby Blue v11 reference run shows the downstream proof side of the same architecture:

- OSuite represents a real GitHub issue creation as a CAVA action artifact.
- Baby Blue `/review` returns an `approve_with_concerns` external verifier verdict.
- OSuite self-submits the signed event to Baby Blue `/ledger/submit`.
- The final GitHub issue body hash is checked against the approved action packet.

Useful public references from that run:

- Baby Blue ledger entry: https://api.babyblueviper.com/ledger/246
- GitHub issue outcome: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/issues/2
- Local packet: `runs/baby-blue-v11-github-saas-run/2026-08-18-1816z/packet.json`
- Local verify payload: `runs/baby-blue-v11-github-saas-run/2026-08-18-1816z/verify-payload.json`
- Local verification result: `runs/baby-blue-v11-github-saas-run/2026-08-18-1816z/verification.json`

## Suggested email framing

The shortest useful framing is:

> I put together a small first experiment around the interface we discussed. It defines a minimal skill boundary contract, maps it into OSuite policy and CAVA fields, and runs equivalent plus violating actions across MCP, SDK, and shell. The first version is deliberately small, but it gives us a concrete object to critique: what belongs in the skill contract, what should be enforced at runtime, and what evidence should survive into the proof bundle.

Then include the one-page brief and report paths/links.

For the v2 follow-up, use:

> I updated the experiment around the research framing you proposed: the boundary contract is now vendor-neutral, OSuite/CAVA is only a reference mapping, and runtime authorization can narrow or deny the skill's requested authority. The new run includes the concrete refund predicate example: `max_amount_usd = 100`, `amount_usd = 73` allowed, `amount_usd = 125` blocked, runtime-narrowed `$75` limit blocks a `$90` refund, runtime-denied refund authority blocks a `$73` refund, and missing amount evidence escalates to review.
