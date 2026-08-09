#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildBabyBlueReviewRequest,
  buildSecondRunCase,
  buildSecondRunPacket,
  buildVerifyPayload,
  verifySecondRunPacket,
} from '../lib/baby-blue-second-run.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const parsed = {
    output: path.join(rootDir, 'runs', 'baby-blue-second-run', 'latest'),
    live: false,
    baseUrl: process.env.BABYBLUE_BASE_URL || 'https://api.babyblueviper.com',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') parsed.output = path.resolve(rootDir, argv[++index]);
    else if (arg === '--live') parsed.live = true;
    else if (arg === '--base-url') parsed.baseUrl = argv[++index].replace(/\/+$/, '');
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

async function callBabyBlueReview({ baseUrl, request }) {
  const apiKey = process.env.BABYBLUE_API_KEY || process.env.BABYBLUE_IVV_BEARER;
  if (!apiKey) {
    throw new Error('BABYBLUE_API_KEY or BABYBLUE_IVV_BEARER is required for --live mode');
  }

  const response = await fetch(`${baseUrl}/review`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw_body: text };
  }

  if (!response.ok) {
    throw new Error(`Baby Blue /review returned HTTP ${response.status}: ${text.slice(0, 500)}`);
  }

  return body;
}

function buildReadme({ live, baseUrl, verification }) {
  return `# OSuite + Baby Blue second reference run

This directory contains a repeatable reference packet for a judgment-validity case:

- The approved and executed CAVA action fingerprints match.
- The runtime boundary check reports no drift.
- OSuite still requires review because the action is high-risk.
- The judgment-validity lane rejects the action because the business context includes fraud-hold and counterparty-mismatch signals.

Live Baby Blue mode: ${live ? 'enabled' : 'not used for this packet'}
Baby Blue base URL: ${baseUrl}

## Files

- \`case.json\`: benchmark case input.
- \`review-request.json\`: request body suitable for Baby Blue \`POST /review\`.
- \`packet.json\`: OSuite reference packet with CAVA fingerprint, artifact hash, review request, and optional live verifier response.
- \`verify-payload.json\`: payload to use with Baby Blue \`/verify-proof\` after a live signed response exists.
- \`verification.json\`: local recomputation result for action fingerprint, artifact hash, and judgment verdict.

## Local verification

\`\`\`bash
node scripts/prepare-baby-blue-second-run.mjs --output examples/baby-blue-second-run/reference
\`\`\`

## Live verifier run

\`\`\`bash
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-second-run.mjs --live
# or
BABYBLUE_IVV_BEARER=... node scripts/prepare-baby-blue-second-run.mjs --live
\`\`\`

Verification result: ${verification.valid ? 'valid' : 'invalid'}
Failures: ${verification.failures.length ? verification.failures.join(', ') : 'none'}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const request = buildBabyBlueReviewRequest();
  const reviewResponse = args.live
    ? await callBabyBlueReview({ baseUrl: args.baseUrl, request })
    : null;
  const packet = buildSecondRunPacket({ reviewResponse });
  const verifyPayload = buildVerifyPayload(reviewResponse, `${args.baseUrl}/verify-proof`);
  const verification = verifySecondRunPacket(packet);

  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, 'case.json'), `${JSON.stringify(buildSecondRunCase(), null, 2)}\n`);
  await writeFile(path.join(args.output, 'review-request.json'), `${JSON.stringify(request, null, 2)}\n`);
  await writeFile(path.join(args.output, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`);
  await writeFile(path.join(args.output, 'verify-payload.json'), `${JSON.stringify(verifyPayload, null, 2)}\n`);
  await writeFile(path.join(args.output, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`);
  await writeFile(path.join(args.output, 'README.md'), buildReadme({
    live: args.live,
    baseUrl: args.baseUrl,
    verification,
  }));

  console.log(`Wrote ${path.relative(rootDir, args.output)}`);
  console.log(`Local packet verification: ${verification.valid ? 'valid' : 'invalid'}`);
  console.log(`Judgment verdict: ${verification.recomputed.judgment_verdict}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
