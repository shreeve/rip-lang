#!/usr/bin/env bun

// Bundle-graph guardrail.
//
// The browser bundle (docs/dist/rip.min.js) is built from src/browser.js +
// the compiled src/app.rip. Any module statically reachable from src/browser.js
// ends up in the bundle, so accidental imports of CLI/server/editor-only code
// silently inflate the browser payload.
//
// This script walks the static import graph from src/browser.js and fails
// if any reachable file matches the forbidden list. Wired into `bun run build`
// so a regression fails the build, not the next bundle-size review.
//
// Forbidden modules are CLI-only emitters, server-only runtimes, type-checker
// integration, and the headless widget package. The list is allowed to
// contain paths that don't exist yet — splits and renames will create them.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';

const repoRoot = resolve(import.meta.dir, '..');

// Files that must never be reachable from the browser bundle entry.
// Each entry is a repo-relative path. Missing files are silently skipped
// so this list can list future files we're about to extract.
const FORBIDDEN = [
  'src/typecheck.js',
  'src/types-emit.js',
  'src/schema-types.js',
  'src/schema/runtime-orm.js',
  'src/schema/runtime-ddl.js',
  'src/repl.js',
];

// Forbidden directory prefixes.
const FORBIDDEN_PREFIXES = [
  'packages/ui/',
  'packages/db/',
  'packages/server/',
  'packages/swarm/',
  'packages/csv/',
  'packages/http/',
  'packages/print/',
  'packages/time/',
  'packages/stamp/',
];

// Browser bundle's persistent entry. The build script wraps this with a
// transient _entry.js that adds app.rip; we walk the persistent half.
const ENTRY = 'src/browser.js';

// Match ES import statements. Captures the source specifier on group 1 or 2.
// Handles: import x from 'p', import {a} from "p", import 'p', import * as x from 'p',
//          import('p'), export * from 'p', export {x} from 'p'.
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s+(?:[^'"\n;]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
}

function resolveImport(fromAbs, spec) {
  // Skip bare specifiers (npm packages, node:builtins, data:, etc.)
  if (!isRelative(spec)) return null;
  let abs = resolve(dirname(fromAbs), spec);
  // Try as-is, then with .js, then as a directory index
  for (const candidate of [abs, abs + '.js', abs + '.mjs', resolve(abs, 'index.js')]) {
    if (existsSync(candidate)) return candidate;
  }
  // Soft-fail: import points outside the source tree (generated, optional).
  return null;
}

function walk(entryAbs) {
  const visited = new Set();
  const queue = [entryAbs];
  while (queue.length) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    let src;
    try { src = readFileSync(cur, 'utf8'); } catch { continue; }
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(src))) {
      const spec = m[1] ?? m[2];
      const next = resolveImport(cur, spec);
      if (next && !visited.has(next)) queue.push(next);
    }
  }
  return [...visited];
}

function isForbidden(rel) {
  if (FORBIDDEN.includes(rel)) return true;
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (rel.startsWith(prefix)) return true;
  }
  return false;
}

const entryAbs = resolve(repoRoot, ENTRY);
if (!existsSync(entryAbs)) {
  console.error(`check-bundle-graph: entry not found: ${ENTRY}`);
  process.exit(2);
}

const reachable = walk(entryAbs);
const violations = [];
for (const abs of reachable) {
  const rel = relative(repoRoot, abs);
  if (isForbidden(rel)) violations.push(rel);
}

const isTTY = process.stdout.isTTY;
const C = (n, s) => isTTY ? `\x1b[${n}m${s}\x1b[0m` : s;

if (violations.length) {
  console.error(C('31;1', `\n  ✗ Bundle graph violation: ${violations.length} forbidden module(s) reachable from ${ENTRY}\n`));
  for (const v of violations.sort()) console.error('    ' + C(31, v));
  console.error('');
  console.error('  These modules must NOT be reachable from the browser bundle.');
  console.error('  Either remove the offending import, or split the module so');
  console.error('  the browser-needed half lives in a separate file.');
  console.error('');
  process.exit(1);
}

const isQuiet = process.argv.includes('--quiet') || process.argv.includes('-q');
if (!isQuiet) {
  console.log(C('32', `  ✓ bundle graph clean — ${reachable.length} modules reachable, 0 forbidden`));
}
