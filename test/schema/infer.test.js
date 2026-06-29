#!/usr/bin/env bun
/**
 * Computed / eager-derived return-type inference (shadow-TS, gap 13)
 *
 * A `~>` getter or `!>` derived field used to type as `unknown` in the
 * emitted shape — `order.name` was `unknown` even though the body plainly
 * returns a string (Zod infers it for free). Codegen now stashes the
 * compiled bodies and the type emitter anchors each member to
 * `ReturnType<typeof __<Name>__behavior.field>`, so the body's own return
 * type flows through.
 *
 * What this pins:
 *   1. The shadow (`rip --shadow`, what `rip check` sees) emits the behavior
 *      const + `ReturnType<…>` members for computed AND derived; the plain
 *      `.d.ts` (`rip -d`) stays `unknown` with no behavior const.
 *   2. tsc actually infers the concrete type — a string-returning getter is
 *      usable as a string, and assigning it to the wrong type is rejected.
 */

import { writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');
const rip = resolve(root, 'bin', 'rip');
const typesDir = resolve(root, 'test', 'types'); // has bunx tsc + a strict tsconfig

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s);
let passed = 0, failed = 0; const failures = [];
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failures.push({ name, error: e }); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

const SRC = `Order = schema :shape
  total! number
  status: ~> if @total > 0 then 'paid' else 'unpaid'
  label:  !> "ORD-#{@total}"
`;

const ripFile = resolve(typesDir, '_infer_src.rip');
writeFileSync(ripFile, SRC);
const run = (args) => execSync(`'${rip}' ${args}`, { cwd: root }).toString();
const shadow = run(`--shadow '${ripFile}'`);
const published = run(`-d '${ripFile}'`);

check('the shadow emits the behavior const + ReturnType members', () => {
  assert(/const __Order__behavior = \{/.test(shadow), 'missing behavior const:\n' + shadow);
  assert(/readonly status: ReturnType<typeof __Order__behavior\.status>/.test(shadow), 'computed not anchored:\n' + shadow);
  assert(/label: ReturnType<typeof __Order__behavior\.label>/.test(shadow), 'derived not anchored:\n' + shadow);
});

check('the plain .d.ts stays unknown — no behavior const leaks', () => {
  assert(/readonly status: unknown/.test(published), 'computed should be unknown in .d.ts:\n' + published);
  assert(/label: unknown/.test(published), 'derived should be unknown in .d.ts:\n' + published);
  assert(!/__Order__behavior/.test(published), 'behavior const must not leak into .d.ts:\n' + published);
});

// tsc proof: the inferred member is the body's real type, not unknown.
function tscOnShadow(tail) {
  const file = resolve(typesDir, '_infer_tmp.ts');
  writeFileSync(file, `${shadow}\n${tail}\n`);
  try {
    execSync('bunx tsc --ignoreConfig --strict --noEmit --skipLibCheck _infer_tmp.ts', { cwd: typesDir, stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() || '') + (e.stderr?.toString() || '') };
  } finally {
    try { unlinkSync(file); } catch {}
  }
}

check('tsc infers a string-returning getter as string (usable, assignable)', () => {
  const r = tscOnShadow(`const __o = Order.parse({ total: 1 });\nconst __s: string = __o.status;\nconst __u: string = __o.label.toUpperCase();`);
  assert(r.ok, 'expected clean tsc, got:\n' + r.out);
});

check('tsc rejects assigning the inferred string member to a number', () => {
  const r = tscOnShadow(`const __o = Order.parse({ total: 1 });\nconst __bad: number = __o.status;`);
  assert(!r.ok, 'expected a type error (status is string, not number)');
  assert(/not assignable to type 'number'/.test(r.out), 'unexpected tsc output:\n' + r.out);
});

try { unlinkSync(ripFile); } catch {}
console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
