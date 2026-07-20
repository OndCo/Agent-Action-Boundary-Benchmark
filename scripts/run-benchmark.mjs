#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkFile = path.join(rootDir, 'benchmarks', 'approval-execution-drift.jsonl');
const reportDir = path.join(rootDir, 'reports');
const args = new Set(process.argv.slice(2));

const MATERIAL_FIELDS = ['runtime', 'operation', 'resource', 'effect', 'destination', 'identity'];
const PARAMETER_ALLOWLIST = [
  'amount_usd',
  'command',
  'cwd',
  'decision_ref',
  'environment',
  'external_webhook',
  'fields',
  'issue_refund',
  'output',
  'send',
  'sources',
  'state_hash',
  'template',
  'visibility',
  'source_class',
];

function stableSortObject(value) {
  if (Array.isArray(value)) return value.map(stableSortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableSortObject(value[key])])
  );
}

function stableJson(value) {
  return JSON.stringify(stableSortObject(value));
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeAction(action = {}) {
  const parameters = action.parameters && typeof action.parameters === 'object'
    ? Object.fromEntries(
        Object.entries(action.parameters)
          .filter(([key, value]) => PARAMETER_ALLOWLIST.includes(key) && value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
      )
    : {};

  return {
    runtime: String(action.runtime || 'unknown').trim(),
    operation: String(action.operation || 'unknown').trim(),
    resource: String(action.resource || 'unknown').trim(),
    effect: String(action.effect || 'unknown').trim(),
    destination: String(action.destination || 'unknown').trim(),
    identity: String(action.identity || 'unknown').trim(),
    parameters,
    rollback: {
      available: Boolean(action.rollback?.available),
      method: String(action.rollback?.method || '').trim(),
    },
  };
}

function canonicalizeAction(action) {
  const normalized = normalizeAction(action);
  const canonical = stableJson(normalized);
  return {
    normalized,
    canonical,
    fingerprint: sha256(canonical),
  };
}

function detectDrift(caseItem, approved, executed) {
  const drift = new Set();

  for (const field of MATERIAL_FIELDS) {
    if (approved.normalized[field] !== executed.normalized[field]) {
      if (field === 'resource') drift.add('resource_drift');
      else if (field === 'effect') drift.add('effect_drift');
      else if (field === 'destination') drift.add('boundary_drift');
      else if (field === 'identity') drift.add('identity_drift');
      else drift.add('parameter_drift');
    }
  }

  if (stableJson(approved.normalized.parameters) !== stableJson(executed.normalized.parameters)) {
    drift.add('parameter_drift');
  }

  const policy = caseItem.policy || {};
  const allowedEffects = new Set(policy.allowed_effects || []);
  const allowedDestinations = new Set(policy.allowed_destinations || []);
  const allowedResourcePrefixes = policy.allowed_resource_prefixes || [];
  if (allowedEffects.size > 0 && !allowedEffects.has(executed.normalized.effect)) {
    drift.add('policy_drift');
  }
  if (allowedDestinations.size > 0 && !allowedDestinations.has(executed.normalized.destination)) {
    drift.add('policy_drift');
  }
  if (
    allowedResourcePrefixes.length > 0
    && !allowedResourcePrefixes.some((prefix) => executed.normalized.resource.startsWith(prefix))
  ) {
    drift.add('policy_drift');
  }

  if (drift.size === 0) drift.add('none');
  return [...drift].sort();
}

function classifyControl(drift, executed) {
  const materialBlockers = new Set([
    'effect_drift',
    'boundary_drift',
    'identity_drift',
    'policy_drift',
  ]);
  const hasBlocker = drift.some((item) => materialBlockers.has(item));
  if (hasBlocker) return 'block';
  if (drift.some((item) => item !== 'none')) {
    return executed.normalized.rollback.available ? 'require_review' : 'block';
  }
  return 'allow';
}

function arraysEqual(a = [], b = []) {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function loadCases() {
  const raw = await readFile(benchmarkFile, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

function runCase(caseItem) {
  const approved = canonicalizeAction(caseItem.approved_action);
  const executed = canonicalizeAction(caseItem.executed_action);
  const drift = detectDrift(caseItem, approved, executed);
  const control = classifyControl(drift, executed);
  const expected = caseItem.expected || {};
  const pass = arraysEqual(drift, expected.drift || []) && control === expected.control;

  return {
    id: caseItem.id,
    title: caseItem.title,
    runtime: caseItem.runtime,
    pass,
    expected,
    actual: {
      drift,
      control,
    },
    fingerprints: {
      approved: approved.fingerprint,
      executed: executed.fingerprint,
      same: approved.fingerprint === executed.fingerprint,
    },
    approved_action: approved.normalized,
    executed_action: executed.normalized,
  };
}

function renderMarkdown(results) {
  const passed = results.filter((item) => item.pass).length;
  const total = results.length;
  const lines = [
    '# Agent Action Boundary Benchmark Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Result: ${passed}/${total} cases passed.`,
    '',
    '| Case | Runtime | Expected Control | Actual Control | Drift | Fingerprint Match | Result |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const item of results) {
    lines.push([
      `\`${item.id}\``,
      item.runtime,
      item.expected.control,
      item.actual.control,
      item.actual.drift.join(', '),
      item.fingerprints.same ? 'yes' : 'no',
      item.pass ? 'PASS' : 'FAIL',
    ].join(' | '));
  }

  lines.push('');
  lines.push('## Case Details');
  lines.push('');

  for (const item of results) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(item.title);
    lines.push('');
    lines.push(`- Runtime: \`${item.runtime}\``);
    lines.push(`- Approved fingerprint: \`${item.fingerprints.approved}\``);
    lines.push(`- Executed fingerprint: \`${item.fingerprints.executed}\``);
    lines.push(`- Drift: \`${item.actual.drift.join('`, `')}\``);
    lines.push(`- Control: \`${item.actual.control}\``);
    lines.push(`- Result: ${item.pass ? 'PASS' : 'FAIL'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function renderConsole(results) {
  const passed = results.filter((item) => item.pass).length;
  const total = results.length;
  console.log(`Agent Action Boundary Benchmark: ${passed}/${total} passed`);
  for (const item of results) {
    const marker = item.pass ? 'PASS' : 'FAIL';
    console.log(`${marker} ${item.id} -> ${item.actual.control} [${item.actual.drift.join(', ')}]`);
  }
}

async function main() {
  const cases = await loadCases();
  const results = cases.map(runCase);
  renderConsole(results);

  if (args.has('--write-report')) {
    await mkdir(reportDir, { recursive: true });
    await writeFile(path.join(reportDir, 'latest-report.json'), `${JSON.stringify({ results }, null, 2)}\n`);
    await writeFile(path.join(reportDir, 'latest-report.md'), renderMarkdown(results));
    console.log('Wrote reports/latest-report.md and reports/latest-report.json');
  }

  if (args.has('--strict') && results.some((item) => !item.pass)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
