#!/usr/bin/env bun

// Suppressed-diagnostic demonstration.
//
// `rip check` runs TypeScript under the hood but mutes whole error codes
// globally via SKIP_CODES (src/typecheck.js). Those codes fire on structural
// artifacts of the shadow-TS retrofit (a declare-header and a compiled body
// are two views of one symbol), but the mute is blunt — it can't tell a
// structural artifact from a genuine user mistake, so it drops both.
//
// Each probe below is a real user mistake. Raw `tsc` on the shadow flags it;
// `rip check` reports clean. Run it to see exactly what slips through:
//
//   bun test/types/suppressed.js     (or: bun run test:suppressed)
//
// This is the coverage RFC 12 (unified emitter) would recover — see
// rip-lang/RFCS.md, "Suppressed-diagnostic recovery". A row marked CHANGED
// means the suppression was narrowed or removed (good news) — update this
// catalog to match.

import { spawnSync } from 'child_process'
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'fs'
import { tmpdir } from 'os'
import { resolve, dirname, join } from 'path'

const dir = dirname(new URL(import.meta.url).pathname)
const root = resolve(dir, '../..')
const rip = join(root, 'bin/rip')
const tsc = join(root, 'node_modules/.bin/tsc')

const isColor = process.stdout.isTTY !== false
const c = (n, s) => isColor ? `\x1b[${n}m${s}\x1b[0m` : s
const green = s => c(32, s), red = s => c(31, s), dim = s => c(2, s)
const bold = s => c(1, s), yellow = s => c(33, s), cyan = s => c(36, s)

// Verified user-reachable: each error fires on the user's own construct
// (not just the structural header/body duplication). Codes 2391/2567/2842
// are deliberately excluded — in testing they fire only on structural
// artifacts, so suppressing them there is correct.
const PROBES = [
  {
    code: 1064,
    title: 'Async return mis-annotated',
    why: 'An async `def` annotated `:: string` instead of `:: Promise<string>`. The bogus `: string` survives into the declaration, so every call site types the result as `string` though it is actually a `Promise` — a latent bug with no error anywhere.',
    src: 'def delay(ms:: number):: Promise<string>\n  sleep! ms\n  "done"\n\ndef getName():: string\n  delay! 10\n',
  },
  {
    code: 2393,
    title: 'Duplicate function implementation',
    why: 'The same function defined twice in one file — a classic merge/refactor slip. Plain TypeScript reports it; rip check does not.',
    src: 'def foo(a:: number):: number\n  a + 1\n\ndef foo(a:: number):: number\n  a + 2\n',
  },
  {
    code: 2394,
    title: 'Incompatible overload signature',
    why: 'A bodiless overload `def f(x:: string)` whose implementation only accepts `number` — the `string` overload is a lie the checker never calls out.',
    src: 'def f(x:: string):: number\ndef f(x:: number):: number\n  x\n',
  },
]

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}

let changed = 0
console.log(bold('\n── Suppressed Diagnostics — errors rip check silently swallows ──\n'))
console.log(dim('Each is a genuine user mistake. Raw tsc on the shadow flags it; rip check reports clean.\n'))

for (const p of PROBES) {
  const tmp = mkdtempSync(join(tmpdir(), 'rip-suppressed-'))
  try {
    copyFileSync(join(dir, 'tsconfig.json'), join(tmp, 'tsconfig.json'))
    writeFileSync(join(tmp, 'package.json'), '{\n  "rip": { "strict": true, "checkAll": true }\n}\n')
    writeFileSync(join(tmp, 'x.rip'), p.src)

    const shadow = run(rip, ['--shadow', join(tmp, 'x.rip')])
    writeFileSync(join(tmp, 'x.ts'), shadow.out.replace(/^\/\/ ==.*$/m, '').trimStart())

    const tscRun = run(tsc, ['--noEmit', '--strict', '--target', 'ES2022', '--module', 'preserve', '--moduleDetection', 'force', join(tmp, 'x.ts')])
    const tscLine = tscRun.out.split('\n').find(l => l.includes(`error TS${p.code}`)) || ''
    const tscFlags = !!tscLine

    const rc = run(rip, ['check', tmp])
    const ripClean = rc.code === 0

    const suppressed = tscFlags && ripClean
    if (!suppressed) changed++

    console.log(`${suppressed ? yellow('⚠ SUPPRESSED') : red('✗ CHANGED')}  ${bold('TS' + p.code)} — ${p.title}`)
    console.log(dim('  ' + p.why))
    console.log(cyan('  rip source:'))
    for (const line of p.src.trimEnd().split('\n')) console.log(dim('    │ ') + line)
    console.log('  ' + (tscFlags
      ? red('tsc on shadow:  ') + tscLine.replace(/^.*?(error TS)/, '$1').trim()
      : green('tsc on shadow:  no TS' + p.code)))
    console.log('  ' + (ripClean
      ? yellow('rip check:      passes — error swallowed')
      : green('rip check:      reports the error')))
    console.log()
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (changed === 0) {
  console.log(yellow(`All ${PROBES.length} diagnostics are still globally suppressed.`))
  console.log(dim('This is the coverage RFC 12 (unified emitter) would recover — see rip-lang/RFCS.md.\n'))
} else {
  console.log(green(`${PROBES.length - changed} still suppressed, ${changed} changed.`))
  console.log(dim('A CHANGED row means suppression was narrowed/removed — update this catalog to match.\n'))
}
