#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildBabyBlueGithubReviewRequest,
  buildGithubIssueSpec,
  buildGithubSaasRunCase,
  buildGithubSaasRunPacket,
  buildGithubVerifyPayload,
  buildLedgerSubmitPayload,
  createGithubIssue,
  fetchGithubIssue,
  verifyGithubSaasRunPacket,
} from '../lib/baby-blue-github-saas-run.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const parsed = {
    output: path.join(rootDir, 'runs', 'baby-blue-github-saas-run', 'latest'),
    live: false,
    submitLedger: false,
    executeGithub: false,
    baseUrl: process.env.BABYBLUE_BASE_URL || 'https://api.babyblueviper.com',
    owner: process.env.OSUITE_GITHUB_RUN_OWNER || 'OndCo',
    repo: process.env.OSUITE_GITHUB_RUN_REPO || 'Agent-Action-Boundary-Benchmark',
    runId: process.env.OSUITE_GITHUB_RUN_ID || `bbv-v11-github-saas-${new Date().toISOString().slice(0, 10)}`,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') parsed.output = path.resolve(rootDir, argv[++index]);
    else if (arg === '--live') parsed.live = true;
    else if (arg === '--submit-ledger') parsed.submitLedger = true;
    else if (arg === '--execute-github') parsed.executeGithub = true;
    else if (arg === '--base-url') parsed.baseUrl = argv[++index].replace(/\/+$/, '');
    else if (arg === '--owner') parsed.owner = argv[++index];
    else if (arg === '--repo') parsed.repo = argv[++index];
    else if (arg === '--run-id') parsed.runId = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if ((parsed.submitLedger || parsed.executeGithub) && !parsed.live) {
    throw new Error('--submit-ledger and --execute-github require --live so the side effect is anchored to a signed verifier verdict');
  }

  return parsed;
}

function getBabyBlueApiKey() {
  return process.env.BABYBLUE_API_KEY || process.env.BABYBLUE_IVV_BEARER || process.env.IVV_API_KEY || '';
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw_body: text };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 800)}`);
  }
  return body;
}

async function callBabyBlueReview({ baseUrl, request }) {
  const apiKey = getBabyBlueApiKey();
  if (!apiKey) {
    throw new Error('BABYBLUE_API_KEY, BABYBLUE_IVV_BEARER, or IVV_API_KEY is required for --live mode');
  }

  const response = await fetch(`${baseUrl}/review`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return parseJsonResponse(response);
}

async function callBabyBlueVerifyProof({ baseUrl, payload }) {
  if (payload.status !== 'ready') return payload;
  const response = await fetch(`${baseUrl}/verify-proof`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return parseJsonResponse(response);
}

async function callBabyBlueLedgerSubmit({ baseUrl, payload }) {
  const apiKey = getBabyBlueApiKey();
  if (!apiKey) {
    throw new Error('BABYBLUE_API_KEY, BABYBLUE_IVV_BEARER, or IVV_API_KEY is required for --submit-ledger');
  }
  if (!payload?.event) {
    throw new Error('Baby Blue /ledger/submit requires payload.event from a signed /review proof');
  }

  const response = await fetch(`${baseUrl}/ledger/submit`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response);
}

async function fetchBabyBlueLedgerEntry({ baseUrl, ledgerResponse }) {
  const entry = ledgerResponse?.entry || ledgerResponse?.record?.entry || ledgerResponse?.ledger_entry || null;
  if (!entry) return null;
  const response = await fetch(`${baseUrl}/ledger/${entry}`);
  return parseJsonResponse(response);
}

function buildReadme({
  args,
  verification,
  proofVerification,
  ledgerResponse,
  githubOutcome,
}) {
  return `# OSuite + Baby Blue GitHub SaaS reference run

This directory contains an approval-bound SaaS operation reference packet:

- OSuite represents a GitHub issue creation as a CAVA action artifact.
- Baby Blue / invinoveritas can review the artifact before execution.
- OSuite can self-submit the signed verifier event to Baby Blue \`/ledger/submit\`.
- OSuite can execute the approved GitHub issue creation and bind the final outcome back into the packet.

Live Baby Blue mode: ${args.live ? 'enabled' : 'not used for this packet'}
Ledger submit: ${args.submitLedger ? 'enabled' : 'not used for this packet'}
GitHub side effect: ${args.executeGithub ? 'enabled' : 'not executed'}
Baby Blue base URL: ${args.baseUrl}
GitHub target: ${args.owner}/${args.repo}
Run ID: ${args.runId}

## Files

- \`case.json\`: benchmark case input.
- \`issue-spec.json\`: exact public GitHub issue title/body hash and target.
- \`review-request.json\`: request body suitable for Baby Blue \`POST /review\`.
- \`packet.json\`: OSuite reference packet with CAVA fingerprint, artifact hash, verifier response, ledger response, and optional GitHub outcome.
- \`verify-payload.json\`: payload to use with Baby Blue \`/verify-proof\`.
- \`proof-verification.json\`: live \`/verify-proof\` result when available.
- \`ledger-submit-payload.json\`: payload sent to Baby Blue \`/ledger/submit\` when available.
- \`ledger-response.json\`: live ledger response when submitted.
- \`ledger-entry.json\`: public ledger entry fetched back from Baby Blue after self-submit.
- \`github-outcome.json\`: live GitHub issue outcome when executed.
- \`verification.json\`: local recomputation result for action fingerprint, artifact hash, judgment, and outcome binding.

## Local verification

\`\`\`bash
node scripts/prepare-baby-blue-github-saas-run.mjs --output examples/baby-blue-github-saas-run/reference
\`\`\`

## Live verifier run

\`\`\`bash
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live --submit-ledger
BABYBLUE_API_KEY=... node scripts/prepare-baby-blue-github-saas-run.mjs --live --submit-ledger --execute-github
\`\`\`

Verification result: ${verification.valid ? 'valid' : 'invalid'}
Failures: ${verification.failures.length ? verification.failures.join(', ') : 'none'}
Proof verification: ${proofVerification?.valid ?? proofVerification?.status ?? 'not available'}
Ledger response: ${ledgerResponse?.ledger_url || ledgerResponse?.status || 'not submitted'}
GitHub outcome: ${githubOutcome?.html_url || githubOutcome?.url || 'not executed'}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    owner: args.owner,
    repo: args.repo,
    runId: args.runId,
  };
  const issueSpec = buildGithubIssueSpec(options);
  const request = buildBabyBlueGithubReviewRequest(buildGithubSaasRunCase(options));
  const reviewResponse = args.live
    ? await callBabyBlueReview({ baseUrl: args.baseUrl, request })
    : null;
  const verifyPayload = buildGithubVerifyPayload(reviewResponse, `${args.baseUrl}/verify-proof`);
  const proofVerification = args.live
    ? await callBabyBlueVerifyProof({ baseUrl: args.baseUrl, payload: verifyPayload })
    : verifyPayload;
  const ledgerSubmitPayload = buildLedgerSubmitPayload(
    reviewResponse,
    `OSuite self-submitted verifier proof for approval-bound GitHub SaaS action ${args.runId}`
  );
  const ledgerResponse = args.submitLedger
    ? await callBabyBlueLedgerSubmit({ baseUrl: args.baseUrl, payload: ledgerSubmitPayload })
    : null;
  const ledgerEntry = ledgerResponse
    ? await fetchBabyBlueLedgerEntry({ baseUrl: args.baseUrl, ledgerResponse })
    : null;

  const createdIssue = args.executeGithub
    ? createGithubIssue({
        owner: args.owner,
        repo: args.repo,
        title: issueSpec.title,
        body: issueSpec.body,
      })
    : null;
  const githubOutcome = createdIssue
    ? fetchGithubIssue({ owner: args.owner, repo: args.repo, number: createdIssue.number })
    : null;
  const packet = buildGithubSaasRunPacket({
    reviewResponse,
    ledgerResponse,
    githubOutcome,
    options,
  });
  const verification = verifyGithubSaasRunPacket(packet);

  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, 'case.json'), `${JSON.stringify(buildGithubSaasRunCase(options), null, 2)}\n`);
  await writeFile(path.join(args.output, 'issue-spec.json'), `${JSON.stringify(issueSpec, null, 2)}\n`);
  await writeFile(path.join(args.output, 'review-request.json'), `${JSON.stringify(request, null, 2)}\n`);
  await writeFile(path.join(args.output, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`);
  await writeFile(path.join(args.output, 'verify-payload.json'), `${JSON.stringify(verifyPayload, null, 2)}\n`);
  await writeFile(path.join(args.output, 'proof-verification.json'), `${JSON.stringify(proofVerification, null, 2)}\n`);
  await writeFile(path.join(args.output, 'ledger-submit-payload.json'), `${JSON.stringify(ledgerSubmitPayload, null, 2)}\n`);
  await writeFile(path.join(args.output, 'ledger-response.json'), `${JSON.stringify(ledgerResponse || { status: 'not_submitted' }, null, 2)}\n`);
  await writeFile(path.join(args.output, 'ledger-entry.json'), `${JSON.stringify(ledgerEntry || { status: 'not_submitted' }, null, 2)}\n`);
  await writeFile(path.join(args.output, 'github-outcome.json'), `${JSON.stringify(githubOutcome || { status: 'not_executed' }, null, 2)}\n`);
  await writeFile(path.join(args.output, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`);
  await writeFile(path.join(args.output, 'README.md'), buildReadme({
    args,
    verification,
    proofVerification,
    ledgerResponse,
    githubOutcome,
  }));

  console.log(`Wrote ${path.relative(rootDir, args.output)}`);
  console.log(`Local packet verification: ${verification.valid ? 'valid' : 'invalid'}`);
  console.log(`Judgment verdict: ${verification.recomputed.judgment_verdict}`);
  console.log(`Control: ${verification.recomputed.control}`);
  if (ledgerResponse?.ledger_url) console.log(`Ledger: ${ledgerResponse.ledger_url}`);
  if (githubOutcome?.html_url) console.log(`GitHub issue: ${githubOutcome.html_url}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
