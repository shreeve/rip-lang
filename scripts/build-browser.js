#!/usr/bin/env bun

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { brotliCompressSync } from 'zlib';
import { compileToJS } from '../src/compiler.js';

const debug = process.argv.includes('--debug');

console.log(`Building browser bundle${debug ? ' (with unminified)' : ''}...\n`);

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;
const buildDate = new Date().toISOString().replace('T', '@').substring(0, 19) + 'GMT';

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
  await Bun.build({ entrypoints, outdir: './docs/dist', format: 'esm', minify, naming: name });
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

if (debug) await build(['./docs/dist/_entry.js'], 'rip.js', false);
await build(['./docs/dist/_entry.js'], 'rip.min.js', true);

// Clean up intermediates
try { unlinkSync('./docs/dist/_app.js'); } catch {}
try { unlinkSync('./docs/dist/_entry.js'); } catch {}

console.log(`\n✨ rip.min.js ready • Version ${version} • ${buildDate}`);
