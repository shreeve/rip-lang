#!/usr/bin/env bun

// scripts/link-global.js — set up your dev machine to run rip-lang from source.
//
// Run once per machine (re-run safely — it's idempotent). Symlinks:
//
//   ~/.bun/bin/rip                               -> $REPO/bin/rip
//   ~/.bun/bin/rip-db                            -> $REPO/packages/db/bin/rip-db
//   ~/.bun/bin/rip-print                         -> $REPO/packages/print/bin/rip-print
//   ~/.bun/bin/rip-server                        -> $REPO/packages/server/bin/rip-server
//   ~/node_modules/rip-lang                      -> $REPO
//   ~/node_modules/@rip-lang/<pkg>               -> $REPO/packages/<pkg>
//   ~/.bun/install/global/node_modules/rip-lang  -> $REPO
//   ~/.bun/install/global/node_modules/@rip-lang/<pkg>  -> $REPO/packages/<pkg>
//
// Also strips any prior npm-installed rip-lang from bun's global manifest
// so `bun i -g <anything>` won't silently reinstall rip-lang from npm
// and shadow the symlinks above.
//
// Idempotent: the second run produces no output. Also sweeps @rip-lang/*
// symlinks whose corresponding package has been removed from the repo.
//
// Scope: writes only under ~/. Never touches this repo's ./node_modules/.
// For that (automatic, every install), see scripts/link-local.js.

import { existsSync, mkdirSync, readdirSync, readlinkSync, lstatSync, rmSync, symlinkSync, statSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const thisFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(dirname(thisFile)))
const home = homedir()
const short = (path) => path.replace(home, '~')

const userMod = join(home, 'node_modules')
const globMod = join(home, '.bun/install/global/node_modules')
const globBin = join(home, '.bun/bin')

const changes = []

const linkTo = (path, target) => {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink() && readlinkSync(path) === target) return false
    rmSync(path, { recursive: true, force: true })
  } catch {}
  mkdirSync(dirname(path), { recursive: true })
  symlinkSync(target, path, 'dir')
  return true
}

// Strip any prior npm-installed rip-lang from bun's global manifest so
// `bun i -g <anything>` won't silently reinstall rip-lang from npm.
const userPkg = join(home, 'package.json')
if (existsSync(userPkg)) {
  const manifest = readFileSync(userPkg, 'utf8')
  if (/"rip-lang"|"@rip-lang\//.test(manifest)) {
    spawnSync('bun', ['remove', '-g', 'rip-lang'], { stdio: 'ignore' })
    changes.push(`cleaned bun global manifest`)
  }
}

// Top-level rip-lang -> $REPO (in both scopes).
for (const scope of [userMod, globMod]) {
  const path = join(scope, 'rip-lang')
  if (linkTo(path, repoRoot)) changes.push(`linked  ${short(path)} -> ${short(repoRoot)}`)
}

// @rip-lang/<pkg> -> $REPO/packages/<pkg> (in both scopes). Derived from
// the current packages/ directory, so packages that have been removed
// are detected below.
const pkgs = readdirSync(join(repoRoot, 'packages')).filter((name) => {
  try { return statSync(join(repoRoot, 'packages', name, 'package.json')).isFile() } catch { return false }
})
const pkgSet = new Set(pkgs)

for (const name of pkgs) {
  const target = join(repoRoot, 'packages', name)
  for (const scope of [userMod, globMod]) {
    const path = join(scope, '@rip-lang', name)
    if (linkTo(path, target)) changes.push(`linked  ${short(path)} -> ${short(target)}`)
  }
}

// Sweep stale @rip-lang/<pkg> symlinks whose package has been removed
// from the repo, in both scopes.
for (const scope of [userMod, globMod]) {
  const dir = join(scope, '@rip-lang')
  if (!existsSync(dir)) continue
  for (const entry of readdirSync(dir)) {
    if (pkgSet.has(entry)) continue
    const path = join(dir, entry)
    try {
      const stat = lstatSync(path)
      if (!stat.isSymbolicLink()) continue
      const target = readlinkSync(path)
      if (!target.startsWith(repoRoot)) continue
      rmSync(path, { force: true })
      changes.push(`removed ${short(path)} (stale -> ${short(target)})`)
    } catch {}
  }
}

// CLI binaries in ~/.bun/bin — managed symlinks only.
mkdirSync(globBin, { recursive: true })

const bins = [
  ['rip',        'bin/rip'],
  ['rip-db',     'packages/db/bin/rip-db'],
  ['rip-print',  'packages/print/bin/rip-print'],
  ['rip-server', 'packages/server/bin/rip-server'],
]

for (const [binName, relPath] of bins) {
  const source = join(repoRoot, relPath)
  if (!existsSync(source)) continue
  const path = join(globBin, binName)
  if (linkTo(path, source)) changes.push(`linked  ${short(path)} -> ${short(source)}`)
}

  if (changes.length === 0) {
  if (!process.argv.includes('--quiet')) console.log(`[rip] link-global: already up to date (${pkgs.length} packages)`)
  process.exit(0)
}

for (const line of changes) console.log(`  ${line}`)
console.log('\nDone. Verify with: rip --version')
