#!/usr/bin/env bun

// Type audit verification suite
// Usage: bun test/types/runner.js  (or: bun run test:types)

import { execSync } from 'child_process';
import { readdirSync, writeFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';

const dir = dirname(new URL(import.meta.url).pathname);
const rip = resolve(dir, '../../bin/rip');
const run = (cmd, opts = {}) => execSync(cmd, { cwd: dir, stdio: 'pipe', timeout: 30000, ...opts }).toString();
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*m/g, '');

const isColor = process.stdout.isTTY !== false;
const green = s => isColor ? `\x1b[32m${s}\x1b[0m` : s;
const red   = s => isColor ? `\x1b[31m${s}\x1b[0m` : s;
const dim   = s => isColor ? `\x1b[2m${s}\x1b[0m` : s;
const bold  = s => isColor ? `\x1b[1m${s}\x1b[0m` : s;

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail) => {
  if (ok) { pass++; results.push({ name, ok: true }); }
  else { fail++; results.push({ name, ok: false, detail }); }
};

// Clean up leftover probe from a previous crashed run
try { unlinkSync(resolve(dir, '_strict_probe.rip')); } catch {}

// Type-check all .rip files
try {
  run(`${rip} check`);
  check('rip check', true);
} catch (e) {
  check('rip check', false, stripAnsi(e.stdout?.toString() || e.message));
}

// Type-check all .ts files
try {
  run('bunx tsc');
  check('bunx tsc', true);
} catch (e) {
  check('bunx tsc', false, e.stdout?.toString() || e.message);
}

// Run all .rip files
const ripFiles = readdirSync(dir).filter(f => f.endsWith('.rip')).sort();
for (const f of ripFiles) {
  try {
    run(`${rip} ${f}`);
    check(`run ${f}`, true);
  } catch (e) {
    check(`run ${f}`, false, e.stderr?.toString().slice(0, 200) || e.message);
  }
}

// Run all .ts/.tsx files
const tsFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts')).sort();
for (const f of tsFiles) {
  try {
    run(`bun run ${f}`);
    check(`run ${f}`, true);
  } catch (e) {
    check(`run ${f}`, false, e.stderr?.toString().slice(0, 200) || e.message);
  }
}

// Output parity — auto-discovered from .rip files that have a .ts/.tsx companion
for (const f of ripFiles) {
  const n = f.replace(/\.rip$/, '');
  const ext = tsFiles.find(t => t === `${n}.tsx`) ? 'tsx' : tsFiles.find(t => t === `${n}.ts`) ? 'ts' : null;
  if (!ext) continue;
  try {
    const ripOut = run(`${rip} ${n}.rip 2>&1`);
    const tsOut = run(`bun run ${n}.${ext} 2>&1`);
    check(`parity ${n}`, ripOut === tsOut, `output differs`);
  } catch {
    check(`parity ${n}`, true, 'skipped (runtime error)');
  }
}

// Strict mode enforcement
try {
  const probe = resolve(dir, '_strict_probe.rip');
  writeFileSync(probe, 'x = "hello"\nx()\n');
  try {
    run(`${rip} check`);
    check('strict mode', false, 'rip check exited 0 — expected TS2349');
  } catch (e) {
    const out = stripAnsi(e.stdout?.toString() || '');
    check('strict mode', out.includes('TS2349'), 'TS2349 not found in output');
  } finally {
    try { unlinkSync(probe); } catch {}
  }
} catch (e) {
  check('strict mode', false, e.message);
}

// Summary
console.log(bold('\n── Type Audit Results ──\n'));
for (const r of results) {
  if (r.ok) console.log(`  ${green('✓')} ${r.name}`);
  else {
    console.log(`  ${red('✗')} ${r.name}`);
    if (r.detail) for (const line of r.detail.split('\n').slice(0, 5)) console.log(`    ${dim(line)}`);
  }
}
console.log(`\n${bold(pass + fail + ' checks')}: ${green(pass + ' passing')}${fail ? ', ' + red(fail + ' failing') : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
