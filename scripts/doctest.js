#!/usr/bin/env bun
// Documentation doctest harness.
//
// Extracts every fenced ```coffee block from the listed docs and
// COMPILES it (no execution — no DB, no network, no side effects).
// This makes documentation rot structurally impossible: an example
// that stops compiling fails CI, the same way a test does. The need is
// real — the Rip Schema manual shipped a `Money.add(other)` recipe for
// months that had never compiled (schema method parameters didn't
// parse until Phase 4).
//
// Annotations (HTML comment on the line directly above the fence):
//
//   <!-- doctest: skip -->   don't compile (intentionally-broken
//                            examples, pseudo-code, fragments)
//   <!-- doctest: fail -->   MUST fail to compile (documented compile
//                            errors — the block passes only if the
//                            compiler rejects it)
//
// Blocks tagged with other languages (```ts, ```js, ```bash, ```text)
// are ignored. Run: bun run test:docs

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compile } from '../src/compiler.js';
// Schema runtime provider — doc examples lean heavily on `schema`.
import '../src/schema/loader-server.js';
import '../src/dts.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DOC_FILES = [
  'docs/RIP-SCHEMA.md',
];

function extractBlocks(source, file) {
  const lines = source.split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const open = lines[i].match(/^```(\w+)?\s*$/);
    if (!open) { i++; continue; }
    const lang = open[1] || '';
    const startLine = i + 1;
    // Annotation on the line directly above the fence.
    let mode = 'compile';
    const prev = (lines[i - 1] || '').trim();
    const ann = prev.match(/^<!--\s*doctest:\s*(skip|fail)\s*-->$/);
    if (ann) mode = ann[1];
    const body = [];
    i++;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }
    i++; // closing fence
    if (lang === 'coffee') {
      blocks.push({ file, line: startLine, code: body.join('\n'), mode });
    }
  }
  return blocks;
}

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

for (const rel of DOC_FILES) {
  const source = readFileSync(resolve(repoRoot, rel), 'utf8');
  const blocks = extractBlocks(source, rel);
  for (const b of blocks) {
    if (b.mode === 'skip') { skipped++; continue; }
    let error = null;
    try {
      compile(b.code, {});
    } catch (e) {
      error = e;
    }
    if (b.mode === 'fail') {
      if (error) passed++;
      else {
        failed++;
        failures.push({ ...b, reason: 'expected a compile error, but it compiled' });
      }
    } else {
      if (!error) passed++;
      else {
        failed++;
        failures.push({ ...b, reason: error.message?.split('\n')[0] || String(error) });
      }
    }
  }
}

const color = (c, s) => process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s;
console.log(`doctest: ${passed} compiled, ${skipped} skipped, ${failed} failed`);
if (failures.length) {
  console.log('');
  for (const f of failures) {
    console.log(color('31', `  ✗ ${f.file}:${f.line}`) + ` — ${f.reason}`);
    const preview = f.code.split('\n').slice(0, 3).map(l => '      ' + l).join('\n');
    console.log(color('2', preview));
  }
  process.exit(1);
}
process.exit(0);
