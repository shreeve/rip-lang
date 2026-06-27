#!/usr/bin/env bun

// Diagnostic-equivalence gate — RFC 12 (Unified emitter), phase 2.
//
// Phase 2 emits types inline (return types first) so the declare-header / body
// duplication that forces the global `SKIP_CODES` mutes disappears, letting
// those codes be recovered one at a time. The danger of that work is silent:
// a changed emission shape can move which diagnostics `tsc` reports, and the
// global mute can swallow a *new* real error just as it swallowed the old
// structural ones. Runtime byte-equivalence cannot see this (the shadow .ts is
// never run), and the source-map corpus only checks positions, not verdicts.
// This is the missing verdict gate. Two buckets, by design (see RFC 12 →
// "Diagnostic-equivalence gate"):
//
//   negative — tiny programs, each ONE genuine user mistake. Whether `rip
//              check` is expected to report it is derived LIVE from SKIP_CODES:
//              a code still globally muted is allowed to stay clean (pending
//              recovery); a code that has been retired from SKIP_CODES MUST now
//              surface. The row auto-flips the instant a slice removes its code
//              from SKIP_CODES — no edit here required to enforce the recovery.
//
//   equivalence — the type-clean audit corpus (test/types). Asserts two things
//              on the SAME language-service run `rip check` uses (not the tsc
//              CLI, which diverges on lib/flags):
//                (A) `rip check` keeps it clean — zero user-facing diagnostics.
//                (B) the set of diagnostics dropped by the *global* mute is
//                    exactly the committed ledger (diagnostic-ledger.json). A
//                    new entry means a real error is being newly masked (fail);
//                    a missing entry means a structural artifact recovered
//                    (fail with a "record it" nudge — rerun UPDATE_LEDGER=1).
//
// Run:  bun test/types/diagnostic-corpus.js     (or: bun run test:diagnostic-corpus)
//       UPDATE_LEDGER=1 bun test/types/diagnostic-corpus.js   (refresh the golden ledger)

import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, copyFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, dirname, join } from 'path';
import { SKIP_CODES, runCheck, mapToSourcePos } from '../../src/typecheck.js';

const dir  = dirname(new URL(import.meta.url).pathname);
const root = resolve(dir, '../..');
const rip  = join(root, 'bin/rip');
const LEDGER_PATH = join(dir, 'diagnostic-ledger.json');
const UPDATE = process.env.UPDATE_LEDGER === '1';

const isColor = process.stdout.isTTY !== false;
const c = (n, s) => isColor ? `\x1b[${n}m${s}\x1b[0m` : s;
const green = s => c(32, s), red = s => c(31, s), dim = s => c(2, s);
const bold  = s => c(1, s), yellow = s => c(33, s), cyan = s => c(36, s);

let pass = 0, fail = 0;
const lines = [];
const ok  = (name, note) => { pass++; lines.push(`  ${green('✓')} ${name}${note ? dim('  — ' + note) : ''}`); };
const bad = (name, why)  => { fail++; lines.push(`  ${red('✗')} ${name}\n    ${dim(why)}`); };

// ── Negative corpus ──────────────────────────────────────────────────────────
// Each probe is a real mistake raw `tsc` on the shadow flags. The expected
// `rip check` behaviour is NOT hard-coded — it follows SKIP_CODES membership,
// so retiring a code (phase-2 slice) is the only edit needed to enforce it.

const PROBES = [
  {
    code: 1064,
    title: 'Async return mis-annotated',
    why: 'An async `def` annotated `:: string` instead of `:: Promise<string>`. The bogus `: string` types every call site wrong with no error anywhere.',
    src: 'def delay(ms:: number):: Promise<string>\n  sleep! ms\n  "done"\n\ndef getName():: string\n  delay! 10\n',
  },
  {
    code: 2393,
    title: 'Duplicate function implementation',
    why: 'The same function defined twice in one file — a classic merge/refactor slip.',
    src: 'def foo(a:: number):: number\n  a + 1\n\ndef foo(a:: number):: number\n  a + 2\n',
  },
  {
    code: 2394,
    title: 'Incompatible overload signature',
    why: 'A bodiless overload `def f(x:: string)` whose implementation only accepts `number`.',
    src: 'def f(x:: string):: number\ndef f(x:: number):: number\n  x\n',
  },
];

function ripCheckReports(code, src) {
  const tmp = mkdtempSync(join(tmpdir(), 'rip-diag-'));
  try {
    copyFileSync(join(dir, 'tsconfig.json'), join(tmp, 'tsconfig.json'));
    writeFileSync(join(tmp, 'package.json'), '{\n  "rip": { "strict": true, "checkAll": true }\n}\n');
    writeFileSync(join(tmp, 'x.rip'), src);
    const r = spawnSync(rip, ['check', tmp], { encoding: 'utf8' });
    // Strip ANSI before matching: rip check wraps the code in dim escapes
    // (`\x1b[2mTS1064\x1b[0m`), whose trailing `m` is a word char that would
    // defeat a leading `\b` in the code pattern.
    const out = ((r.stdout || '') + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');
    return { reports: new RegExp(`\\bTS${code}\\b`).test(out), clean: r.status === 0 };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

lines.push(bold('Negative corpus — recovery follows SKIP_CODES'));
for (const p of PROBES) {
  const muted = SKIP_CODES.has(p.code);
  const { reports } = ripCheckReports(p.code, p.src);
  const label = `TS${p.code} ${p.title}`;
  if (muted) {
    // Still globally muted → pending recovery. Clean is the expected state;
    // a surfaced error here is good news that the catalog hasn't recorded.
    if (!reports) ok(label, 'still globally muted (pending recovery)');
    else bad(label, `TS${p.code} now surfaces though still in SKIP_CODES — remove it from SKIP_CODES and update the catalog (good news).`);
  } else {
    // Retired from SKIP_CODES → the mistake MUST now surface.
    if (reports) ok(label, 'recovered — rip check now reports it');
    else bad(label, `TS${p.code} was retired from SKIP_CODES but rip check still reports clean — the inline-emission slice did not surface it.`);
  }
}

// ── Equivalence corpus (test/types) ───────────────────────────────────────────
// One runCheck pass yields both the user-facing verdict (A) and the
// globally-muted ledger (B), on the exact language-service path rip check uses.

const ledger = [];
const orig = { log: console.log, warn: console.warn };
console.log = () => {}; console.warn = () => {};
let exitCode;
try {
  exitCode = await runCheck(dir, {
    onGlobalSkip: ({ filePath, code, start, entry }) => {
      const pos = mapToSourcePos(entry, start);
      const file = filePath.split('/').pop();
      const line = pos ? pos.line + 1 : null;
      const col  = pos ? pos.col + 1 : null;
      const srcLine = pos ? (entry.source.split('\n')[pos.line] || '') : '';
      const name = pos ? (srcLine.slice(pos.col).match(/^[A-Za-z_$][\w$]*/)?.[0] || '') : '';
      ledger.push({ file, code, line, col, name });
    },
  });
} finally {
  console.log = orig.log; console.warn = orig.warn;
}

const keyOf = e => `${e.file}:${e.line}:${e.col}:${e.code}:${e.name}`;
const sortLedger = arr => [...arr].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
const current = sortLedger(ledger);

lines.push('');
lines.push(bold('Equivalence corpus — test/types (clean audit corpus)'));

// (A) user-facing verdict — clean stays clean
if (exitCode === 0) ok('rip check clean', 'zero user-facing diagnostics on the audit corpus');
else bad('rip check clean', `runCheck exited ${exitCode} — the audit corpus is no longer clean (inline emission introduced a user-facing diagnostic).`);

// (B) globally-muted ledger — snapshot equivalence
if (UPDATE) {
  writeFileSync(LEDGER_PATH, JSON.stringify(current, null, 2) + '\n');
  ok('global-skip ledger', `updated diagnostic-ledger.json (${current.length} entr${current.length === 1 ? 'y' : 'ies'})`);
} else {
  const golden = existsSync(LEDGER_PATH) ? sortLedger(JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))) : [];
  const goldenKeys = new Set(golden.map(keyOf));
  const currentKeys = new Set(current.map(keyOf));
  const added   = current.filter(e => !goldenKeys.has(keyOf(e)));
  const removed = golden.filter(e => !currentKeys.has(keyOf(e)));
  if (added.length === 0 && removed.length === 0) {
    ok('global-skip ledger', `${current.length} structural diagnostic${current.length === 1 ? '' : 's'} muted, all accounted for`);
  } else {
    const parts = [];
    if (added.length)   parts.push(`${added.length} NEW masked diagnostic(s): ${added.map(keyOf).join(', ')} — a real error is being hidden by a global mute.`);
    if (removed.length) parts.push(`${removed.length} recovered (no longer masked): ${removed.map(keyOf).join(', ')} — good news; rerun with UPDATE_LEDGER=1 to record it.`);
    bad('global-skip ledger', parts.join('\n    '));
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log(bold('\n── Diagnostic-Equivalence Gate (RFC 12 phase 2) ──\n'));
for (const l of lines) console.log(l);
console.log(
  `\n${bold(`${pass + fail} checks`)}: ${green(`${pass} passing`)}` +
  (fail ? `, ${red(`${fail} failing`)}` : '') +
  `  ${dim('·')}  SKIP_CODES: ${cyan([...SKIP_CODES].sort((a, b) => a - b).join(', '))}\n`
);

process.exit(fail > 0 ? 1 : 0);
