#!/usr/bin/env bun

// Map-correctness corpus — RFC 12 (Unified emitter), phase 1 gate.
//
// The RFC's central observation about fault B (source-map imprecision) is that
// "today no test asserts map correctness at all." The heuristic source map
// (recordSubMappings, src/compiler.js) re-derives each identifier's generated
// position by regex+distance search after codegen, so it can silently land on
// the wrong token — and nothing catches it. This corpus is that missing gate:
// for a curated set of source tokens it asserts srcToOffset (the exact function
// the LSP uses for hover/definition/semantic-tokens) lands on the intended
// generated token.
//
// Two buckets, by design (see RFC 12 → "Map-correctness gate"):
//
//   pass — positions the current heuristic already resolves correctly. These
//          are ENFORCED: a regression (a future emitter/map change that breaks
//          one) fails the suite. This is the net-new safety the heuristic never
//          had, and it protects every incremental builder slice that follows.
//
//   gap  — documented fault-B imprecisions the heuristic gets wrong today. They
//          are the position-builder's acceptance targets, not failures: the
//          suite stays green while a gap persists, and prints a loud notice when
//          one resolves (promote it to `pass`). A gap is asserted by its
//          *mechanism* (e.g. two distinct source tokens collapsing to one
//          generated offset), so "resolved" is unambiguous.

import { Compiler } from '../../src/compiler.js';
import { compileForCheck, srcToOffset } from '../../src/typecheck.js';

const isColor = process.stdout.isTTY !== false;
const green = s => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const red   = s => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const dim   = s => isColor ? `\x1b[2m${s}\x1b[0m`  : s;
const bold  = s => isColor ? `\x1b[1m${s}\x1b[0m`  : s;
const yellow = s => isColor ? `\x1b[33m${s}\x1b[0m` : s;

const isIdentChar = ch => ch != null && /[A-Za-z0-9_$]/.test(ch);

// Column of the `occ`-th occurrence (0-based) of `token` on source line `line`.
function colOf(source, line, token, occ = 0) {
  const text = source.split('\n')[line];
  if (text == null) throw new Error(`no source line ${line}`);
  let col = -1, seen = 0;
  while ((col = text.indexOf(token, col + 1)) !== -1) {
    if (seen === occ) return col;
    seen++;
  }
  throw new Error(`token '${token}' #${occ} not on line ${line}: ${JSON.stringify(text)}`);
}

// Resolve a source token to the generated offset srcToOffset produces.
function resolve(source, line, token, occ = 0) {
  const entry = compileForCheck('<corpus>', source, new Compiler(), {});
  const col = colOf(source, line, token, occ);
  const off = srcToOffset(entry, line, col);
  return { entry, off };
}

// Does the generated offset land exactly on `token` as a whole word?
function landsOn(entry, off, token) {
  if (off == null) return false;
  const gen = entry.tsContent;
  if (gen.slice(off, off + token.length) !== token) return false;
  return !isIdentChar(gen[off - 1]) && !isIdentChar(gen[off + token.length]);
}

let pass = 0, fail = 0, gapsOpen = 0, gapsResolved = 0;
const lines = [];
const ok   = (name)        => { pass++; lines.push(`  ${green('✓')} ${name}`); };
const bad  = (name, why)   => { fail++; lines.push(`  ${red('✗')} ${name}\n    ${dim(why)}`); };
const gap  = (name, why)   => { gapsOpen++; lines.push(`  ${yellow('○')} ${name} ${dim('(known gap)')}\n    ${dim(why)}`); };
const flip = (name)        => { gapsResolved++; lines.push(`  ${green('✓')} ${name} ${yellow('— GAP RESOLVED, promote to pass')}`); };

// ── pass bucket — must round-trip exactly ────────────────────────────────────

const PASS = [
  { name: 'typed local declaration',     src: 'x:: number = 42\nx + 1\n',                              line: 0, token: 'x' },
  { name: 'typed local reference',       src: 'count:: number = 0\ncount + 1\n',                       line: 1, token: 'count' },
  { name: 'arrow param (typed)',         src: 'age = (dob:: string, asOf:: string) -> dob\n',          line: 0, token: 'asOf' },
  { name: 'arrow optional param `?`',    src: 'f = (x:: number, y?:: number) -> x\nf(1)\n',            line: 0, token: 'y' },
  { name: 'class method param',          src: 'class C\n  greet: (name:: string) -> name\n',           line: 1, token: 'name' },
  { name: 'object literal key',          src: 'p = { totalPrice: 10 }\np.totalPrice\n',                line: 0, token: 'totalPrice' },
  { name: 'property access',             src: 'p = { totalPrice: 10 }\np.totalPrice\n',                line: 1, token: 'totalPrice' },
  { name: 'call callee',                 src: 'add = (a:: number, b:: number) -> a + b\nadd(1, 2)\n',  line: 1, token: 'add' },
  { name: 'repeated ident — signature',  src: 'age = (dob:: string, asOf:: string) -> asOf\nasOf = "x"\n', line: 0, token: 'asOf' },
  { name: 'repeated ident — statement',  src: 'age = (dob:: string, asOf:: string) -> asOf\nasOf = "x"\n', line: 1, token: 'asOf' },
];

for (const c of PASS) {
  try {
    const { entry, off } = resolve(c.src, c.line, c.token);
    if (landsOn(entry, off, c.token)) ok(c.name);
    else {
      const gotc = off == null ? '(undefined)' : JSON.stringify(entry.tsContent.slice(off, off + c.token.length + 4));
      bad(c.name, `srcToOffset for '${c.token}' landed on ${gotc}, expected '${c.token}'`);
    }
  } catch (e) {
    bad(c.name, e.message);
  }
}

// ── gap bucket — documented fault-B targets ──────────────────────────────────
// Each gap names the mechanism that makes "resolved" unambiguous, so the gate
// can detect when the position-builder closes it.

// Repeated-identifier resolution — the canonical recordSubMappings failure,
// now CLOSED by the marker bridge (exact generated positions). In
// `age = (dob, asOf) -> asOf` the body `asOf` and the signature `asOf` must
// resolve to DISTINCT generated offsets, each landing on its own occurrence
// (the body on `return asOf`, not the signature `asOf: string`). The heuristic
// alone collapses them onto the nearer generated line; the exact mark wins.
{
  const name = 'repeated ident — body distinct from signature';
  try {
    const src = 'age = (dob:: string, asOf:: string) -> asOf\nasOf = "x"\n';
    const sig  = resolve(src, 0, 'asOf', 0);          // signature occurrence
    const body = resolve(src, 0, 'asOf', 1);          // body occurrence (`-> asOf`)
    const distinct = sig.off != null && body.off != null && sig.off !== body.off;
    const sigOk = landsOn(sig.entry, sig.off, 'asOf');
    const bodyOk = landsOn(body.entry, body.off, 'asOf');
    const bodyOnReturn = bodyOk && /return\s+$/.test(body.entry.tsContent.slice(Math.max(0, body.off - 9), body.off));
    if (distinct && sigOk && bodyOnReturn) ok(name);
    else bad(name, `sig=${sig.off} body=${body.off} distinct=${distinct} bodyOnReturn=${bodyOnReturn}`);
  } catch (e) {
    bad(name, e.message);
  }
}

// ── summary ──────────────────────────────────────────────────────────────────

console.log(bold('\n── Source-Map Correctness Corpus (RFC 12 phase 1 gate) ──\n'));
for (const l of lines) console.log(l);
console.log(
  `\n${bold(`${pass + fail} enforced`)}: ${green(`${pass} passing`)}` +
  (fail ? `, ${red(`${fail} failing`)}` : '') +
  `  ${dim('·')}  ${yellow(`${gapsOpen} known gap${gapsOpen === 1 ? '' : 's'}`)}` +
  (gapsResolved ? `, ${green(`${gapsResolved} resolved (promote)`)}` : '') + '\n'
);

process.exit(fail > 0 ? 1 : 0);
