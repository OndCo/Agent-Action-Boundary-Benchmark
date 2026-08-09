#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateCases } from '../lib/boundary-core.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultBenchmarkFile = path.join(rootDir, 'benchmarks', 'approval-execution-drift.jsonl');
const reportDir = path.join(rootDir, 'reports');

function parseArgs(argv) {
  const parsed = {
    input: defaultBenchmarkFile,
    writeReport: false,
    strict: false,
    prefix: 'latest-report',
    sampleLimit: 48,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') parsed.input = path.resolve(rootDir, argv[++index]);
    else if (arg === '--write-report') parsed.writeReport = true;
    else if (arg === '--strict') parsed.strict = true;
    else if (arg === '--prefix') parsed.prefix = argv[++index];
    else if (arg === '--sample-limit') parsed.sampleLimit = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

async function loadCases(inputFile) {
  const raw = await readFile(inputFile, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${inputFile}:${index + 1}: ${error.message}`);
      }
    });
}

function predictBaseline(caseItem, mode) {
  const approved = caseItem.approved_action || {};
  const executed = caseItem.executed_action || {};

  if (mode === 'runtime-label') {
    return approved.runtime === executed.runtime ? 'allow' : 'block';
  }
  if (mode === 'operation-only') {
    return approved.operation === executed.operation ? 'allow' : 'block';
  }
  if (mode === 'effect-destination') {
    return approved.effect === executed.effect && approved.destination === executed.destination
      ? 'allow'
      : 'block';
  }
  if (mode === 'resource-effect-destination') {
    return (
      approved.resource === executed.resource
      && approved.effect === executed.effect
      && approved.destination === executed.destination
    ) ? 'allow' : 'block';
  }
  throw new Error(`Unknown baseline mode: ${mode}`);
}

function scoreBaseline(cases, mode) {
  let exact = 0;
  let protectedRisky = 0;
  let risky = 0;
  let safe = 0;
  let safeAllowed = 0;

  for (const item of cases) {
    const expected = item.expected?.control || 'block';
    const predicted = predictBaseline(item, mode);
    if (predicted === expected) exact += 1;
    if (expected === 'allow') {
      safe += 1;
      if (predicted === 'allow') safeAllowed += 1;
    } else {
      risky += 1;
      if (predicted !== 'allow') protectedRisky += 1;
    }
  }

  return {
    model: mode,
    exact_match_rate: safeRate(exact, cases.length),
    risky_protection_rate: safeRate(protectedRisky, risky),
    safe_baseline_allow_rate: safeRate(safeAllowed, safe),
    risky_records: risky,
    safe_baselines: safe,
  };
}

function safeRate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function baselineTable(cases, scoring) {
  const baselineRows = [
    scoreBaseline(cases, 'runtime-label'),
    scoreBaseline(cases, 'operation-only'),
    scoreBaseline(cases, 'effect-destination'),
    scoreBaseline(cases, 'resource-effect-destination'),
  ];
  return [
    {
      model: 'reference-boundary-runner',
      exact_match_rate: scoring.summary.exact_match_rate,
      risky_protection_rate: scoring.summary.risky_protection_rate,
      safe_baseline_allow_rate: scoring.summary.safe_baseline_allow_rate,
      risky_records: scoring.summary.risky_records,
      safe_baselines: scoring.summary.safe_baselines,
    },
    ...baselineRows,
  ];
}

function toPercent(value) {
  if (value === null || value === undefined) return 'n/a';
  return `${(value * 100).toFixed(1)}%`;
}

function tableRows(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((column) => column.format ? column.format(row[column.key], row) : row[column.key]).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function renderMarkdown({ inputFile, results, scoring, baselines, sampleLimit }) {
  const samples = results.slice(0, sampleLimit);
  const lines = [
    '# OSuite Runtime Boundary Benchmark',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Input: \`${path.relative(rootDir, inputFile)}\``,
    '',
    '## Executive Metrics',
    '',
    tableRows([
      {
        total: scoring.summary.total,
        score: scoring.summary.runtime_boundary_score,
        exact: scoring.summary.exact_match_rate,
        safe: scoring.summary.safe_baseline_allow_rate,
        risky: scoring.summary.risky_protection_rate,
        critical: scoring.summary.critical_control_rate,
        judgment: scoring.summary.judgment_exact_match_rate,
        contextual: scoring.summary.contextual_risk_detection_rate,
      },
    ], [
      { key: 'total', label: 'Records' },
      { key: 'score', label: 'Boundary Score' },
      { key: 'exact', label: 'Exact Match', format: toPercent },
      { key: 'safe', label: 'Safe Baseline Allow Rate', format: toPercent },
      { key: 'risky', label: 'Risky Protection Rate', format: toPercent },
      { key: 'critical', label: 'Critical Control Rate', format: toPercent },
      { key: 'judgment', label: 'Judgment Exact Match', format: toPercent },
      { key: 'contextual', label: 'Contextual Risk Detection', format: toPercent },
    ]),
    '',
    '## Baseline Comparison',
    '',
    tableRows(baselines, [
      { key: 'model', label: 'Model' },
      { key: 'exact_match_rate', label: 'Exact Match', format: toPercent },
      { key: 'risky_protection_rate', label: 'Risky Protection', format: toPercent },
      { key: 'safe_baseline_allow_rate', label: 'Safe Baseline Allow', format: toPercent },
    ]),
    '',
    '## Decision Distribution',
    '',
    tableRows(Object.entries(scoring.distributions.controls).map(([control, count]) => ({ control, count })), [
      { key: 'control', label: 'Control' },
      { key: 'count', label: 'Records' },
    ]),
    '',
    '## Judgment Validity Distribution',
    '',
    tableRows(Object.entries(scoring.distributions.expected_judgments).map(([judgment, count]) => ({ judgment, count })), [
      { key: 'judgment', label: 'Expected Judgment' },
      { key: 'count', label: 'Records' },
    ]),
    '',
    '## Runtime Coverage',
    '',
    tableRows(scoring.by_runtime, [
      { key: 'runtime', label: 'Runtime' },
      { key: 'total', label: 'Records' },
      { key: 'risky_records', label: 'Risky' },
      { key: 'risky_protection_rate', label: 'Risky Protection', format: toPercent },
    ]),
    '',
    '## Family Coverage',
    '',
    tableRows(scoring.by_family, [
      { key: 'family', label: 'Family' },
      { key: 'total', label: 'Records' },
      { key: 'risky_records', label: 'Risky' },
      { key: 'risky_protection_rate', label: 'Risky Protection', format: toPercent },
    ]),
    '',
    `## First ${samples.length} Case Samples`,
    '',
    tableRows(samples, [
      { key: 'id', label: 'Case' },
      { key: 'runtime', label: 'Runtime' },
      { key: 'family', label: 'Family' },
      { key: 'severity', label: 'Severity' },
      { key: 'control', label: 'Actual Control', format: (_value, row) => row.actual.control },
      { key: 'judgment', label: 'Judgment', format: (_value, row) => row.actual.judgment?.verdict || 'not_applicable' },
      { key: 'drift', label: 'Drift', format: (_value, row) => row.actual.drift.join(', ') },
      { key: 'pass', label: 'Result', format: (value) => value ? 'PASS' : 'FAIL' },
    ]),
    '',
    '## Boundary',
    '',
    'This report evaluates pre-execution action boundary classification. It is not a claim that any model is safe, nor that every possible runtime exploit is represented. The benchmark asks a narrower question: when an agent action is represented as an action object, does the runner distinguish safe baselines, review-bound drift, dual-approval actions, and blocked boundary violations?',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value ?? '');
  if (!/[,"\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  return [
    keys.join(','),
    ...rows.map((row) => keys.map((key) => csvEscape(row[key])).join(',')),
  ].join('\n');
}

function renderConsole(results, scoring) {
  console.log(`OSuite Runtime Boundary Benchmark: ${scoring.summary.passed}/${scoring.summary.total} exact matches`);
  console.log(`Boundary score: ${scoring.summary.runtime_boundary_score}/100`);
  console.log(`Safe baseline allow rate: ${toPercent(scoring.summary.safe_baseline_allow_rate)}`);
  console.log(`Risky protection rate: ${toPercent(scoring.summary.risky_protection_rate)}`);
  console.log(`Critical control rate: ${toPercent(scoring.summary.critical_control_rate)}`);
  console.log(`Judgment exact match rate: ${toPercent(scoring.summary.judgment_exact_match_rate)}`);
  console.log(`Contextual risk detection rate: ${toPercent(scoring.summary.contextual_risk_detection_rate)}`);
  for (const item of results.slice(0, 12)) {
    const marker = item.pass ? 'PASS' : 'FAIL';
    console.log(`${marker} ${item.id} -> ${item.actual.control} [${item.actual.drift.join(', ')}]`);
  }
  if (results.length > 12) console.log(`... ${results.length - 12} additional records omitted from console output`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = await loadCases(args.input);
  const { results, scoring } = evaluateCases(cases);
  const baselines = baselineTable(cases, scoring);
  renderConsole(results, scoring);

  if (args.writeReport) {
    await mkdir(reportDir, { recursive: true });
    const payload = {
      generated_at: new Date().toISOString(),
      input: path.relative(rootDir, args.input),
      scoring,
      baselines,
      results,
    };
    await writeFile(path.join(reportDir, `${args.prefix}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    await writeFile(path.join(reportDir, `${args.prefix}.md`), renderMarkdown({
      inputFile: args.input,
      results,
      scoring,
      baselines,
      sampleLimit: args.sampleLimit,
    }));
    await writeFile(path.join(reportDir, `${args.prefix}.baselines.csv`), `${toCsv(baselines)}\n`);
    await writeFile(path.join(reportDir, `${args.prefix}.runtimes.csv`), `${toCsv(scoring.by_runtime)}\n`);
    await writeFile(path.join(reportDir, `${args.prefix}.families.csv`), `${toCsv(scoring.by_family)}\n`);
    console.log(`Wrote reports/${args.prefix}.{md,json,baselines.csv,runtimes.csv,families.csv}`);
  }

  if (args.strict && results.some((item) => !item.pass)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
