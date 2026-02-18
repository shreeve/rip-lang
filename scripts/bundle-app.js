#!/usr/bin/env bun

// Bundle a Rip UI app into a static JSON file.
//
// Usage:
//   bun scripts/bundle-app.js <source-dir> [-o output] [-t title]
//
// Example:
//   bun scripts/bundle-app.js packages/ui/apps/demo -o docs/example/index.json -t "Rip UI Demo"

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';

const args = process.argv.slice(2);
const sourceDir = args[0];

if (!sourceDir) {
  console.error('Usage: bun scripts/bundle-app.js <source-dir> [-o output] [-t title]');
  process.exit(1);
}

// Parse flags
let output = null;
let title = null;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) output = args[++i];
  else if (args[i] === '-t' && args[i + 1]) title = args[++i];
}

// Scan components
const componentsDir = join(sourceDir, 'components');
const components = {};

function scanRip(dir, prefix) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanRip(path, `${prefix}${entry.name}/`);
    } else if (entry.name.endsWith('.rip')) {
      const key = `components/${prefix}${entry.name}`;
      components[key] = readFileSync(path, 'utf-8');
    }
  }
}

scanRip(componentsDir, '');

// Scan CSS
const cssDir = join(sourceDir, 'css');
let css = '';

try {
  for (const entry of readdirSync(cssDir, { withFileTypes: true })) {
    if (entry.name.endsWith('.css')) {
      css += readFileSync(join(cssDir, entry.name), 'utf-8') + '\n';
    }
  }
} catch {
  // No css/ directory — that's fine
}

// Build bundle
const bundle = {};
if (css.trim()) bundle.css = css.trim();
bundle.components = components;
bundle.data = {};
if (title) bundle.data.title = title;

const json = JSON.stringify(bundle, null, 2);

if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, json);
  const componentCount = Object.keys(components).length;
  const size = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`Bundled ${componentCount} components → ${output} (${size} KB)`);
} else {
  process.stdout.write(json);
}
