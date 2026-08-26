#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateSkillBoundaryV2Experiment } from '../lib/skill-boundary-v2-core.mjs';

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

function renderMarkdown(experiment) {
  const { contract, base_policy: basePolicy, results, scoring } = experiment;
  const lines = [
    '# Skill Boundary Runtime Consistency Experiment v2',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Research Question',
    '',
    'Can a vendor-neutral skill boundary preserve its intended meaning when mapped into different runtime environments, while a runtime authorization layer can still narrow, deny, or escalate what the skill requests?',
    '',
    '## Three-Layer Separation',
    '',
    tableRows([
      {
        layer: 'Skill boundary',
        responsibility: 'Declares what the skill expects or requests to do.',
        example: 'A refund skill requests authority to issue refunds up to USD 100.',
      },
      {
        layer: 'Runtime authorization',
        responsibility: 'Decides what is actually allowed in this workspace, identity, task, and policy context.',
        example: 'The workspace narrows the refund limit to USD 75, or requires review when amount evidence is missing.',
      },
      {
        layer: 'CAVA / proof',
        responsibility: 'Represents the concrete runtime action, checks it against the effective boundary, and records replayable evidence.',
        example: 'A USD 73 refund is allowed, a USD 125 refund is blocked, and a missing amount is escalated.',
      },
    ], [
      { key: 'layer', label: 'Layer' },
      { key: 'responsibility', label: 'Responsibility' },
      { key: 'example', label: 'Example' },
    ]),
    '',
    '## Vendor-Neutral Boundary Contract',
    '',
    tableRows([
      { field: 'schema_version', value: contract.schema_version },
      { field: 'boundary_id', value: contract.boundary_id },
      { field: 'skill.name', value: contract.skill.name },
      { field: 'runtime_lanes', value: contract.runtime_lanes.join(', ') },
      { field: 'requested_authority.operations', value: contract.requested_authority.operations.join(', ') },
      { field: 'requested_authority.effects', value: contract.requested_authority.effects.join(', ') },
      { field: 'requested_authority.destinations', value: contract.requested_authority.destinations.join(', ') },
      { field: 'requested_authority.resource_prefixes', value: contract.requested_authority.resource_prefixes.join(', ') },
      { field: 'requested_authority.data_classes', value: contract.requested_authority.data_classes.join(', ') },
      { field: 'constraints.max_records', value: contract.constraints.max_records },
      { field: 'constraints.max_amount_usd', value: contract.constraints.max_amount_usd },
      { field: 'constraints.amount_limited_operations', value: contract.constraints.amount_limited_operations.join(', ') },
    ], [
      { key: 'field', label: 'Field' },
      { key: 'value', label: 'Value' },
    ]),
    '',
    'The contract intentionally does not contain OSuite-specific field names. OSuite is used here as one reference runtime-governance implementation.',
    '',
    '## OSuite / CAVA Reference Mapping',
    '',
    tableRows([
      { contract: 'boundary_id', osuite: 'policy.policy_id', cava: 'action.parameters.skill_boundary_id' },
      { contract: 'requested_authority.operations', osuite: 'policy.allowed_operations', cava: 'action.operation' },
      { contract: 'requested_authority.effects', osuite: 'policy.allowed_effects', cava: 'action.effect' },
      { contract: 'requested_authority.destinations', osuite: 'policy.allowed_destinations', cava: 'action.destination' },
      { contract: 'requested_authority.resource_prefixes', osuite: 'policy.allowed_resource_prefixes', cava: 'action.resource' },
      { contract: 'requested_authority.data_classes', osuite: 'policy.allowed_data_classes', cava: 'action.parameters.data_classification' },
      { contract: 'principals.requested_identities', osuite: 'policy.allowed_identities', cava: 'action.identity' },
      { contract: 'constraints.max_records', osuite: 'policy.max_records', cava: 'action.parameters.record_count' },
      { contract: 'constraints.max_amount_usd', osuite: 'policy.max_amount_usd', cava: 'action.parameters.amount_usd' },
      { contract: 'constraints.amount_limited_operations', osuite: 'policy.amount_limited_operations', cava: 'action.operation' },
    ], [
      { key: 'contract', label: 'Neutral boundary' },
      { key: 'osuite', label: 'OSuite policy' },
      { key: 'cava', label: 'CAVA action object' },
    ]),
    '',
    '## Base Policy Produced By The Mapping',
    '',
    '```json',
    JSON.stringify(basePolicy, null, 2),
    '```',
    '',
    '## Results',
    '',
    tableRows([
      {
        total: scoring.total,
        runtimes: scoring.runtimes,
        groups: scoring.scenario_groups,
        exact: scoring.exact_control_match_rate,
        allowed: scoring.allowed_action_pass_rate,
        blocked: scoring.violation_block_rate,
        escalated: scoring.escalation_match_rate,
        consistency: scoring.boundary_consistency_rate,
      },
    ], [
      { key: 'total', label: 'Cases' },
      { key: 'runtimes', label: 'Runtimes' },
      { key: 'groups', label: 'Scenario groups' },
      { key: 'exact', label: 'Exact control match', format: toPercent },
      { key: 'allowed', label: 'Allowed pass rate', format: toPercent },
      { key: 'blocked', label: 'Violation block rate', format: toPercent },
      { key: 'escalated', label: 'Escalation match', format: toPercent },
      { key: 'consistency', label: 'Boundary consistency', format: toPercent },
    ]),
    '',
    '## Scenario Consistency',
    '',
    tableRows(scoring.groups, [
      { key: 'group', label: 'Scenario group' },
      { key: 'runtimes', label: 'Runtimes' },
      { key: 'cases', label: 'Cases' },
      { key: 'expected_control', label: 'Expected' },
      { key: 'actual_controls', label: 'Observed' },
      { key: 'boundary_key_count', label: 'Boundary keys' },
      { key: 'consistent', label: 'Consistent', format: (value) => value ? 'yes' : 'no' },
    ]),
    '',
    '## Case Details',
    '',
    tableRows(results, [
      { key: 'id', label: 'Case' },
      { key: 'runtime', label: 'Runtime' },
      { key: 'group', label: 'Group' },
      { key: 'expected', label: 'Expected', format: (_value, row) => row.expected.control },
      { key: 'actual', label: 'Observed', format: (_value, row) => row.actual.control },
      { key: 'actual', label: 'Drift', format: (_value, row) => row.actual.drift.join(', ') },
      { key: 'skill_boundary_key', label: 'Boundary key', format: shortHash },
      { key: 'pass', label: 'Result', format: (value) => value ? 'PASS' : 'FAIL' },
    ]),
    '',
    '## Interpretation',
    '',
    'The experiment separates requested skill authority from effective runtime authority. The skill boundary requests refund authority up to USD 100. The runtime authorization layer can still narrow that authority to USD 75 for a workspace, deny an operation, or require review when a required typed predicate is missing.',
    '',
    'CAVA is not the policy language. It is the action representation used to test whether a concrete runtime action satisfies the effective boundary. This keeps the skill contract vendor-neutral while still making the runtime evidence executable and replayable.',
    '',
    '## Limitations',
    '',
    '- This is a small controlled artifact, not a population-scale benchmark.',
    '- The contract semantics are deliberately minimal and should be sharpened before any paper submission.',
    '- The experiment checks semantic preservation across runtime forms, not whether a language model reliably chooses safe actions.',
    '- OSuite is used as one reference implementation; the research question should remain open to other runtime-governance implementations.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderConsole(scoring) {
  console.log(`Skill boundary v2 experiment: ${scoring.passed}/${scoring.total} exact matches`);
  console.log(`Runtimes: ${scoring.runtimes}`);
  console.log(`Scenario groups: ${scoring.scenario_groups}`);
  console.log(`Allowed action pass rate: ${toPercent(scoring.allowed_action_pass_rate)}`);
  console.log(`Violation block rate: ${toPercent(scoring.violation_block_rate)}`);
  console.log(`Escalation match rate: ${toPercent(scoring.escalation_match_rate)}`);
  console.log(`Boundary consistency rate: ${toPercent(scoring.boundary_consistency_rate)}`);
}

async function main() {
  const experiment = evaluateSkillBoundaryV2Experiment();
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, 'skill-boundary-v2-experiment.json'),
    `${JSON.stringify(experiment, null, 2)}\n`
  );
  await writeFile(
    path.join(reportDir, 'skill-boundary-v2-experiment.md'),
    renderMarkdown(experiment)
  );
  renderConsole(experiment.scoring);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
