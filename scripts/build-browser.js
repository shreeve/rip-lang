#!/usr/bin/env bun

import { readFileSync, writeFileSync, unlinkSync, copyFileSync } from 'fs';
import { brotliCompressSync } from 'zlib';
import { compileToJS } from '../src/compiler.js';

const debug = process.argv.includes('--debug');

console.log(`Building browser bundles${debug ? ' (with unminified)' : ''}...\n`);

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Get current date/time
const buildDate = new Date().toISOString().replace('T', '@').substring(0, 19) + 'GMT';

console.log(`Version: ${version}`);
console.log(`Build: ${buildDate}\n`);

function stamp(js) {
  return js.replace('"0.0.0"', `"${version}"`).replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
}

async function buildBundle(entrypoints, name) {
  // Unminified (only with --debug)
  if (debug) {
    const unminName = name.replace('.min.js', '.js');
    await Bun.build({ entrypoints, outdir: './docs/dist', format: 'esm', minify: false, naming: unminName });
    writeFileSync(`./docs/dist/${unminName}`, stamp(readFileSync(`./docs/dist/${unminName}`, 'utf-8')));
    const unminSize = (Buffer.byteLength(readFileSync(`./docs/dist/${unminName}`)) / 1024).toFixed(2);
    console.log(`  ${unminName.padEnd(24)} ${unminSize} KB`);
  }

  // Minified (always)
  await Bun.build({ entrypoints, outdir: './docs/dist', format: 'esm', minify: true, naming: name });
  const js = stamp(readFileSync(`./docs/dist/${name}`, 'utf-8'));
  writeFileSync(`./docs/dist/${name}`, js);

  const br = brotliCompressSync(Buffer.from(js));
  writeFileSync(`./docs/dist/${name}.br`, br);

  const size = (Buffer.byteLength(js) / 1024).toFixed(2);
  const brSize = (br.length / 1024).toFixed(2);
  console.log(`  ${name.padEnd(24)} ${size} KB  (${brSize} KB Brotli)`);

  return { js, size: Buffer.byteLength(js), brSize: br.length };
}

// Step 1: Rip compiler (no UI)
const rip = await buildBundle(['./src/browser.js'], 'rip.browser.min.js');

// Step 2: Pre-compile ui.rip → ui.js (intermediate)
const uiJS = compileToJS(readFileSync('./packages/ui/ui.rip', 'utf-8'));
writeFileSync('./docs/dist/_ui.js', uiJS);

// Step 3: Rip + UI combined bundle
const ripUiEntry = `import { importRip } from '../../src/browser.js';
export * from '../../src/browser.js';
import * as __uiExports from './_ui.js';
importRip.modules['ui.rip'] = __uiExports;
`;
writeFileSync('./docs/dist/_rip-ui-entry.js', ripUiEntry);

const ripUi = await buildBundle(['./docs/dist/_rip-ui-entry.js'], 'rip-ui.min.js');

// Clean up intermediates
try { unlinkSync('./docs/dist/_ui.js'); } catch {}
try { unlinkSync('./docs/dist/_rip-ui-entry.js'); } catch {}

// Copy rip-ui bundles to @rip-lang/ui package (canonical location)
if (debug) copyFileSync('./docs/dist/rip-ui.js', './packages/ui/dist/rip-ui.js');
copyFileSync('./docs/dist/rip-ui.min.js', './packages/ui/dist/rip-ui.min.js');
copyFileSync('./docs/dist/rip-ui.min.js.br', './packages/ui/dist/rip-ui.min.js.br');

// Summary
console.log(`\n✨ Browser bundles ready • Version ${version} • ${buildDate}`);
