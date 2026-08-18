# OSuite + Baby Blue GitHub SaaS reference run

This directory contains an approval-bound SaaS operation reference packet:

- OSuite represents a GitHub issue creation as a CAVA action artifact.
- Baby Blue / invinoveritas can review the artifact before execution.
- OSuite can self-submit the signed verifier event to Baby Blue `/ledger/submit`.
- OSuite can execute the approved GitHub issue creation and bind the final outcome back into the packet.

Live Baby Blue mode: enabled
Ledger submit: enabled
GitHub side effect: enabled
Baby Blue base URL: https://api.babyblueviper.com
GitHub target: OndCo/Agent-Action-Boundary-Benchmark
Run ID: bbv-v11-github-saas-2026-08-18-1816z

## Files

- `case.json`: benchmark case input.
- `issue-spec.json`: exact public GitHub issue title/body hash and target.
- `review-request.json`: request body suitable for Baby Blue `POST /review`.
- `packet.json`: OSuite reference packet with CAVA fingerprint, artifact hash, verifier response, ledger response, and optional GitHub outcome.
- `verify-payload.json`: payload to use with Baby Blue `/verify-proof`.
- `proof-verification.json`: live `/verify-proof` result when available.
- `ledger-submit-payload.json`: payload sent to Baby Blue `/ledger/submit` when available.
- `ledger-response.json`: live ledger response when submitted.
- `ledger-entry.json`: public ledger entry fetched back from Baby Blue after self-submit.
- `github-outcome.json`: live GitHub issue outcome when executed.
- `verification.json`: local recomputation result for action fingerprint, artifact hash, judgment, and outcome binding.

## Local verification

```bash
node scripts/prepare-baby-blue-github-saas-run.mjs --output examples/baby-blue-github-saas-run/reference
```

## Live verifier run

```bash
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live --submit-ledger
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live --submit-ledger --execute-github
```

Verification result: valid
Failures: none
Proof verification: true
Ledger response: https://api.babyblueviper.com/ledger/246
GitHub outcome: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/issues/2
