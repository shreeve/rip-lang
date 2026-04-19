#!/usr/bin/env bun

// scripts/link-check.js — guardrail: fail fast if `rip-lang` resolves
// to anything other than the live source tree in this repo.
//
// The canonical failure this catches is a stale
// `node_modules/.bun/rip-lang@X.Y.Z/` tarball shadowing the workspace
// root, causing rip-server workers to parse source files with an older
// compiler than the one the CLI is using.
//
// Used by postinstall (after scripts/link-local.js) and available
// standalone via `bun run link-check`.

import { createRequire } from 'node:module'
import { realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisFile = fileURLToPath(import.meta.url)
const repoRoot = realpathSync(dirname(dirname(thisFile)))

let resolved
try {
  const require = createRequire(import.meta.url)
  resolved = realpathSync(require.resolve('rip-lang/package.json'))
} catch {
  // No installed copy yet (fresh clone, preinstall) — that's fine.
  // The install itself will place things correctly via postinstall.
  process.exit(0)
}

if (!resolved.startsWith(repoRoot + '/') && resolved !== join(repoRoot, 'package.json')) {
  console.error('')
  console.error('  FATAL: rip-lang resolved outside the workspace root.')
  console.error(`  found:    ${resolved}`)
  console.error(`  expected: ${join(repoRoot, 'package.json')}`)
  console.error('')
  console.error('  A stale copy in node_modules/ is shadowing the workspace source.')
  console.error('  Fix with:')
  console.error('')
  console.error('    rm -rf node_modules bun.lock && bun install')
  console.error('')
  process.exit(1)
}

if (!process.argv.includes('--quiet')) {
  console.log(`[rip] link-check: rip-lang -> ${repoRoot}`)
}
