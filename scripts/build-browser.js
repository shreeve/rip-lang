#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { brotliCompressSync } from 'zlib';

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

// Final summary
const origSize = Buffer.byteLength(unminified);
const totalRatio = ((1 - brSize / origSize) * 100).toFixed(1);
console.log('');
console.log('Summary:');
console.log(`  Original:    ${(origSize / 1024).toFixed(2)} KB`);
console.log(`  Minified:    ${(minSize / 1024).toFixed(2)} KB`);
console.log(`  Compressed:  ${(brSize / 1024).toFixed(2)} KB (${totalRatio}% total reduction)`);
console.log('');
console.log(`✨ Browser bundles ready • Version ${version} • ${buildDate}`);
console.log('🚀 Run: bun run serve');
console.log('📱 Visit: http://localhost:3000/');
