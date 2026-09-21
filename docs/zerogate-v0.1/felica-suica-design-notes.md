# FeliCa/Suica design notes for ZeroGate Action Pass

These notes record the public design facts used by the ZeroGate Action Pass paper. They are intentionally conservative: FeliCa/Suica is used as a systems-design reference, not as a claim that OSuite inherits payment-card security or JR East production guarantees.

## Sources used

| Source | Public URL | Used for |
| --- | --- | --- |
| Sony Corporation, “The FeliCa System” | `https://www.sony.co.jp/en/Products/felica/about/scheme.html` | Time-slot anti-collision, fewer transaction steps, 0.1-second card/reader transaction, anti-tear behavior, multi-application access isolation. |
| Sony Corporation, “Technical Information” | `https://www.sony.net/Products/felica/business/tech-support/` | Evidence that command-sequence and protocol details exist in formal manuals; the public overview is not treated as the full protocol specification. |
| Akio Shiibashi, “Development of Suica Autonomous Decentralized IC Card Ticket System,” Japan Railway & Transport Review 50 | `https://www.ejrcf.or.jp/jrtr/jrtr50/6_15.html` | JR East deployment constraints: roughly 24 million daily ticket-gate transactions, fastest card residence around 0.2 seconds, card-reader processing target below 0.1 seconds, autonomous decentralized gates, data damming, and commercialization constraints. |
| JR East Suica English information page | `https://www.jreast.co.jp/en/multi/pass/suica.html` | Public user-facing operation of Suica as a prepaid card used for transit and purchases. |
| JEIS Suica and Station Services Solutions | `https://www.jeis.co.jp/en/solution/suica/` | Commercial system context: card balances, transaction histories, station systems, e-money terminals, routing, and inter-enterprise settlement. |

## Design principles extracted

| FeliCa/Suica principle | Conservative reading | ZeroGate Action Pass translation |
| --- | --- | --- |
| Fast polling and short card residence | The user does not stop to complete a long remote decision; the reader has a tiny interaction window. | Prepare identity, policy, risk, and verifier route before the action boundary; consume a bounded pass locally at commit time. |
| Time-slot collision avoidance | Multiple candidate cards or events must not create ambiguous selection. | Same-slot resource conflicts are explicit boundary facts and route to slow review instead of fast execution. |
| Fewer synchronous transaction steps | The speed gain comes from reducing commit-time protocol work, not merely faster servers. | The common path checks hash, fingerprint, digest, authority subset, nonce/budget, slot conflict, and receipt sink locally. |
| Anti-tear transaction integrity | A partial interaction must not leave inconsistent committed state. | A runtime cannot execute if the minimum synchronous receipt cannot be written. |
| Autonomous decentralized operation | Gates keep basic service running even when central links fail, while central systems reconcile later. | A fresh local pass may allow common actions while durable proof export and external verifier enrichment happen after receipt. |
| Touch-and-go as product design | JR East shaped the user gesture so the technical window became reliable. | OSuite must make “carry pass, tap boundary, prove later” visible in product UX, not just hidden in the runtime. |
| Card/application separation | A physical card can carry different applications without making every reader all-powerful. | Action Passes must remain scoped to one holder, runtime session, action fingerprint, authority tuple, policy/state snapshot, and privacy posture. |
| Exceptional paths stay outside the gate | Not every condition belongs in the fast interaction window. | Revocation epoch drift, missing state predicates, privacy exposure, verifier-required actions, and same-slot conflicts leave the fast lane. |
| Passage is not just counting tokens | A robust gate experience distinguishes the passage object from surrounding context and ambiguous movement. | Action Crowd Control separates primary side effects from context baggage, dependent subactions, tailgating side effects, and resource collisions. |
| Capacity is not just more gates | High-volume systems need finite-capacity routing, not only faster local checks. | Operations-research routing folds context, coalesces related conflicts, schedules critical slow-lane work by deadline, and prevents low-urgency ambiguity from starving urgent boundary conflicts. |

## Figure rationale

The paper uses four explanatory diagrams to make the Suica/FeliCa transfer concrete without overclaiming:

- `Boundary-time Gantt view` shows the critical-path move: conventional governance places canonicalization, policy, state, approval, verifier, and proof work on the side-effect path, while ZeroGate moves stable work before the boundary and proof enrichment after a minimum receipt.
- `System-shape transfer` maps the transit system shape to agent governance: bounded object, local gate, exception handling, local cache, and later settlement/replay.
- `Action-stream recognition before review` makes the high-volume analogy explicit: a governed runtime must distinguish the action-bearing side effect from context baggage, dependent work, piggybacked side effects, resource collisions, and ambiguous boundary evidence.
- `Finite-capacity routing view` shows that speed is not only a local evaluator benchmark. Once slow-lane capacity is finite, the system needs coalescing and scheduling rather than a linear review queue.

## Non-overclaim guardrails

- Do not claim OSuite equals FeliCa’s 0.1-second hardware/card transaction.
- Do not claim Suica is fully decentralized; JR East still uses station and center systems for data matching, management, and settlement.
- Do not claim anti-tear solves all fraud or end-to-end accounting risks; it addresses partial card write consistency.
- Do not present weighted synthetic benchmark mixes as observed production traffic.
- Do not treat a JavaScript local evaluator microbenchmark as a production SLA.
- Do not imply ZeroGate replaces CAVA, PCAA, BAF, AREG, A2A, MCP, IAM, or a runtime harness. It is the pass consumed at the action boundary.
- Do not imply a pass is a bearer token. Production passes require issuer signatures, holder/session binding, revocation freshness, aggregate-budget checks, and receipt persistence.
- Do not imply all actions should become instant. The instant path is only for fresh, matching, locally sufficient, minimized, low-risk actions.
- Do not claim public Suica/FeliCa sources disclose the full passenger-classification implementation. Use that idea only as a conservative systems analogy: high-throughput gates need context recognition, not just raw token counting.
- Do not claim the operations-research routing model is observed customer traffic or a production SLA. It is a deterministic queueing/scheduling scenario over the published action-crowd-control corpus.

## Required evidence language

When citing the load study, use this wording:

> The concurrent load study executes the real `packages/cava-core` Action Pass evaluator path under worker concurrency. The workload inputs are deterministic and synthetic for reproducibility; the evaluator, receipt generation, lane decisions, and failure reasons are not mocked. This is not live customer production traffic.
