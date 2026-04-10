#!/usr/bin/env bun

// Type audit verification suite
// Usage: bun test/types/runner.js  (or: bun run test:types)

import { spawn } from 'child_process';
import { readdirSync } from 'fs';
import { resolve, dirname } from 'path';

const dir = dirname(new URL(import.meta.url).pathname);
const rip = resolve(dir, '../../bin/rip');
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

// Async exec helper — returns { ok, stdout, stderr }
const exec = (cmd, args) => new Promise(resolve => {
  const proc = spawn(cmd, args, { cwd: dir, stdio: 'pipe', timeout: 30000 });
  let stdout = '', stderr = '';
  proc.stdout.on('data', d => stdout += d);
  proc.stderr.on('data', d => stderr += d);
  proc.on('close', code => resolve({ ok: code === 0, stdout, stderr }));
});

// Discover files
const ripFiles = readdirSync(dir).filter(f => f.endsWith('.rip')).sort();
const tsFiles = readdirSync(dir).filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts')).sort();

// Run everything in parallel: type-checks + all file executions
const [ripCheck, tsc, ...fileResults] = await Promise.all([
  exec(rip, ['check']),
  exec('bunx', ['tsc']),
  ...ripFiles.map(async f => ({ file: f, type: 'rip', ...await exec(rip, [f]) })),
  ...tsFiles.map(async f => ({ file: f, type: 'ts', ...await exec('bun', ['run', f]) })),
]);

// Type-check results
check('rip check', ripCheck.ok, stripAnsi(ripCheck.stdout || ripCheck.stderr));
check('bunx tsc', tsc.ok, tsc.stdout || tsc.stderr);

// File run results + cache output for parity
const ripOutput = {}, tsOutput = {};
for (const r of fileResults) {
  const output = r.stdout + r.stderr;
  if (r.type === 'rip') {
    check(`run ${r.file}`, r.ok, output.slice(0, 200));
    if (r.ok) ripOutput[r.file] = r.stdout;
  } else {
    check(`run ${r.file}`, r.ok, output.slice(0, 200));
    if (r.ok) tsOutput[r.file] = r.stdout;
  }
}

// Output parity — compare cached output from .rip and .ts/.tsx runs
for (const f of ripFiles) {
  const n = f.replace(/\.rip$/, '');
  const companion = tsFiles.find(t => t === `${n}.tsx`) || tsFiles.find(t => t === `${n}.ts`);
  if (!companion) continue;
  const rOut = ripOutput[f], tOut = tsOutput[companion];
  if (rOut != null && tOut != null) check(`parity ${n}`, rOut === tOut, 'output differs');
  else check(`parity ${n}`, true, 'skipped (runtime error)');
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
