#!/usr/bin/env bun

// Source-position markers — RFC 12 (Unified emitter), phase 1 bridge.
//
// Proves the marker primitive in isolation: wrapping pieces of generated code
// and stripping them yields byte-identical clean output plus EXACT generated
// spans — including the load-bearing property that two marks around identical
// text ("asOf" used twice) resolve to DISTINCT generated offsets. That is the
// canonical failure of the heuristic map (recordSubMappings picks the nearer
// generated occurrence); markers carry identity through concatenation, so they
// don't. No emitter wiring here — that's the next slice.

import { MarkerRecorder, stripMarkers } from '../src/markers.js';
import { compileToJS } from '../src/compiler.js';
import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const loc = (r, c, n) => ({ r, c, n });

// 1. strip is byte-identical to the unmarked text
{
  const rec = new MarkerRecorder();
  const marked = `let x = ${rec.wrap('id', loc(0, 8, 1), 'x')};`;
  const { code, marks } = stripMarkers(marked, rec);
  check('strip yields byte-identical clean code', code === 'let x = x;', JSON.stringify(code));
  check('one mark recorded', marks.length === 1, `${marks.length}`);
  check('mark span covers the wrapped text', code.slice(marks[0].genStart, marks[0].genEnd) === 'x',
    JSON.stringify(code.slice(marks[0].genStart, marks[0].genEnd)));
}

// 2. THE load-bearing case: two marks on identical text → distinct gen offsets
{
  const rec = new MarkerRecorder();
  const sig = rec.wrap('param', loc(0, 12, 4), 'asOf');
  const body = rec.wrap('ref', loc(0, 39, 4), 'asOf');
  const marked = `function(${sig}) { return ${body}; }`;
  const { code, marks } = stripMarkers(marked, rec);
  check('clean code is correct', code === 'function(asOf) { return asOf; }', JSON.stringify(code));
  check('two marks recorded', marks.length === 2);
  const [m1, m2] = marks;
  check('repeated text "asOf" gets DISTINCT generated offsets (the heuristic failure)',
    m1.genStart !== m2.genStart,
    `both at ${m1.genStart}`);
  check('signature mark maps to the param occurrence',
    code.slice(m1.genStart, m1.genEnd) === 'asOf' && m1.loc.c === 12);
  check('body mark maps to the return occurrence (later in the stream)',
    m2.genStart > m1.genStart && code.slice(m2.genStart, m2.genEnd) === 'asOf' && m2.loc.c === 39);
}

// 3. nesting: an outer span containing an inner mark
{
  const rec = new MarkerRecorder();
  const inner = rec.wrap('inner', loc(1, 0, 1), 'a');
  const outer = rec.wrap('outer', loc(0, 0, 5), `${inner} + b`);
  const { code, marks } = stripMarkers(outer, rec);
  check('nested strip is clean', code === 'a + b', JSON.stringify(code));
  const o = marks.find(m => m.kind === 'outer');
  const inr = marks.find(m => m.kind === 'inner');
  check('nested spans are correct',
    o && inr && code.slice(o.genStart, o.genEnd) === 'a + b' && code.slice(inr.genStart, inr.genEnd) === 'a',
    JSON.stringify(marks));
}

// 4. line/column tracking across newlines
{
  const rec = new MarkerRecorder();
  const marked = `line0\nline1 ${rec.wrap('id', loc(5, 0, 2), 'xy')}\n`;
  const { code, marks } = stripMarkers(marked, rec);
  check('multiline clean code', code === 'line0\nline1 xy\n', JSON.stringify(code));
  check('mark genLine/genCol correct', marks[0].genLine === 1 && marks[0].genCol === 6,
    `line=${marks[0].genLine} col=${marks[0].genCol}`);
}

// 5. no-ops: empty text / null loc are not wrapped
{
  const rec = new MarkerRecorder();
  check('empty text is not wrapped', rec.wrap('id', loc(0, 0, 0), '') === '');
  check('null loc is not wrapped', rec.wrap('id', null, 'x') === 'x');
  check('recorder inactive when nothing wrapped', rec.active === false);
}

// 6. imbalance fails hard (a marker swallowed by post-processing must not pass)
{
  const rec = new MarkerRecorder();
  const marked = rec.wrap('id', loc(0, 0, 1), 'x');
  const truncated = marked.slice(0, marked.length - 1); // drop the final SEP of the close tag
  let threw = false;
  try { stripMarkers(truncated, rec); } catch { threw = true; }
  check('unbalanced/truncated markers throw', threw);
}

// 7. byte-equivalence: exactMarks-stripped output must equal a normal compile,
// with no sentinel leaking into the generated code. This is the gate that lets
// handlers wrap identifiers behind markers without altering emitted JS.
{
  const here = dirname(fileURLToPath(import.meta.url));
  const typeDir = resolve(here, 'types');
  const opts = { sourceMap: true, types: 'emit', skipPreamble: true, stubComponents: true, inlineTypes: true };
  let sources = [
    'age = (dob:: string, asOf:: string) -> asOf\nasOf = "x"\n',
    'f = (x:: number) -> x + 1\n',
  ];
  try {
    for (const fn of readdirSync(typeDir).filter(f => f.endsWith('.rip'))) {
      sources.push(readFileSync(resolve(typeDir, fn), 'utf8'));
    }
  } catch {}
  let diffs = 0, stray = 0;
  for (const src of sources) {
    const off = compileToJS(src, opts);
    const on  = compileToJS(src, { ...opts, exactMarks: true });
    if (off !== on) diffs++;
    if (/[\uE000\uE001\uE002]/.test(on)) stray++;
  }
  check(`exactMarks output is byte-identical to normal (${sources.length} sources)`, diffs === 0, `${diffs} differ`);
  check('no marker sentinels leak into generated code', stray === 0, `${stray} leaked`);
}

console.log(bold('\n── Source-position markers (RFC 12 phase 1 bridge) ──\n'));
for (const l of out) console.log(l);
console.log(`\n${bold(`${pass + fail} checks`)}: ${green(`${pass} passing`)}${fail ? `, ${red(`${fail} failing`)}` : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
