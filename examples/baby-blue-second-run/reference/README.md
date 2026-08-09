# OSuite + Baby Blue second reference run

This directory contains a repeatable reference packet for a judgment-validity case:

- The approved and executed CAVA action fingerprints match.
- The runtime boundary check reports no drift.
- OSuite still requires review because the action is high-risk.
- The judgment-validity lane rejects the action because the business context includes fraud-hold and counterparty-mismatch signals.

Live Baby Blue mode: not used for this packet
Baby Blue base URL: https://api.babyblueviper.com

## Files

- `case.json`: benchmark case input.
- `review-request.json`: request body suitable for Baby Blue `POST /review`.
- `packet.json`: OSuite reference packet with CAVA fingerprint, artifact hash, review request, and optional live verifier response.
- `verify-payload.json`: payload to use with Baby Blue `/verify-proof` after a live signed response exists.
- `verification.json`: local recomputation result for action fingerprint, artifact hash, and judgment verdict.

## Local verification

```bash
node scripts/prepare-baby-blue-second-run.mjs --output examples/baby-blue-second-run/reference
```

## Live verifier run

```bash
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-second-run.mjs --live
# or
BABYBLUE_IVV_BEARER=... node scripts/prepare-baby-blue-second-run.mjs --live
```

Verification result: valid
Failures: none
