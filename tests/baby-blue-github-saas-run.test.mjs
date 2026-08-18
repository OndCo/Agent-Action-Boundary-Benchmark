import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGithubSaasRunPacket,
  buildGithubVerifyPayload,
  buildLedgerSubmitPayload,
  verifyGithubSaasRunPacket,
} from '../lib/baby-blue-github-saas-run.mjs';

test('buildGithubSaasRunPacket creates an approval-bound SaaS side-effect packet', () => {
  const packet = buildGithubSaasRunPacket();

  assert.equal(packet.case.id, 'baby-blue-github-saas-operation');
  assert.equal(packet.packet_version, 'osuite.baby-blue.github-saas-reference-run.v11');
  assert.match(packet.case.issue.title, /v11 reference run/);
  assert.equal(packet.evaluation.actual.control, 'require_review');
  assert.deepEqual(packet.evaluation.actual.drift, ['none']);
  assert.equal(packet.evaluation.actual.judgment.verdict, 'approve_with_concerns');
  assert.equal(packet.evaluation.fingerprints.same, true);
  assert.equal(packet.review_request.sign, true);
  assert.equal(packet.review_request.state_hash, packet.cava.action_fingerprint);
  assert.equal(packet.artifact.hash.startsWith('sha256:'), true);
  assert.equal(packet.github_outcome, null);
});

test('verifyGithubSaasRunPacket recomputes CAVA artifact and detects tampering', () => {
  const packet = buildGithubSaasRunPacket();
  const verified = verifyGithubSaasRunPacket(packet);
  assert.equal(verified.valid, true);
  assert.deepEqual(verified.failures, []);

  const tampered = structuredClone(packet);
  tampered.review_request.state_hash = 'sha256:not-the-action';
  const tamperedResult = verifyGithubSaasRunPacket(tampered);
  assert.equal(tamperedResult.valid, false);
  assert.ok(tamperedResult.failures.includes('state_hash_mismatch'));
});

test('github SaaS run exposes stable placeholder payloads without live verifier proof', () => {
  const verifyPayload = buildGithubVerifyPayload(null);
  const ledgerPayload = buildLedgerSubmitPayload(null, 'test');

  assert.equal(verifyPayload.status, 'not_available_without_live_review');
  assert.equal(verifyPayload.verify_url, 'https://api.babyblueviper.com/verify-proof');
  assert.equal(ledgerPayload.status, 'not_available_without_signed_event');
});
