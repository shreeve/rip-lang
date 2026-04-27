#!/usr/bin/env bun

// Bundle-graph guardrail.
//
// The browser bundle (docs/dist/rip.min.js) is built from src/browser.js +
// the compiled src/app.rip. Any module statically reachable from either
// entry ends up in the bundle, so accidental imports of CLI/server/editor-
// only code silently inflate the browser payload.
//
// This script walks the static import graph from BOTH entries and fails
// if any reachable file matches the forbidden list. Wired into `bun run
// build` so a regression fails the build, not the next bundle-size review.
//
// app.rip is walked because Rip's `import` syntax uses the same `import
// { X } from "./path"` shape as JS, and once compiled to JavaScript those
// imports are statically embedded into the bundle. Today app.rip has no
// imports, but adding one without scanning it would silently bypass the
// guardrail.
//
// Forbidden modules are CLI-only emitters, server-only runtimes, type-
// checker integration, and the headless widget package. The list is
// allowed to contain paths that don't exist yet — splits and renames
// will create them.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, relative } from 'path';

const repoRoot = resolve(import.meta.dir, '..');

// Files that must never be reachable from the browser bundle entry.
// Each entry is a repo-relative path. Missing files are silently skipped
// so this list can list future files we're about to extract.
const FORBIDDEN = [
  'src/typecheck.js',
  'src/types-emit.js',
  'packages/schema/src/dts-emit.js',
  'packages/schema/src/runtime-orm.js',
  'packages/schema/src/runtime-ddl.js',
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

// Browser bundle's persistent entries. The build script (scripts/build.js)
// wires these together with a transient _entry.js. We walk both directly.
const ENTRIES = ['src/browser.js', 'src/app.rip'];

// Match ES import statements. Captures the source specifier on group 1 or 2.
// Handles: import x from 'p', import {a} from "p", import 'p', import * as x from 'p',
//          import('p'), export * from 'p', export {x} from 'p'.
const IMPORT_RE = /(?:^|[\s;])(?:import|export)\s+(?:[^'"\n;]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
}

// Resolve a workspace specifier (e.g. '@rip-lang/schema/loader-browser') by
// reading its package.json `exports` map. We only handle workspace deps
// because that's the only way the browser bundle pulls in another package.
// Bare specifiers for npm/node-builtins return null (not in our source tree).
function resolveWorkspaceImport(spec) {
  if (!spec.startsWith('@rip-lang/')) return null;
  const rest  = spec.slice('@rip-lang/'.length);
  const slash = rest.indexOf('/');
  const pkg   = slash === -1 ? rest : rest.slice(0, slash);
  const sub   = slash === -1 ? '.'  : './' + rest.slice(slash + 1);
  const pkgJsonPath = resolve(repoRoot, 'packages', pkg, 'package.json');
  if (!existsSync(pkgJsonPath)) return null;
  let pkgJson;
  try { pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8')); }
  catch { return null; }
  const exp = pkgJson.exports;
  if (!exp) {
    if (sub === '.' && pkgJson.main) {
      return resolve(repoRoot, 'packages', pkg, pkgJson.main);
    }
    return null;
  }
  const target = exp[sub];
  if (!target) return null;
  // exports value is a string path or a conditional-export object — we only
  // need the file path, so unwrap the simple-string case.
  const filePath = typeof target === 'string' ? target : target.default;
  if (!filePath) return null;
  return resolve(repoRoot, 'packages', pkg, filePath);
}

function resolveImport(fromAbs, spec) {
  // Workspace deps walk into their package's source.
  const ws = resolveWorkspaceImport(spec);
  if (ws) return existsSync(ws) ? ws : null;
  // Skip remaining bare specifiers (npm packages, node:builtins, data:, etc.)
  if (!isRelative(spec)) return null;
  let abs = resolve(dirname(fromAbs), spec);
  // Try as-is, then common extensions, then as a directory index. .rip
  // is included so app.rip imports resolve to source even though they
  // get compiled to .js at build time.
  for (const candidate of [abs, abs + '.js', abs + '.mjs', abs + '.rip',
                            resolve(abs, 'index.js'), resolve(abs, 'index.rip')]) {
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

const entryAbsList = [];
for (const entry of ENTRIES) {
  const abs = resolve(repoRoot, entry);
  if (!existsSync(abs)) {
    console.error(`check-bundle-graph: entry not found: ${entry}`);
    process.exit(2);
  }
  entryAbsList.push(abs);
}

const reachableSet = new Set();
for (const entryAbs of entryAbsList) {
  for (const abs of walk(entryAbs)) reachableSet.add(abs);
}
const reachable = [...reachableSet];

const violations = [];
for (const abs of reachable) {
  const rel = relative(repoRoot, abs);
  if (isForbidden(rel)) violations.push(rel);
}

const isTTY = process.stdout.isTTY;
const C = (n, s) => isTTY ? `\x1b[${n}m${s}\x1b[0m` : s;

if (violations.length) {
  console.error(C('31;1', `\n  ✗ Bundle graph violation: ${violations.length} forbidden module(s) reachable from ${ENTRIES.join(' + ')}\n`));
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
  console.log(C('32', `  ✓ bundle graph clean — ${reachable.length} modules reachable from ${ENTRIES.join(' + ')}, 0 forbidden`));
}
