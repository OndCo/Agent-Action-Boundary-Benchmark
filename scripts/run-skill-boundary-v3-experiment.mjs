#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateSkillBoundaryV3Experiment } from '../lib/skill-boundary-v3-core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = path.join(rootDir, 'reports');

function toPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function tableRows(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => {
    const value = row[column.key];
    return column.format ? column.format(value, row) : value;
  }).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function shortHash(value) {
  return String(value || '').replace(/^sha256:/, '').slice(0, 12);
}

function operationSummary(contract) {
  return contract.requested_authority.operations.map((operation) => ({
    operation: operation.operation,
    effect: operation.effect,
    destination: operation.destination,
    resource: operation.resource.pattern,
    constraints: Object.entries(operation.constraints || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ') || 'none',
    evidence: operation.required_evidence.join(', '),
  }));
}

function renderMarkdown(experiment) {
  const { contracts, held_out: heldOut, results, scoring } = experiment;
  const lines = [
    '# Skill Boundary Runtime Consistency Experiment v3',
    '',
    '## Research Question',
    '',
    'Can a vendor-neutral skill boundary preserve its intended meaning when mapped into different runtime environments, while runtime authorization can still narrow, deny, or escalate what the skill requests?',
    '',
    '## What Changed From v2',
    '',
    'v3 makes the contract smaller and more research-neutral. The skill boundary no longer carries runtime lanes, risk scores, approval requirements, or escalation behavior. Those are runtime authorization concerns, not authority requested by the skill itself.',
    '',
    'The requested authority is now per-operation. Each operation binds its operation name, effect, resource pattern, destination, constraints, and required evidence together. This avoids accidentally approving an action by independently matching fields that were never intended to compose.',
    '',
    '## Layer Separation',
    '',
    tableRows([
      {
        layer: 'Skill boundary contract',
        responsibility: 'Declares requested authority in vendor-neutral terms.',
        owned_by: 'Skill author / research schema',
      },
      {
        layer: 'Runtime authorization context',
        responsibility: 'Narrows, denies, or escalates based on account, task, identity, and organizational policy.',
        owned_by: 'Runtime / enterprise policy layer',
      },
      {
        layer: 'Runtime-to-action mapping',
        responsibility: 'Maps MCP, SDK, shell, or workflow evidence into a concrete action object.',
        owned_by: 'Adapter / canonicalization layer',
      },
      {
        layer: 'Authorization decision',
        responsibility: 'Checks the concrete action against the effective operation-level boundary.',
        owned_by: 'Reference evaluator',
      },
    ], [
      { key: 'layer', label: 'Layer' },
      { key: 'responsibility', label: 'Responsibility' },
      { key: 'owned_by', label: 'Owner' },
    ]),
    '',
    '## Contract Families',
    '',
    '### Bounded Refund Operations',
    '',
    tableRows(operationSummary(contracts.refund_operations), [
      { key: 'operation', label: 'Operation' },
      { key: 'effect', label: 'Effect' },
      { key: 'destination', label: 'Destination' },
      { key: 'resource', label: 'Resource' },
      { key: 'constraints', label: 'Constraints' },
      { key: 'evidence', label: 'Required evidence' },
    ]),
    '',
    '### Internal Document Review',
    '',
    tableRows(operationSummary(contracts.document_review), [
      { key: 'operation', label: 'Operation' },
      { key: 'effect', label: 'Effect' },
      { key: 'destination', label: 'Destination' },
      { key: 'resource', label: 'Resource' },
      { key: 'constraints', label: 'Constraints' },
      { key: 'evidence', label: 'Required evidence' },
    ]),
    '',
    '## Metrics',
    '',
    tableRows([
      {
        cases: scoring.total_cases,
        families: scoring.skill_families,
        runtimes: scoring.runtime_lanes,
        mapping: scoring.runtime_to_action_mapping_accuracy,
        authorization: scoring.authorization_decision_accuracy,
        review: scoring.correct_review_escalation_rate,
        false_allow: scoring.false_allow_rate,
        false_block: scoring.false_block_rate,
        consistency: scoring.cross_runtime_consistency_rate,
      },
    ], [
      { key: 'cases', label: 'Cases' },
      { key: 'families', label: 'Skill families' },
      { key: 'runtimes', label: 'Runtime lanes' },
      { key: 'mapping', label: 'Mapping accuracy', format: toPercent },
      { key: 'authorization', label: 'Authorization accuracy', format: toPercent },
      { key: 'review', label: 'Review escalation', format: toPercent },
      { key: 'false_allow', label: 'False allow', format: toPercent },
      { key: 'false_block', label: 'False block', format: toPercent },
      { key: 'consistency', label: 'Cross-runtime consistency', format: toPercent },
    ]),
    '',
    '## Scenario Groups',
    '',
    tableRows(scoring.groups, [
      { key: 'group', label: 'Group' },
      { key: 'runtimes', label: 'Runtimes' },
      { key: 'cases', label: 'Cases' },
      { key: 'actual_controls', label: 'Observed controls' },
      { key: 'mapping_statuses', label: 'Mapping status' },
      { key: 'consistent', label: 'Consistent', format: (value) => value ? 'yes' : 'no' },
    ]),
    '',
    '## Case Details',
    '',
    tableRows(results, [
      { key: 'id', label: 'Case' },
      { key: 'runtime', label: 'Runtime' },
      { key: 'skill_family', label: 'Skill family' },
      { key: 'mapping', label: 'Mapping', format: (value) => value.actual_status },
      { key: 'authorization', label: 'Decision', format: (value) => value.actual_control },
      { key: 'authorization', label: 'Reasons', format: (value) => value.reasons.join(', ') || 'none' },
      { key: 'mapping', label: 'Action hash', format: (value) => shortHash(value.action_fingerprint) },
    ]),
    '',
    '## Held-Out Plan',
    '',
    `Skill families held out before semantic freeze: ${heldOut.skill_families.join(', ')}.`,
    '',
    `Runtime mappings held out before semantic freeze: ${heldOut.runtime_mappings.join(', ')}.`,
    '',
    'The held-out sets are intentionally not used by this v3 run. They are reserved for the next evaluation round so the contract vocabulary and reference mappings are not tuned only to the examples already shown here.',
    '',
    '## Interpretation',
    '',
    'This artifact tests the separation Shuwen proposed: a skill can request authority, but it cannot grant itself authority. The runtime can narrow the requested authority, deny an operation, or require review when required evidence is missing. OSuite/CAVA is treated as one reference implementation for runtime evidence and replay, not as the definition of the neutral contract.',
    '',
    '## Limitations',
    '',
    '- The current run is a controlled working artifact, not a final benchmark.',
    '- The schema is intentionally minimal and should be jointly refined before expansion.',
    '- The held-out families and runtime mappings should remain unused until the core semantics are frozen.',
    '- Mapping accuracy and authorization accuracy are reported separately so future failures can be attributed to the adapter layer or the decision layer.',
    '',
  ];

  return `${lines.join('\n')}\n`;
}

function renderConsole(scoring) {
  console.log(`Skill boundary v3 experiment: ${scoring.total_cases} cases`);
  console.log(`Skill families: ${scoring.skill_families}`);
  console.log(`Runtime lanes: ${scoring.runtime_lanes}`);
  console.log(`Runtime-to-action mapping accuracy: ${toPercent(scoring.runtime_to_action_mapping_accuracy)}`);
  console.log(`Authorization decision accuracy: ${toPercent(scoring.authorization_decision_accuracy)}`);
  console.log(`Correct review escalation rate: ${toPercent(scoring.correct_review_escalation_rate)}`);
  console.log(`False allow rate: ${toPercent(scoring.false_allow_rate)}`);
  console.log(`False block rate: ${toPercent(scoring.false_block_rate)}`);
  console.log(`Cross-runtime consistency rate: ${toPercent(scoring.cross_runtime_consistency_rate)}`);
}

async function main() {
  const experiment = evaluateSkillBoundaryV3Experiment();
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, 'skill-boundary-v3-experiment.json'),
    `${JSON.stringify(experiment, null, 2)}\n`
  );
  await writeFile(
    path.join(reportDir, 'skill-boundary-v3-experiment.md'),
    renderMarkdown(experiment)
  );
  renderConsole(experiment.scoring);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
