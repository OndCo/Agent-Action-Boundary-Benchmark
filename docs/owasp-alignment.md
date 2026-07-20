# OWASP Alignment Notes

This repository is designed to be compatible with OWASP-style open security guidance and tooling.

## Alignment Themes

### Agentic AI Security

Agentic applications introduce runtime risks that are not fully captured by prompt or output review. This benchmark focuses on tool use, workflow execution, and side-effect boundaries.

### Secure Design

The action boundary model makes security requirements explicit:

- allowed effects
- allowed destinations
- approved resources
- acting identities
- rollback expectations
- policy references

### Verification

The benchmark turns an abstract governance claim into a repeatable test:

```text
approved action + executed action -> drift classification + control outcome
```

### Auditability

The report format exposes stable fingerprints and drift reasons, making it easier for reviewers to understand why a workflow was allowed, reviewed, or blocked.

## Candidate Mapping

| Benchmark Concern | OWASP-Style Security Concern |
| --- | --- |
| tool-call resource substitution | authorization and access control |
| public publish after read-only approval | data exposure and business logic abuse |
| external webhook transfer | data exfiltration |
| ledger mutation after draft approval | transaction integrity |
| stale verifier state hash | replayability and proof validity |
| identity drift | workload identity and non-human actor governance |

## Contribution Path

Recommended near-term community contributions:

1. Add more agent runtime cases.
2. Add examples from MCP servers and workflow tools.
3. Add mitigations alongside each drift class.
4. Map benchmark cases to OWASP GenAI and agentic security categories as those categories evolve.

