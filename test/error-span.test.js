#!/usr/bin/env bun

// Error-span regression — RFC 12 (Unified emitter), parser loc-attach.
//
// The parser's generic reduction (src/grammar/solar.rip) used to record only
// {r, c} for every node and drop the span length `n`. RipError.fromSExpr reads
// `length: loc.n ?? 1`, so EVERY codegen-phase error caret was one character
// wide regardless of the offending construct. solar now records `n` (the span
// to the end of the last RHS symbol on the same line), so carets cover the real
// construct. This pins that: a codegen error must carry a span longer than one
// char and point at the offending construct.

import { compileToJS } from '../src/compiler.js';

const isColor = process.stdout.isTTY !== false;
const green = s => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const red   = s => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const dim   = s => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold  = s => isColor ? `\x1b[1m${s}\x1b[0m`  : s;

let pass = 0, fail = 0;
const out = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; out.push(`  ${green('✓')} ${name}`); }
  else { fail++; out.push(`  ${red('✗')} ${name}${detail ? `\n    ${dim(detail)}` : ''}`); }
};

// `return 5` inside a void `def f!` is a codegen-phase error raised on the
// `return` node (an array, so it carries .loc). The construct is `return 5`
// (8 chars) at column 2 on source line index 1.
{
  let err = null;
  try { compileToJS('def process!\n  return 5\n'); }
  catch (e) { err = e; }

  check('void-return raises a codegen error', err != null, 'no error thrown');
  if (err) {
    check('error caret spans the whole construct (n > 1, not the old length-1)',
      err.length === 8,
      `length=${err.length} (expected 8 for "return 5")`);
    check('error points at the offending construct (line 1, col 2)',
      err.line === 1 && err.column === 2,
      `line=${err.line} column=${err.column}`);
  }
}

// A second construct of a different width, to prove the span is computed from
// the source rather than a constant. `return 42 + 1` is 13 chars.
{
  let err = null;
  try { compileToJS('def process!\n  return 42 + 1\n'); }
  catch (e) { err = e; }
  check('span tracks construct width (return 42 + 1 → 13)',
    err != null && err.length === 13,
    err ? `length=${err.length} (expected 13)` : 'no error thrown');
}

console.log(bold('\n── Error-span regression (RFC 12 parser loc-attach) ──\n'));
for (const l of out) console.log(l);
console.log(`\n${bold(`${pass + fail} checks`)}: ${green(`${pass} passing`)}${fail ? `, ${red(`${fail} failing`)}` : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
