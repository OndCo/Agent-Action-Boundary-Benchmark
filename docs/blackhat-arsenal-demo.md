# Black Hat Arsenal Demo Plan

Working title:

```text
CAVA Action Boundary Benchmark: Detecting Approval-Execution Drift in AI Agent Actions
```

## One-Sentence Abstract

An open-source benchmark and runner that detects when an AI agent executes a different action than the one approved, recorded, or policy-checked.

## Why Arsenal

Black Hat Arsenal favors tools that security practitioners can inspect, run, and discuss hands-on. This repository is designed as a runnable security demo:

- it is open source
- it runs locally
- it has concrete cases
- it produces explainable reports
- it avoids paid-product pitching
- it focuses on an emerging security boundary: AI agent runtime actions

## Demo Flow

### 1. Start With The Problem

Show a recorded or approved workflow:

```text
Approved: read an internal report and summarize it locally.
Executed: publish the report to a public blog.
```

Explain the difference between transcript replay and action-boundary replay.

### 2. Run The Tool

```bash
npm install
npm test
npm run report
```

Show the drift classes:

```text
effect_drift
boundary_drift
parameter_drift
policy_drift
```

### 3. Show Fingerprints

Open `reports/latest-report.md`.

Highlight:

- approved action fingerprint
- executed action fingerprint
- whether fingerprints match
- control outcome

### 4. Walk Through Three Runtimes

Recommended live cases:

1. Codex recorded workflow: read-only summary becomes public publish.
2. MCP tool call: demo customer lookup becomes production customer lookup.
3. n8n marketplace workflow: refund recommendation becomes ledger mutation.

### 5. Show External Verifier Case

Demonstrate why a verifier decision bound to one action hash becomes stale if the runtime action changes.

This connects action-boundary drift to independently replayable proof.

## Demo Commands

```bash
git clone https://github.com/OndCo/Agent-Action-Boundary-Benchmark.git
cd Agent-Action-Boundary-Benchmark
npm install
npm test
npm run report
open reports/latest-report.md
```

## Submission Notes

Recommended track:

```text
AI, ML & Data Science
```

Secondary track:

```text
AppSec / Tooling / Blue Team
```

Recommended audience:

- AppSec engineers
- AI security teams
- blue team operators
- enterprise architects
- security researchers working on agentic AI

## What Not To Say

Avoid:

- "Buy OSuite"
- "This solves all AI governance"
- "This proves model safety"
- "This replaces existing security tooling"

Say instead:

- "This benchmark tests one runtime control question."
- "Did execution remain inside the approved action boundary?"
- "The benchmark is open and reproducible."
- "Production systems can integrate this boundary object into approval, proof, and audit flows."

## Five-Minute Script

```text
AI agents are becoming good at repeating work. But repeating work safely requires knowing whether the action that executed stayed inside the action that was approved.

This benchmark gives us a small, testable object: the action boundary.

Each case has an approved action and an executed action. The runner canonicalizes both, computes fingerprints, compares material fields, classifies drift, and recommends allow, review, or block.

Here is a Codex-style recorded workflow. It was approved to read and summarize a report locally. The executed action publishes that same report publicly. A transcript might describe both as working with the report. The action boundary says they are different actions.

Now we run the benchmark. The runner detects effect drift, boundary drift, parameter drift, and policy drift. The control outcome is block.

The same pattern applies to MCP tool calls, browser agents, n8n workflows, Dify workflows, and external verifier proofs.

The goal is not to replace IAM or SIEM. The goal is to create a stable runtime object that those systems can reason about: what exact action was approved, what exact action ran, and whether the proof can be replayed later.
```

