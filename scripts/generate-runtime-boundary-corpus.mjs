#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateRuntimeBoundaryCorpus,
  runtimeBoundaryCorpusMetadata,
} from '../lib/corpus-generator.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const parsed = {
    count: runtimeBoundaryCorpusMetadata.default_count,
    seed: 'osuite-runtime-boundary-v1',
    output: path.join(rootDir, 'benchmarks', 'runtime-boundary-corpus.jsonl'),
    metadataOutput: path.join(rootDir, 'benchmarks', 'runtime-boundary-corpus.metadata.json'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--count') parsed.count = Number(argv[++index]);
    else if (arg === '--seed') parsed.seed = argv[++index];
    else if (arg === '--output') parsed.output = path.resolve(rootDir, argv[++index]);
    else if (arg === '--metadata-output') parsed.metadataOutput = path.resolve(rootDir, argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(parsed.count) || parsed.count < 1) {
    throw new Error(`--count must be a positive integer, got ${parsed.count}`);
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = generateRuntimeBoundaryCorpus({ count: args.count, seed: args.seed });

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${cases.map((item) => JSON.stringify(item)).join('\n')}\n`);
  await writeFile(args.metadataOutput, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    seed: args.seed,
    count: cases.length,
    output: path.relative(rootDir, args.output),
    ...runtimeBoundaryCorpusMetadata,
  }, null, 2)}\n`);

  console.log(`Generated ${cases.length} records at ${path.relative(rootDir, args.output)}`);
  console.log(`Wrote metadata at ${path.relative(rootDir, args.metadataOutput)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
