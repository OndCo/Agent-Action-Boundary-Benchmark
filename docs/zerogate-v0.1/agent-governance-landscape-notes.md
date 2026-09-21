# Agent governance landscape notes for ZeroGate

These notes separate what external standards and vendor systems already cover from the narrower ZeroGate Action Pass claim.

## Sources checked

| Source | URL | Relevant fact |
| --- | --- | --- |
| NIST AI Agent Standards Initiative | `https://www.nist.gov/news-events/news/2026/02/announcing-ai-agent-standards-initiative-interoperable-and-secure` | NIST frames AI agents as autonomous actors that need secure, interoperable standards, including work on agent security, identity, and authorization. |
| OWASP Top 10 for Agentic Applications 2026 | `https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/` | OWASP frames agentic systems as applications that plan, act, and make decisions across workflows, requiring operational security controls. |
| Microsoft Agent 365 | `https://www.microsoft.com/en-us/copilot/blog/2025/11/18/microsoft-agent-365-the-control-plane-for-ai-agents/` | Microsoft positions Agent 365 as a control plane for agent fleet registry, access control, visualization, interoperability, and security. |
| Anthropic Claude Code auto mode | `https://claude.com/blog/auto-mode-default-in-claude-code` | Anthropic frames permission fatigue as a real operational problem and routes tool calls through an auto-mode classifier to reduce interruptions while catching dangerous actions. |
| MCP Authorization | `https://modelcontextprotocol.io/specification/draft/basic/authorization` | MCP authorization is transport/resource authorization using OAuth-style tokens, scopes, protected resource metadata, and step-up scope handling. |
| A2A Protocol | `https://github.com/a2aproject/A2A` | A2A is an interoperability protocol for communication and collaboration between opaque agentic applications. |
| OpenAI Agents SDK | `https://openai.github.io/openai-agents-python/` | The Agents SDK provides agents, tools, guardrails, handoffs, sessions, tracing, sandbox agents, and human-in-the-loop mechanisms. |

## Positioning

ZeroGate should not claim to replace these layers.

- NIST/OWASP motivate the need for secure and governable agent systems.
- Microsoft Agent 365 validates the enterprise control-plane category.
- Anthropic auto mode validates the user-experience problem with per-action prompts.
- MCP and A2A validate protocol-level tool and agent interoperability.
- OpenAI Agents SDK validates harness-level orchestration, guardrails, tracing, and HITL.

ZeroGate's narrower claim is the action-boundary object: after identity, authorization, policy, and action canonicalization have produced a narrowed grant, the runtime should be able to consume that grant locally as a bounded pass and later prove what crossed the boundary.

## Stronger differentiation after the revocation/state-predicate pass

The latest ZeroGate benchmark extends the pass from a simple action+policy digest object into a stricter commit-boundary contract:

- Revocation is represented as a freshness boundary, not an after-the-fact audit note.
- State predicates are named separately from a state digest, so reviewers can see which semantic facts the fast lane depended on.
- Aggregate budgets prevent many individually valid passes from bypassing team, tenant, account, wallet, or daily limits.
- Privacy minimization is treated as a fast-lane condition: raw sensitive material in pass fields should push the action to review or redaction.
- Receipt persistence is a gate condition, not a logging best effort.

This makes ZeroGate easier to distinguish from harness-level approvals. A harness can carry the pass, call the gate, or enforce the outcome. The harness is not automatically the proof object or the independent authority boundary.

## Overclaim guardrails

- Do not say ZeroGate is the only possible control plane.
- Do not say Action Pass replaces OAuth scopes, A2A identity, MCP authorization, or harness approvals.
- Do not say local evaluator latency is an end-to-end customer SLA.
- Do not say native vendor control planes are weak; say they are strong inside their own trust boundary but are not necessarily independent, cross-vendor proof objects.
- Do not say classifiers are useless; say they are complementary but less replayable than an action-bound pass plus receipt.
- Do not say Action Pass makes external revocation unnecessary; say short TTLs reduce stale-pass risk and revocation epochs surface the remaining timing window.
- Do not say state digests alone prove business facts; named predicates and held-out evaluation are needed for semantic state claims.

## Paper implication

The paper should say the field is converging on agent identity, runtime permissions, guardrails, and control planes. ZeroGate's contribution is not the broad category. Its contribution is a compact, replay-compatible, locally consumable action pass that preserves an earlier governance decision at the final side-effect boundary.
