# OWASP Project Proposal Draft

Working title:

```text
Agent Action Boundary Benchmark
```

## Project Summary

Agentic AI systems increasingly act through tools, workflows, browser automation, shell commands, MCP servers, and enterprise connectors. Most governance discussions focus on prompts, outputs, or model behavior, but high-risk enterprise failures often occur when an approved intent becomes a different runtime action.

The Agent Action Boundary Benchmark provides an open benchmark, schema, and reference runner for evaluating AI agent runtime boundaries. It helps builders and security teams test whether an action that executes, or is about to execute, remains inside the boundary of the action that was reviewed, approved, or policy-checked.

## Project Type

Recommended OWASP type:

```text
Code / Tooling project with companion documentation
```

The repository contains:

- benchmark cases
- a generated 6,000-record runtime boundary corpus
- action boundary schema
- runnable Node.js reference runner
- generated reports
- baseline comparison tables
- guidance documents
- demo flows for Codex, MCP, browser agents, Dify, and n8n

## Target Audience

- AppSec teams evaluating agentic AI applications
- AI security researchers
- workflow automation builders
- MCP server developers
- enterprise AI governance teams
- security architects designing approval and audit controls

## Security Problem

Recorded or delegated workflows can drift between approval and execution.

Examples:

- a read-only report summary becomes a public publish action
- a demo customer lookup becomes a production customer lookup
- an internal draft becomes a customer-facing email
- a refund recommendation becomes a payment ledger mutation
- a verifier proof is valid for one action fingerprint but reused against another

Traditional logs can record that something happened. This benchmark focuses on whether the executed or proposed action still matches the approved action boundary.

## Initial Deliverables

1. Benchmark schema for approved and executed agent actions.
2. Compact hand-written JSONL cases for walkthroughs and demos.
3. Generated 6,000-record runtime boundary corpus covering 18 runtime surfaces, 46 scenario families, 6 locales, 10 obfuscation styles, and 750 judgment-validity records.
4. Reference runner that canonicalizes actions, computes fingerprints, detects drift, and emits reports.
5. Baseline comparisons for runtime-label, operation-only, effect/destination, and partial-resource matching.
6. Documentation describing the action boundary model and methodology.
7. Demo guide for Black Hat Arsenal-style hands-on presentation.

## Roadmap

### Phase 1: Public Benchmark Baseline

- Maintain the first benchmark corpus.
- Maintain the 6,000-record generated runtime corpus.
- Add schema validation.
- Add report examples and CI.
- Maintain the judgment-validity lane for boundary-valid but contextually unsafe actions.
- Invite issue-based feedback from security practitioners.

### Phase 2: Runtime Adapters

- Add optional adapters for MCP tool-call records.
- Add optional adapters for browser automation traces.
- Add optional adapters for workflow tools such as n8n and Dify.
- Add optional adapters for local agent hooks.

### Phase 3: Community Alignment

- Map cases to OWASP GenAI and agentic AI risk categories.
- Add community-contributed cases.
- Add mitigation examples.
- Publish a practical guide for approval-execution drift testing.

## Non-Goals

- This project is not a replacement for IAM, SIEM, EDR, DLP, or model evaluation.
- This project does not claim to solve all AI alignment or AI safety issues.
- This project does not require OSuite to run.
- This project should not be used as a paid product pitch.

## Maintainer Information

Initial maintainer:

```text
Ond Holdings Inc.
```

Public links:

- Project repository: `https://github.com/OndCo/Agent-Action-Boundary-Benchmark`
- Related OSuite site: `https://osuite.ai`
- Related research: CAVA and PCAA publications

## Suggested OWASP Positioning

Short description:

```text
An open benchmark for detecting approval-execution drift in AI agent actions.
```

Long description:

```text
Agentic AI systems increasingly act through tools, workflows, browsers, terminals, and enterprise connectors. This project provides an open benchmark and reference runner for testing whether an executed agent action remains inside the boundary of the action that was approved or policy-checked.
```
