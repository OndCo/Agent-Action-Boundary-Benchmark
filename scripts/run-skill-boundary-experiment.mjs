#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateSkillBoundaryExperiment } from '../lib/skill-boundary-core.mjs';

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
  const { contract, policy, results, scoring } = experiment;
  const lines = [
    '# Skill Boundary Runtime Consistency Experiment',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Research Question',
    '',
    'Can a reusable agent skill carry a small boundary contract that is preserved when equivalent actions appear through different runtimes, and can OSuite/CAVA consistently block boundary-violating actions?',
    '',
    '## Minimal Skill Boundary Contract',
    '',
    tableRows([
      { field: 'contract_id', value: contract.contract_id },
      { field: 'skill.name', value: contract.skill.name },
      { field: 'runtime_lanes', value: contract.runtime_lanes.join(', ') },
      { field: 'allowed.operations', value: contract.allowed.operations.join(', ') },
      { field: 'allowed.effects', value: contract.allowed.effects.join(', ') },
      { field: 'allowed.destinations', value: contract.allowed.destinations.join(', ') },
      { field: 'allowed.resource_prefixes', value: contract.allowed.resource_prefixes.join(', ') },
      { field: 'allowed.data_classes', value: contract.allowed.data_classes.join(', ') },
      { field: 'constraints.max_records', value: contract.constraints.max_records },
    ], [
      { key: 'field', label: 'Field' },
      { key: 'value', label: 'Value' },
    ]),
    '',
    '## OSuite / CAVA Mapping',
    '',
    tableRows([
      { contract: 'allowed.operations', osuite: 'policy.allowed_operations', cava: 'action.operation' },
      { contract: 'allowed.effects', osuite: 'policy.allowed_effects', cava: 'action.effect' },
      { contract: 'allowed.destinations', osuite: 'policy.allowed_destinations', cava: 'action.destination' },
      { contract: 'allowed.resource_prefixes', osuite: 'policy.allowed_resource_prefixes', cava: 'action.resource' },
      { contract: 'allowed.data_classes', osuite: 'policy.allowed_data_classes', cava: 'action.parameters.data_classification' },
      { contract: 'principals.allowed_identities', osuite: 'policy.allowed_identities', cava: 'action.identity' },
      { contract: 'constraints.max_records', osuite: 'policy.max_records', cava: 'action.parameters.record_count' },
      { contract: 'contract_id', osuite: 'policy.policy_id', cava: 'action.parameters.skill_contract_id' },
    ], [
      { key: 'contract', label: 'Skill contract' },
      { key: 'osuite', label: 'OSuite policy' },
      { key: 'cava', label: 'CAVA action object' },
    ]),
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
        consistency: scoring.boundary_consistency_rate,
      },
    ], [
      { key: 'total', label: 'Cases' },
      { key: 'runtimes', label: 'Runtimes' },
      { key: 'groups', label: 'Scenario groups' },
      { key: 'exact', label: 'Exact control match', format: toPercent },
      { key: 'allowed', label: 'Allowed pass rate', format: toPercent },
      { key: 'blocked', label: 'Violation block rate', format: toPercent },
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
      { key: 'contract_violations', label: 'Contract violations', format: (value) => value.length ? value.join(', ') : 'none' },
      { key: 'skill_boundary_key', label: 'Boundary key', format: shortHash },
      { key: 'pass', label: 'Result', format: (value) => value ? 'PASS' : 'FAIL' },
    ]),
    '',
    '## Interpretation',
    '',
    'The allowed actions preserve the same semantic boundary across MCP, SDK, and shell forms. Boundary-violating actions are blocked even when they use different runtime spellings for the same underlying behavior.',
    '',
    'The experiment is intentionally small. It does not claim full coverage of all skills, all agent frameworks, or all enterprise policies. It is a first shared test object for discussing how a skill-level contract can become an OSuite policy boundary and a CAVA action artifact.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function renderConsole(scoring) {
  console.log(`Skill boundary experiment: ${scoring.passed}/${scoring.total} exact matches`);
  console.log(`Runtimes: ${scoring.runtimes}`);
  console.log(`Scenario groups: ${scoring.scenario_groups}`);
  console.log(`Allowed action pass rate: ${toPercent(scoring.allowed_action_pass_rate)}`);
  console.log(`Violation block rate: ${toPercent(scoring.violation_block_rate)}`);
  console.log(`Boundary consistency rate: ${toPercent(scoring.boundary_consistency_rate)}`);
}

async function main() {
  const experiment = evaluateSkillBoundaryExperiment();
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, 'skill-boundary-experiment.json'),
    `${JSON.stringify(experiment, null, 2)}\n`
  );
  await writeFile(
    path.join(reportDir, 'skill-boundary-experiment.md'),
    renderMarkdown(experiment)
  );
  renderConsole(experiment.scoring);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
