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

// Step 1: Build unminified version (readable, for debugging)
await Bun.build({
  entrypoints: ['./src/browser.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: false,
  naming: 'rip.browser.js'
});

// Replace version and build date in unminified bundle
let unminified = readFileSync('./docs/dist/rip.browser.js', 'utf-8');
unminified = unminified.replace('"0.0.0"', `"${version}"`);
unminified = unminified.replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
writeFileSync('./docs/dist/rip.browser.js', unminified);

console.log('✓ docs/dist/rip.browser.js');
console.log(`  Size: ${(Buffer.byteLength(unminified) / 1024).toFixed(2)} KB`);

// Step 2: Build minified version (for production)
await Bun.build({
  entrypoints: ['./src/browser.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: true,
  naming: 'rip.browser.min.js'
});

// Replace version and build date in minified bundle
let minified = readFileSync('./docs/dist/rip.browser.min.js', 'utf-8');
minified = minified.replace('"0.0.0"', `"${version}"`);
minified = minified.replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
writeFileSync('./docs/dist/rip.browser.min.js', minified);

const minSize = Buffer.byteLength(minified);
const minRatio = ((1 - minSize / Buffer.byteLength(unminified)) * 100).toFixed(1);
console.log('✓ docs/dist/rip.browser.min.js');
console.log(`  Size: ${(minSize / 1024).toFixed(2)} KB (-${minRatio}%)`);

// Step 3: Brotli compress the minified version
const compressed = brotliCompressSync(Buffer.from(minified));
writeFileSync('./docs/dist/rip.browser.min.js.br', compressed);

const brSize = compressed.length;
const brRatio = ((1 - brSize / minSize) * 100).toFixed(1);
console.log('✓ docs/dist/rip.browser.min.js.br');
console.log(`  Size: ${(brSize / 1024).toFixed(2)} KB (-${brRatio}%)`);

// Step 4: Copy and compress ui.rip for GitHub Pages
const uiSource = readFileSync('./packages/ui/ui.rip', 'utf-8');
writeFileSync('./docs/dist/ui.rip', uiSource);
const uiCompressed = brotliCompressSync(Buffer.from(uiSource));
writeFileSync('./docs/dist/ui.rip.br', uiCompressed);
console.log('✓ docs/dist/ui.rip + ui.rip.br');
console.log(`  Size: ${(uiCompressed.length / 1024).toFixed(2)} KB (from ${(Buffer.byteLength(uiSource) / 1024).toFixed(2)} KB)`);

// Step 5: Pre-compile ui.rip to JavaScript
const uiJS = compileToJS(uiSource);
writeFileSync('./docs/dist/ui.js', uiJS);

const uiJSSize = Buffer.byteLength(uiJS);
console.log('✓ docs/dist/ui.js');
console.log(`  Size: ${(uiJSSize / 1024).toFixed(2)} KB`);

// Step 6: Minify pre-compiled ui.js
await Bun.build({
  entrypoints: ['./docs/dist/ui.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: true,
  naming: 'ui.min.js'
});

const uiMin = readFileSync('./docs/dist/ui.min.js', 'utf-8');
const uiMinSize = Buffer.byteLength(uiMin);
console.log('✓ docs/dist/ui.min.js');
console.log(`  Size: ${(uiMinSize / 1024).toFixed(2)} KB`);

// Step 7: Brotli compress minified ui
const uiMinBr = brotliCompressSync(Buffer.from(uiMin));
writeFileSync('./docs/dist/ui.min.js.br', uiMinBr);
console.log('✓ docs/dist/ui.min.js.br');
console.log(`  Size: ${(uiMinBr.length / 1024).toFixed(2)} KB`);

// Step 8: Create combined rip-ui bundle (compiler + pre-compiled UI)
// Generate a wrapper entry that includes browser.js and the pre-compiled UI
const ripUiEntry = `// Combined Rip compiler + pre-compiled UI framework
export * from '../../src/browser.js';
import * as __uiExports from './ui.js';

// Override importRip to return pre-compiled UI when ui.rip is requested
const _origImportRip = globalThis.importRip;
globalThis.importRip = async function(url) {
  if (url.includes('ui.rip')) return __uiExports;
  return _origImportRip(url);
};
`;
writeFileSync('./docs/dist/_rip-ui-entry.js', ripUiEntry);

await Bun.build({
  entrypoints: ['./docs/dist/_rip-ui-entry.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: true,
  naming: 'rip-ui.min.js'
});

// Replace version and build date in combined bundle
let ripUiMin = readFileSync('./docs/dist/rip-ui.min.js', 'utf-8');
ripUiMin = ripUiMin.replace('"0.0.0"', `"${version}"`);
ripUiMin = ripUiMin.replace('"0000-00-00@00:00:00GMT"', `"${buildDate}"`);
writeFileSync('./docs/dist/rip-ui.min.js', ripUiMin);

const ripUiMinSize = Buffer.byteLength(ripUiMin);
const ripUiMinBr = brotliCompressSync(Buffer.from(ripUiMin));
writeFileSync('./docs/dist/rip-ui.min.js.br', ripUiMinBr);

console.log('✓ docs/dist/rip-ui.min.js');
console.log(`  Size: ${(ripUiMinSize / 1024).toFixed(2)} KB (${(ripUiMinBr.length / 1024).toFixed(2)} KB Brotli)`);

// Clean up temp entry file
try { unlinkSync('./docs/dist/_rip-ui-entry.js'); } catch {}

// Final summary
const origSize = Buffer.byteLength(unminified);
const totalRatio = ((1 - brSize / origSize) * 100).toFixed(1);
console.log('');
console.log('Summary:');
console.log(`  rip.browser.js:     ${(origSize / 1024).toFixed(2)} KB`);
console.log(`  rip.browser.min.js: ${(minSize / 1024).toFixed(2)} KB (${(brSize / 1024).toFixed(2)} KB Brotli)`);
console.log(`  ui.min.js:          ${(uiMinSize / 1024).toFixed(2)} KB (${(uiMinBr.length / 1024).toFixed(2)} KB Brotli)`);
console.log(`  rip-ui.min.js:      ${(ripUiMinSize / 1024).toFixed(2)} KB (${(ripUiMinBr.length / 1024).toFixed(2)} KB Brotli)`);
console.log('');
console.log(`✨ Browser bundles ready • Version ${version} • ${buildDate}`);
console.log('🚀 Run: bun run serve');
console.log('📱 Visit: http://localhost:3000/');
