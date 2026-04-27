#!/usr/bin/env bun

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { brotliCompressSync } from 'zlib';
import { spawnSync } from 'child_process';
import { compileToJS } from '../src/compiler.js';

console.log('Building browser bundle...\n');

const guard = spawnSync('bun', ['scripts/check-bundle-graph.js', '--quiet'], { stdio: 'inherit' });
if (guard.status !== 0) {
  console.error('\nAborting build — fix the bundle graph violation above.');
  process.exit(guard.status ?? 1);
}

const fresh = spawnSync('bun', ['packages/schema/scripts/build-runtime.js', '--check', '--quiet'], { stdio: 'inherit' });
if (fresh.status !== 0) {
  console.error('\nAborting build — schema runtime is stale. Run: bun run build:schema-runtime');
  process.exit(fresh.status ?? 1);
}


const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// BUILD_DATE strategy: when the working tree is clean (no uncommitted
// changes in the source paths the bundle is built from), derive the
// timestamp from the most recent commit that *actually touched* one
// of those paths. This makes `bun run build` byte-deterministic on
// any given commit and immune to "non-source" commits (docs-only,
// test fixtures, TODOs, etc.) that bump HEAD without changing what
// the bundle contains.
//
// When source IS dirty (a build of in-progress work), fall back to
// wall-clock time, since dirty bytes don't correspond to any commit.
const SOURCE_PATHS = ['src/', 'packages/schema/src/', 'scripts/build.js'];

function getBuildDate() {
  try {
    const dirty = spawnSync('git', [
      'status', '--porcelain', '--', ...SOURCE_PATHS,
    ], { encoding: 'utf8' }).stdout.trim();
    if (dirty) throw new Error('dirty source');

    const iso = spawnSync('git', [
      'log', '-1', '--format=%cI', 'HEAD', '--', ...SOURCE_PATHS,
    ], { encoding: 'utf8' }).stdout.trim();
    if (!iso) throw new Error('no source-touching commit found');

    return new Date(iso).toISOString().replace('T', '@').substring(0, 19) + 'GMT';
  } catch {
    return new Date().toISOString().replace('T', '@').substring(0, 19) + 'GMT';
  }
}

const buildDate = getBuildDate();

console.log(`Version: ${version}`);
console.log(`Build: ${buildDate}\n`);

function stamp(js) {
  return js.replace('"0.0.0"', `"${version}"`).replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
}

// Step 1: Compile app.rip → _app.js (temporary)
const appJS = compileToJS(readFileSync('./src/app.rip', 'utf-8'));
writeFileSync('./docs/dist/_app.js', appJS);

// Step 2: Create entry point that wires browser.js + app.rip together
writeFileSync('./docs/dist/_entry.js', `\
import { importRip } from '../../src/browser.js';
export * from '../../src/browser.js';
import * as __appExports from './_app.js';
importRip.modules['app.rip'] = __appExports;
for (const [k, v] of Object.entries(__appExports)) if (typeof v === 'function') globalThis[k] = v;
`);

// Step 3: Build the bundle
async function build(entrypoints, name, minify) {
  await Bun.build({ entrypoints, outdir: './docs/dist', format: 'iife', minify, naming: name });
  const js = stamp(readFileSync(`./docs/dist/${name}`, 'utf-8'));
  writeFileSync(`./docs/dist/${name}`, js);

  const size = (Buffer.byteLength(js) / 1024).toFixed(2);

  if (minify) {
    const br = brotliCompressSync(Buffer.from(js));
    writeFileSync(`./docs/dist/${name}.br`, br);
    const brSize = (br.length / 1024).toFixed(2);
    console.log(`  ${name.padEnd(20)} ${size} KB  (${brSize} KB Brotli)`);
  } else {
    console.log(`  ${name.padEnd(20)} ${size} KB`);
  }
}

await build(['./docs/dist/_entry.js'], 'rip.js', false);
await build(['./docs/dist/_entry.js'], 'rip.min.js', true);

// Clean up intermediates
try { unlinkSync('./docs/dist/_app.js'); } catch {}
try { unlinkSync('./docs/dist/_entry.js'); } catch {}

console.log(`\n✨ rip.min.js ready • Version ${version} • ${buildDate}`);
