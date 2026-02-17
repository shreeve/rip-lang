#!/usr/bin/env bun

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { brotliCompressSync } from 'zlib';
import { compileToJS } from '../src/compiler.js';

console.log('Building browser bundles...\n');

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Get current date/time
const buildDate = new Date().toISOString().replace('T', '@').substring(0, 19) + 'GMT';

console.log(`Version: ${version}`);
console.log(`Build: ${buildDate}\n`);

// Helper: build, stamp version, write minified + brotli
async function buildBundle(entrypoints, name) {
  await Bun.build({ entrypoints, outdir: './docs/dist', format: 'esm', minify: true, naming: name });

  let js = readFileSync(`./docs/dist/${name}`, 'utf-8');
  js = js.replace('"0.0.0"', `"${version}"`);
  js = js.replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
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
const ripUiEntry = `export * from '../../src/browser.js';
import * as __uiExports from './_ui.js';
const _origImportRip = globalThis.importRip;
globalThis.importRip = async function(url) {
  if (url.includes('ui.rip')) return __uiExports;
  return _origImportRip(url);
};
`;
writeFileSync('./docs/dist/_rip-ui-entry.js', ripUiEntry);

const ripUi = await buildBundle(['./docs/dist/_rip-ui-entry.js'], 'rip-ui.min.js');

// Clean up intermediates
try { unlinkSync('./docs/dist/_ui.js'); } catch {}
try { unlinkSync('./docs/dist/_rip-ui-entry.js'); } catch {}

// Summary
console.log(`\n✨ Browser bundles ready • Version ${version} • ${buildDate}`);
