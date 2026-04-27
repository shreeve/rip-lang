#!/usr/bin/env node
// scripts/postinstall.js — workspace-only postinstall hook.
//
// `link-local.js` and `link-check.js` rewrite `node_modules/.bun/` and
// `node_modules/rip-lang/` to point at the workspace's source tree.
// That's exactly what we want during dev, but it's meaningless — and
// would error — for consumers running `npm install rip-lang` from
// outside this repo (no `packages/` sibling, possibly no `bun` binary).
//
// This dispatcher checks for the workspace markers first and exits 0
// otherwise. Uses Node only (every npm install has Node; not every
// consumer has Bun). Tolerates missing files / non-zero subprocess
// exits — postinstall is best-effort, never fatal for consumers.

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (!existsSync('packages') || !existsSync('scripts/link-local.js')) process.exit(0);

const args = process.argv.slice(2);
const run = (script) => {
  const r = spawnSync('bun', ['scripts/' + script, ...args], { stdio: 'inherit' });
  return r.status ?? 0;
};

run('link-local.js');
run('link-check.js');
