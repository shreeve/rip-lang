#!/usr/bin/env bun

// Parser freshness guard.
//
// src/parser.js is a generated artifact — produced by the solar parser
// generator from src/grammar/solar.rip + src/grammar/grammar.rip (`bun run
// parser`). It must never be hand-edited: a fix to the parser's behavior
// belongs in the grammar or the generator, then the file is regenerated.
//
// This check regenerates the parser into a temp file and asserts it is
// byte-identical to the committed src/parser.js. It fails if the committed
// file is stale (grammar/generator changed without regenerating) or was edited
// by hand (which a regeneration would silently overwrite). Run in `test:all`.

import { spawnSync } from 'child_process';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const committedPath = join(root, 'src/parser.js');
const solar = join(root, 'src/grammar/solar.rip');
const grammar = join(root, 'src/grammar/grammar.rip');

const committed = readFileSync(committedPath, 'utf8');

const tmpDir = mkdtempSync(join(tmpdir(), 'rip-parser-fresh-'));
const tmpOut = join(tmpDir, 'parser.js');
try {
  const res = spawnSync('bun', [solar, '-o', tmpOut, grammar], { cwd: root, stdio: 'pipe' });
  if (res.status !== 0) {
    console.error('✗ parser generation failed:');
    console.error((res.stderr || res.stdout || '').toString());
    process.exit(1);
  }
  const fresh = readFileSync(tmpOut, 'utf8');
  if (fresh !== committed) {
    console.error('✗ src/parser.js is out of date with the grammar/generator.');
    console.error('  It is a generated file — never hand-edit it. Run:');
    console.error('    bun run parser');
    console.error('  and commit the result.');
    process.exit(1);
  }
  console.log('✓ src/parser.js is byte-identical to a fresh generation (no hand-edits, not stale)');
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
