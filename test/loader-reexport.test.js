#!/usr/bin/env bun
/**
 * Browser loader: .rip re-export rewriting
 *
 * The app loader (packages/app/index.rip) rewrites `.rip` import specifiers to
 * blob URLs. Re-exports (`export { X as Y } from './a.rip'`) need the SAME
 * rewrite — a bare/relative `.rip` specifier left in a re-export reaches the
 * browser's native module resolver and throws "Failed to resolve module
 * specifier". This regressed once (the rewrite regex was `import`-only).
 *
 * Rather than copy the regex (which could silently drift), this reads the
 * actual `ripImportRe` literal out of the loader source and exercises it, so a
 * revert to `import`-only fails here.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loaderSrc = readFileSync(resolve(__dirname, '..', 'packages/app/index.rip'), 'utf8');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red = s => color('31;1', s);
let passed = 0, failed = 0; const failures = [];
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failures.push({ name, error: e }); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

// Pull the `ripImportRe = /…/flags` literal out of the loader source and revive
// it as a real RegExp (the loader doesn't export it).
function loaderRegex() {
  const m = loaderSrc.match(/ripImportRe\s*=\s*(\/.*\/[a-z]*)/);
  assert(m, 'could not find ripImportRe in packages/app/index.rip');
  return (0, eval)(m[1]);
}

check('the loader exposes a ripImportRe to test', () => {
  assert(loaderRegex() instanceof RegExp);
});

check('rewrites plain .rip imports (unchanged behavior)', () => {
  const re = loaderRegex();
  const line = `import { User } from './schemas.rip'`;
  const m = [...line.matchAll(re)];
  assert(m.length === 1, 'should match a .rip import');
  assert(m[0][3] === './schemas.rip', 'captures the specifier, got: ' + m[0][3]);
});

check('rewrites .rip RE-EXPORTS (the fix)', () => {
  const re = loaderRegex();
  const line = `export { UserView as User, OrderView as Order } from '../api/models.rip'`;
  const m = [...line.matchAll(re)];
  assert(m.length === 1, 'a re-export must be matched (regressed when import-only)');
  assert(m[0][3] === '../api/models.rip', 'captures the specifier, got: ' + m[0][3]);
});

check('captures the binding clause for blob rewriting', () => {
  const re = loaderRegex();
  const m = [...`export { A as B } from './x.rip'`.matchAll(re)][0];
  assert(/A as B/.test(m[2]), 'binding clause should be captured, got: ' + m[2]);
});

check('still ignores non-.rip specifiers', () => {
  const re = loaderRegex();
  assert([...`export { x } from 'some-pkg'`.matchAll(re)].length === 0, 'non-.rip must not match');
});

console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
