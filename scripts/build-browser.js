#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { brotliCompressSync } from 'zlib';

console.log('Building browser bundles...\n');

// Step 1: Build unminified version (readable, for debugging)
await Bun.build({
  entrypoints: ['./src/browser.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: false,
  naming: 'rip.browser.js'
});

const unminified = readFileSync('./docs/dist/rip.browser.js');
console.log('✓ docs/dist/rip.browser.js');
console.log(`  Size: ${(unminified.length / 1024).toFixed(2)} KB`);

// Step 2: Build minified version (for production)
await Bun.build({
  entrypoints: ['./src/browser.js'],
  outdir: './docs/dist',
  format: 'esm',
  minify: true,
  naming: 'rip.browser.min.js'
});

const minified = readFileSync('./docs/dist/rip.browser.min.js');
const minSize = minified.length;
const minRatio = ((1 - minSize / unminified.length) * 100).toFixed(1);
console.log('✓ docs/dist/rip.browser.min.js');
console.log(`  Size: ${(minSize / 1024).toFixed(2)} KB (-${minRatio}%)`);

// Step 3: Brotli compress the minified version
const compressed = brotliCompressSync(minified);
writeFileSync('./docs/dist/rip.browser.min.js.br', compressed);

const brSize = compressed.length;
const brRatio = ((1 - brSize / minSize) * 100).toFixed(1);
console.log('✓ docs/dist/rip.browser.min.js.br');
console.log(`  Size: ${(brSize / 1024).toFixed(2)} KB (-${brRatio}%)`);

// Final summary
const totalRatio = ((1 - brSize / unminified.length) * 100).toFixed(1);
console.log('');
console.log('Summary:');
console.log(`  Original:    ${(unminified.length / 1024).toFixed(2)} KB`);
console.log(`  Minified:    ${(minSize           / 1024).toFixed(2)} KB`);
console.log(`  Compressed:  ${(brSize            / 1024).toFixed(2)} KB (${totalRatio}% total reduction)`);
console.log('');
console.log('✨ Browser bundles ready in docs/dist/');
console.log('🚀 Run: bun run serve');
console.log('📱 Visit: http://localhost:3000/');
