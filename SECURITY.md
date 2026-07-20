# Security Policy

## Reporting Security Issues

Please do not open a public GitHub issue for a vulnerability involving credentials, private data, or a bypass affecting a production deployment.

Report security concerns to:

```text
security@osuite.ai
```

If the issue is only about a benchmark case, documentation typo, or non-sensitive runner behavior, a public GitHub issue is fine.

## Scope

In scope:

- benchmark runner behavior
- schema issues
- unsafe sample data
- report generation bugs
- examples that accidentally include sensitive material

Out of scope:

- unrelated OSuite SaaS account issues
- third-party runtime vulnerabilities
- social engineering attempts
- denial-of-service testing against public services

## Safe Testing

This repository is designed for local, synthetic benchmark runs. Do not point examples at production systems unless you own them and have explicit authorization.

