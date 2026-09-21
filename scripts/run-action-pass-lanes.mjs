#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateActionPassLaneBenchmark } from '../lib/action-pass-core.mjs';

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

function renderMarkdown(benchmark) {
  const { scoring, results } = benchmark;
  const lines = [
    '# OSuite Action Pass Lane Benchmark',
    '',
    '## Research Question',
    '',
    'Can agent governance behave like a local runtime gate for the common case, while routing stale, ambiguous, high-risk, or divergent actions into slow review or fail-closed outcomes?',
    '',
    '## Core Idea',
    '',
    'An Action Pass is a bounded, consumable execution ticket. It carries enough signed state for a local runtime gate to decide whether a specific canonical action can commit without a remote policy lookup, verifier call, approval database read, or synchronous proof-bundle export.',
    '',
    'The benchmark is intentionally scoped as lane classification and critical-path modeling. It does not claim measured production latency. It tests whether the gate chooses the right path before side effects form.',
    '',
    '## Metrics',
    '',
    '### Stress Matrix',
    '',
    tableRows([
      {
        total: scoring.total_cases,
        exact: scoring.exact_match_rate,
        fast: scoring.fast_path_coverage,
        slow: scoring.slow_path_rate,
        fail_closed: scoring.fail_closed_rate,
        zero_wait: scoring.zero_wait_ratio,
        safety_fast: scoring.safety_preserving_fast_path_coverage,
        false_fast: scoring.false_fast_allow_rate,
        receipts: scoring.receipt_emission_rate,
      },
    ], [
      { key: 'total', label: 'Cases' },
      { key: 'exact', label: 'Exact match', format: toPercent },
      { key: 'fast', label: 'Fast path coverage', format: toPercent },
      { key: 'slow', label: 'Slow path rate', format: toPercent },
      { key: 'fail_closed', label: 'Fail-closed rate', format: toPercent },
      { key: 'zero_wait', label: 'Zero-wait ratio', format: toPercent },
      { key: 'safety_fast', label: 'Safety-preserving fast path', format: toPercent },
      { key: 'false_fast', label: 'False fast allow', format: toPercent },
      { key: 'receipts', label: 'Fast receipt emission', format: toPercent },
    ]),
    '',
    '### Common-Path Workload Mix',
    '',
    'The stress matrix intentionally over-represents stale, drifted, and invalid pass conditions. The common-path mix repeats ordinary bounded actions more often, then injects smaller numbers of slow-lane and fail-closed cases.',
    '',
    tableRows([
      {
        total: benchmark.workload_mix.scoring.total_cases,
        exact: benchmark.workload_mix.scoring.exact_match_rate,
        fast: benchmark.workload_mix.scoring.fast_path_coverage,
        slow: benchmark.workload_mix.scoring.slow_path_rate,
        fail_closed: benchmark.workload_mix.scoring.fail_closed_rate,
        zero_wait: benchmark.workload_mix.scoring.zero_wait_ratio,
        false_fast: benchmark.workload_mix.scoring.false_fast_allow_rate,
        receipts: benchmark.workload_mix.scoring.receipt_emission_rate,
      },
    ], [
      { key: 'total', label: 'Records' },
      { key: 'exact', label: 'Exact match', format: toPercent },
      { key: 'fast', label: 'Fast path coverage', format: toPercent },
      { key: 'slow', label: 'Slow path rate', format: toPercent },
      { key: 'fail_closed', label: 'Fail-closed rate', format: toPercent },
      { key: 'zero_wait', label: 'Zero-wait ratio', format: toPercent },
      { key: 'false_fast', label: 'False fast allow', format: toPercent },
      { key: 'receipts', label: 'Fast receipt emission', format: toPercent },
    ]),
    '',
    '## Lane Distribution',
    '',
    tableRows(Object.entries(scoring.distributions.lanes).map(([lane, count]) => ({ lane, count })), [
      { key: 'lane', label: 'Lane' },
      { key: 'count', label: 'Cases' },
    ]),
    '',
    '## Why This Is Different From A2A Or Tool Auth',
    '',
    'A2A, MCP, OAuth, mTLS, and API keys help establish who is communicating and how a task or tool call moves. An Action Pass answers a narrower runtime question: is this exact canonical action allowed to pass this gate now, under this policy digest, with this nonce, budget, state, and receipt obligation?',
    '',
    'Identity gets the agent to the gate. The Action Pass decides whether the action gets through it.',
    '',
    '## Case Results',
    '',
    tableRows(results, [
      { key: 'id', label: 'Case' },
      { key: 'runtime', label: 'Runtime' },
      { key: 'pass_id', label: 'Pass' },
      { key: 'actual', label: 'Lane', format: (actual) => actual.lane },
      { key: 'actual', label: 'Control', format: (actual) => actual.control },
      { key: 'actual', label: 'Blockers', format: (actual) => actual.blockers.join(', ') || 'none' },
      { key: 'actual', label: 'Slow reasons', format: (actual) => actual.slow_reasons.join(', ') || 'none' },
      { key: 'actual', label: 'Receipt', format: (actual) => actual.receipt_state },
      { key: 'pass', label: 'Result', format: (value) => value ? 'PASS' : 'FAIL' },
    ]),
    '',
    '## Interpretation',
    '',
    'The fast lane is not weaker governance. It is the subset of governance whose required facts have already been compiled into a signed, fresh, scoped, non-replayed pass and can be checked locally. The slow lane is where the system deliberately refuses to pretend that stale or ambiguous facts are safe. The fail-closed lane is where a pass is missing, stale, unbound, reused, or impossible to receipt.',
    '',
    '## Design Principle',
    '',
    'Do not make every agent action ask for permission from scratch. Issue bounded action passes, consume them at the runtime gate, and settle the full proof after the local receipt is safely emitted.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const benchmark = evaluateActionPassLaneBenchmark();
  await mkdir(reportDir, { recursive: true });
  await writeFile(
    path.join(reportDir, 'action-pass-lane-benchmark.json'),
    `${JSON.stringify(benchmark, null, 2)}\n`,
  );
  await writeFile(
    path.join(reportDir, 'action-pass-lane-benchmark.md'),
    renderMarkdown(benchmark),
  );

  console.log(`Action Pass lane benchmark: ${benchmark.scoring.total_cases} cases`);
  console.log(`Exact match: ${toPercent(benchmark.scoring.exact_match_rate)}`);
  console.log(`Fast path coverage: ${toPercent(benchmark.scoring.fast_path_coverage)}`);
  console.log(`Zero-wait ratio: ${toPercent(benchmark.scoring.zero_wait_ratio)}`);
  console.log(`False fast allow: ${toPercent(benchmark.scoring.false_fast_allow_rate)}`);
  console.log(`Common-path fast coverage: ${toPercent(benchmark.workload_mix.scoring.fast_path_coverage)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
