import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVerifyPayload,
  buildSecondRunPacket,
  verifySecondRunPacket,
} from '../lib/baby-blue-second-run.mjs';

test('buildSecondRunPacket creates a boundary-valid but judgment-unsafe reference run', () => {
  const packet = buildSecondRunPacket();

  assert.equal(packet.case.id, 'baby-blue-second-run-contextual-risk');
  assert.equal(packet.evaluation.actual.control, 'require_review');
  assert.deepEqual(packet.evaluation.actual.drift, ['none']);
  assert.equal(packet.evaluation.actual.judgment.verdict, 'reject');
  assert.equal(packet.evaluation.fingerprints.same, true);
  assert.equal(packet.review_request.sign, true);
  assert.equal(packet.review_request.state_hash, packet.cava.action_fingerprint);
  assert.equal(packet.artifact.hash.startsWith('sha256:'), true);
});

test('verifySecondRunPacket recomputes action and artifact hashes instead of trusting stored values', () => {
  const packet = buildSecondRunPacket();
  const verified = verifySecondRunPacket(packet);
  assert.equal(verified.valid, true);
  assert.deepEqual(verified.failures, []);

  const tampered = structuredClone(packet);
  tampered.artifact.hash = 'sha256:tampered';
  const tamperedResult = verifySecondRunPacket(tampered);
  assert.equal(tamperedResult.valid, false);
  assert.ok(tamperedResult.failures.includes('artifact_hash_mismatch'));
});

test('buildVerifyPayload gives reviewers a stable offline placeholder until live proof exists', () => {
  const payload = buildVerifyPayload(null);
  assert.equal(payload.status, 'not_available_without_live_review');
  assert.equal(payload.verify_url, 'https://api.babyblueviper.com/verify-proof');
});
