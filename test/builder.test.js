#!/usr/bin/env bun

// EmitBuilder + the builder emit seam — RFC 12 (Unified emitter), phase 1.
//
// Two things are verified:
//
//   1. EmitBuilder's contract — write() advances offset/line/column exactly,
//      mark() pins the current cursor, span() captures a range. These are the
//      primitives every converted handler will rely on to record exact source→
//      generated positions, so their arithmetic must be airtight.
//
//   2. The byte-equivalence gate — compiling with `useBuilder: true` (emission
//      routed through the builder via emitTo) must produce output byte-identical
//      to the string emitter. Today emitTo is a pure fallback, so this is the
//      invariant that lets handlers be converted one at a time: any conversion
//      that alters the generated JS fails here. Runs over the type-suite corpus
//      plus inline snippets for breadth.

import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EmitBuilder } from '../src/builder.js';
import { compileToJS } from '../src/compiler.js';

const here = dirname(fileURLToPath(import.meta.url));
const isColor = process.stdout.isTTY !== false;
const green = s => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const red   = s => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const dim   = s => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold  = s => isColor ? `\x1b[1m${s}\x1b[0m`  : s;

let pass = 0, fail = 0;
const lines = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; lines.push(`  ${green('✓')} ${name}`); }
  else { fail++; lines.push(`  ${red('✗')} ${name}${detail ? `\n    ${dim(detail)}` : ''}`); }
};

// ── 1. EmitBuilder contract ──────────────────────────────────────────────────

{
  const b = new EmitBuilder();
  b.write('let x');
  check('write advances offset/column on a single line',
    b.offset === 5 && b.line === 0 && b.column === 5,
    `offset=${b.offset} line=${b.line} column=${b.column}`);
}

{
  const b = new EmitBuilder();
  b.write('a\nbb\nccc');
  check('write tracks newlines and resets column',
    b.line === 2 && b.column === 3 && b.offset === 8,
    `line=${b.line} column=${b.column} offset=${b.offset}`);
}

{
  const b = new EmitBuilder();
  b.write('foo = ');
  b.mark({ r: 3, c: 7, n: 2 }, 'ident');
  b.write('42');
  const m = b.marks[0];
  check('mark pins the cursor where the next text is written',
    m && m.genOffset === 6 && m.genLine === 0 && m.genCol === 6 &&
    m.srcLine === 3 && m.srcCol === 7 && m.srcLen === 2,
    JSON.stringify(m));
}

{
  const b = new EmitBuilder();
  b.write('x');
  b.span({ r: 1, c: 0, n: 3 }, () => b.write('abc'), 'span');
  const m = b.marks[0];
  check('span records the full generated range',
    m && m.genOffset === 1 && m.genEndOffset === 4,
    JSON.stringify(m));
}

{
  const b = new EmitBuilder();
  b.write('');
  b.write(null);
  b.mark(null);
  check('empty/null writes and a null loc are no-ops',
    b.offset === 0 && b.marks.length === 0,
    `offset=${b.offset} marks=${b.marks.length}`);
}

{
  const b = new EmitBuilder();
  b.write('one ').write('two');
  check('toString concatenates all chunks',
    b.toString() === 'one two', JSON.stringify(b.toString()));
}

// ── 2. Byte-equivalence gate ─────────────────────────────────────────────────

const SNIPPETS = [
  ['empty', ''],
  ['literal', 'x = 42\n'],
  ['typed local + arrow', 'age = (dob:: string, asOf?) -> dob\nage("x")\n'],
  ['class + method', 'class C\n  greet: (name:: string) -> name\nc = C.new()\n'],
  ['control flow', 'for i in [1, 2, 3]\n  p i if i > 1\n'],
  ['object + destructure', '{a, b} = { a: 1, b: 2 }\no = { a, b, c: a + b }\n'],
  ['string interp + ternary', 'n = 3\ns = "n is #{n > 1 ? \'many\' : \'one\'}"\n'],
];

for (const [name, src] of SNIPPETS) {
  try {
    const a = compileToJS(src);
    const b = compileToJS(src, { useBuilder: true });
    check(`byte-equivalent: ${name}`, a === b,
      a === b ? '' : `outputs differ (${a.length} vs ${b.length} chars)`);
  } catch (e) {
    check(`byte-equivalent: ${name}`, false, e.message);
  }
}

// Broader corpus: every type-suite .rip source.
let typeDir = resolve(here, 'types');
let ripFiles = [];
try { ripFiles = readdirSync(typeDir).filter(f => f.endsWith('.rip')).sort(); } catch {}
for (const f of ripFiles) {
  try {
    const src = readFileSync(resolve(typeDir, f), 'utf8');
    const a = compileToJS(src);
    const b = compileToJS(src, { useBuilder: true });
    check(`byte-equivalent: types/${f}`, a === b,
      a === b ? '' : 'output differs under useBuilder');
  } catch (e) {
    check(`byte-equivalent: types/${f}`, false, e.message);
  }
}

// ── summary ──────────────────────────────────────────────────────────────────

console.log(bold('\n── EmitBuilder + byte-equivalence (RFC 12 phase 1) ──\n'));
for (const l of lines) console.log(l);
console.log(`\n${bold(`${pass + fail} checks`)}: ${green(`${pass} passing`)}${fail ? `, ${red(`${fail} failing`)}` : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
