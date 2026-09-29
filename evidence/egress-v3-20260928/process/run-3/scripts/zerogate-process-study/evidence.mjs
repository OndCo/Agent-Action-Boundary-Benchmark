import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = path => JSON.parse(readFileSync(path, 'utf8'));
export function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600, flush: true });
}
export function filesUnder(root) {
  assert.ok(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink(), 'Expected regular evidence directory');
  const visit = (directory, prefix = '') => readdirSync(directory).sort().flatMap(name => {
    const path = join(directory, name), relative = prefix + name, stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), 'Evidence symlinks are forbidden');
    if (stat.isDirectory()) return visit(path, relative + '/');
    assert.ok(stat.isFile() && stat.size <= 32 * 1024 * 1024, 'Expected bounded regular evidence file');
    return [relative];
  });
  return visit(root);
}
export function checksums(root) {
  return Object.fromEntries(filesUnder(root).filter(path => path !== 'checksums.json')
    .map(path => [path, sha256(readFileSync(join(root, path)))]));
}
export function sourceManifest() {
  const paths = ['scripts/zerogate-process-study', 'packages/cava-core/src', 'app/lib'];
  const files = paths.flatMap(path => filesUnder(join(ROOT, path)).filter(file => /\.(mjs|js|json|md)$/.test(file)).map(file => path + '/' + file));
  files.push(...['studio-authority.mjs', 'studio-bootstrap.mjs', 'action-evidence.mjs', 'verify-crypto.mjs'].map(file => 'scripts/egress-v2/' + file),
    'scripts/zerogate-revalidation/durable-gate.mjs', 'runtime-adapters/zerogate/live-authority.mjs',
    'package.json', 'package-lock.json', 'drizzle/0000_clammy_falcon.sql');
  return Object.fromEntries(files.sort().map(path => [path, sha256(readFileSync(resolve(ROOT, path)))]));
}
