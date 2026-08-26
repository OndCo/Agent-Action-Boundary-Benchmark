# Skill Boundary v2 One-Pager

## Title

Vendor-Neutral Skill Boundaries for Runtime-Governed Agents

## Core question

Can a reusable agent skill declare a boundary once, and can that boundary keep the same meaning when the action appears through MCP, SDK, shell, or workflow runtimes?

## Why this matters

Agent skills are becoming reusable units of work. But a skill should not grant itself authority just by describing what it wants to do. The skill can request a boundary; the runtime still has to decide what is allowed for the current user, account, workspace, task, and policy context.

The experiment tests that separation directly.

## Three layers

| Layer | Role | Example |
| --- | --- | --- |
| Skill boundary | Declares requested authority. | The refund skill requests authority to issue refunds up to USD 100. |
| Runtime authorization | Narrows, denies, or escalates the request. | This workspace only permits refunds up to USD 75. |
| CAVA / replay evidence | Represents and checks the concrete action. | `amount_usd = 73` is allowed; `amount_usd = 125` is blocked; missing amount escalates. |

## Minimal contract

```json
{
  "schema_version": "skill-boundary-contract.v2",
  "boundary_id": "boundary.refund-operations.v2",
  "requested_authority": {
    "operations": ["read_support_ticket", "draft_internal_refund_note", "issue_refund"],
    "effects": ["read", "write", "transfer"],
    "destinations": ["support_workspace", "internal_ticket_note", "payment_ledger"],
    "resource_prefixes": ["ticket/T-", "refund_case/"],
    "data_classes": ["support_ticket", "refund_policy", "payment_record"]
  },
  "constraints": {
    "max_records": 1,
    "max_amount_usd": 100,
    "amount_limited_operations": ["issue_refund"],
    "external_egress": false
  }
}
```

## Experiment matrix

| Scenario | MCP | SDK | Shell | Workflow | Expected |
| --- | --- | --- | --- | --- | --- |
| Read one ticket | yes | yes | yes | yes | allow |
| Draft internal note | yes | yes | yes | yes | allow |
| Refund USD 73 under USD 100 | yes | yes | yes | yes | allow |
| Send customer email | yes | yes | yes | yes | block |
| Refund USD 125 over USD 100 | yes | yes | yes | yes | block |
| Refund USD 90 under runtime-narrowed USD 75 | yes | yes | yes | yes | block |
| Refund USD 73 but runtime denies refund authority | yes | yes | yes | yes | block |
| Refund with missing amount evidence | yes | yes | yes | yes | require review |

## Current result

```text
32/32 exact matches
4 runtime lanes
8 scenario groups
100.0% allowed-action pass rate
100.0% violation block rate
100.0% escalation match rate
100.0% boundary consistency
```

## What this proves

The same requested skill boundary can be mapped into concrete runtime evidence, and a runtime authorization layer can still narrow or deny the requested authority without changing the skill contract itself.

## What this does not prove

This is not yet a universal skill-boundary standard. It is a small, reproducible artifact for studying the semantics: what belongs in the contract, what belongs in runtime policy, and what must survive into replayable evidence.
