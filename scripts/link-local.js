#!/usr/bin/env bun

// scripts/link-local.js — repo-local symlinks to the live rip-lang source tree.
//
// Problem: this repo root is the `rip-lang` package. Sub-packages in
// `packages/*` depend on it, but bun resolves that dep against the npm
// registry (there's no way to make a workspace *root* satisfy a child's
// dep on the root's own name). Result: a stale tarball lands at
// `node_modules/.bun/rip-lang@X.Y.Z/node_modules/rip-lang/` and is what
// `import.meta.resolve('rip-lang/package.json')` returns from any
// sub-package — including rip-server, whose workers preload the stale
// compiler and fail to parse current-grammar `.rip` files.
//
// Fix: after install, replace every cached rip-lang copy under
// `node_modules/.bun/rip-lang@*/node_modules/rip-lang/` with a symlink
// pointing at the repo root, and also re-link the top-level
// `node_modules/rip-lang/`. This makes every resolution path — via the
// lockfile or via classic node_modules walking — converge on the live
// source tree.
//
// Scope: writes only inside `./node_modules/` of this repo.
// Idempotent. Runs automatically on every `bun install` via `postinstall`
// and can be re-invoked manually via `bun run link-local`.
//
// Complements `scripts/link-global.js` (global CLIs + ~/node_modules),
// which is the one-time manual onboarding script for a dev machine.

import { existsSync, mkdirSync, readdirSync, readlinkSync, lstatSync, rmSync, symlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(dirname(thisFile)))
const nodeModules = join(repoRoot, 'node_modules')
const bunStore = join(nodeModules, '.bun')

const linked = []

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

if (linkTo(join(nodeModules, 'rip-lang'), '..')) {
  linked.push('node_modules/rip-lang')
}

if (existsSync(bunStore)) {
  for (const entry of readdirSync(bunStore)) {
    if (!entry.startsWith('rip-lang@')) continue
    const target = join(bunStore, entry, 'node_modules', 'rip-lang')
    if (linkTo(target, repoRoot)) {
      linked.push(`node_modules/.bun/${entry}/node_modules/rip-lang`)
    }
  }
}

if (linked.length && !process.argv.includes('--quiet')) {
  for (const path of linked) console.log(`[rip] linked ${path} -> repo root`)
}
