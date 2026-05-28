#!/usr/bin/env bun

// Bundle a Rip source tree into a single static JSON file.
//
// Walks <rip-dir>/**/*.rip and (optionally) <css-dir>/*.css, packs them
// into one JSON with shape { css, modules, data } where `modules` maps
// origin-prefixed store keys to raw .rip source strings. The launcher
// HTML loads the JSON, injects `css` into a <style>, and calls
// `launch bundle: bundle` to mount the app — no bundler, no per-component
// fetches at runtime.
//
// The caller chooses the origin prefix to match the runtime's bundle
// convention: `_route/` for router pages, `_app/` for app-scoped helpers,
// `_lib/<name>/` for author-declared extra dirs, `_pkg/<pkg>/` for code
// shipped as a package.
//
// Usage:
//   bun scripts/bundle-app.js <rip-dir> --prefix <prefix> [--css <dir>] [-o output] [-t title]
//
// Examples:
//   bun scripts/bundle-app.js docs/demo/routes --prefix _route --css docs/demo/css \
//     -o docs/example/index.json -t "Rip App Demo"
//   bun scripts/bundle-app.js packages/ui/browser/components --prefix _pkg/ui \
//     -o docs/ui/bundle.json -t "Rip UI"

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { brotliCompressSync } from 'zlib';

const args = process.argv.slice(2);
const ripDir = args[0];

if (!ripDir) {
  console.error('Usage: bun scripts/bundle-app.js <rip-dir> --prefix <prefix> [--css <dir>] [-o output] [-t title]');
  process.exit(1);
}

let output = null;
let title = null;
let prefix = null;
let cssDir = null;

for (let i = 1; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) output = args[++i];
  else if (args[i] === '-t' && args[i + 1]) title = args[++i];
  else if (args[i] === '--prefix' && args[i + 1]) prefix = args[++i];
  else if (args[i] === '--css' && args[i + 1]) cssDir = args[++i];
}

if (!prefix) {
  console.error("Missing --prefix. Pass one of: _route, _app, _lib/<name>, _pkg/<pkg>.");
  process.exit(1);
}

const cleanPrefix = prefix.replace(/\/+$/, '');
const modules = {};

function scanRip(dir, sub) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanRip(path, `${sub}${entry.name}/`);
    } else if (entry.name.endsWith('.rip')) {
      modules[`${cleanPrefix}/${sub}${entry.name}`] = readFileSync(path, 'utf-8');
    }
  }
}

scanRip(ripDir, '');

let css = '';
if (cssDir) {
  try {
    for (const entry of readdirSync(cssDir, { withFileTypes: true })) {
      if (entry.name.endsWith('.css')) {
        css += readFileSync(join(cssDir, entry.name), 'utf-8') + '\n';
      }
    }
  } catch {
    // No css/ directory — that's fine
  }
}

// Build bundle
const bundle = {};
if (css.trim()) bundle.css = css.trim();
bundle.modules = modules;
bundle.data = {};
if (title) bundle.data.title = title;

const json = JSON.stringify(bundle, null, 2);

if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, json);
  const br = brotliCompressSync(Buffer.from(json));
  writeFileSync(`${output}.br`, br);
  const componentCount = Object.keys(modules).length;
  const size = (Buffer.byteLength(json) / 1024).toFixed(1);
  const brSize = (br.length / 1024).toFixed(1);
  console.log(`Bundled ${componentCount} components → ${output} (${size} KB, ${brSize} KB Brotli)`);
} else {
  process.stdout.write(json);
}
