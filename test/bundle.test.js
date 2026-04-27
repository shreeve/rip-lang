#!/usr/bin/env bun

// Bundle smoke test.
//
// Loads docs/dist/rip.min.js into a fresh Bun subprocess, exercises the
// public surface, and reports. Subprocess isolation lets us (1) test the
// real bundle as deployed without polluting the parent's globalThis,
// (2) sidestep node:vm + new Function realm-binding quirks that break
// the bundle's runtime registration when run via vm.runInNewContext.
//
// Catches build-script regressions, bundler config drift, and import-graph
// mistakes that the source-level test suite (which runs against
// src/compiler.js directly) would otherwise miss.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const repoRoot = resolve(import.meta.dir, '..');
const bundlePath = resolve(repoRoot, 'docs/dist/rip.min.js');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s);
const red   = s => color('31;1', s);
const cyan  = s => color('36', s);

console.log(cyan('\nBuilding bundle for smoke test...'));
const build = spawnSync('bun', ['run', 'build'], { cwd: repoRoot, stdio: 'pipe' });
if (build.status !== 0) {
  console.error(red('Build failed:'));
  process.stderr.write(build.stderr);
  process.exit(1);
}

if (!existsSync(bundlePath)) {
  console.error(red(`Bundle not found at ${bundlePath}`));
  process.exit(1);
}

const bundleSize = readFileSync(bundlePath).length;
console.log(cyan(`Bundle: ${bundlePath} (${(bundleSize / 1024).toFixed(1)} KB)\n`));

// Driver runs in a subprocess; loads the bundle, runs assertions,
// prints JSON results, exits.
const driver = `
const { readFileSync } = require('fs');

globalThis.document = {
  readyState: 'complete',
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: { classList: { add: () => {} } },
};

const bundleSrc = readFileSync(${JSON.stringify(bundlePath)}, 'utf8');
(0, eval)(bundleSrc);

const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, error: e.message }); }
}

check('exports compileToJS on globalThis', () => {
  if (typeof globalThis.compileToJS !== 'function') throw new Error('compileToJS not exposed');
});

check('exports importRip on globalThis', () => {
  if (typeof globalThis.importRip !== 'function') throw new Error('importRip not exposed');
  if (!globalThis.importRip.modules) throw new Error('importRip.modules not initialized');
});

check('exports rip browser REPL', () => {
  if (typeof globalThis.rip !== 'function') throw new Error('rip() not exposed');
});

check('reactive runtime registered on globalThis.__rip', () => {
  if (!globalThis.__rip) throw new Error('__rip missing');
  for (const k of ['__state', '__effect', '__computed', '__batch']) {
    if (typeof globalThis.__rip[k] !== 'function') throw new Error('__rip.' + k + ' missing');
  }
});

check('component runtime registered on globalThis.__ripComponent', () => {
  if (!globalThis.__ripComponent) throw new Error('__ripComponent missing');
  for (const k of ['__pushComponent', '__popComponent', '__reconcile', '__transition']) {
    if (typeof globalThis.__ripComponent[k] !== 'function') {
      throw new Error('__ripComponent.' + k + ' missing');
    }
  }
});

check('compileToJS handles a basic expression', () => {
  const out = globalThis.compileToJS('x = 42; x');
  if (!out.includes('42')) throw new Error('unexpected output: ' + out);
});

check('compileToJS emits __schema for schema syntax', () => {
  const out = globalThis.compileToJS('Login = schema :input\\n  email! email\\n  password! string, 8..100');
  if (!out.includes('__schema')) throw new Error('schema not emitted');
  if (!out.includes('"input"')) throw new Error('wrong kind: ' + out);
});

check('compileToJS handles components', () => {
  const out = globalThis.compileToJS([
    'Counter = component',
    '  count := 0',
    '  render',
    '    button "count: \#{@count}"',
  ].join('\\n'));
  if (!/Component|component/.test(out)) throw new Error('component not emitted');
});

check('compileToJS strips type annotations from runtime output', () => {
  const out = globalThis.compileToJS('count:: number = 42; count');
  if (out.includes(':: number')) throw new Error('types leaked: ' + out);
  if (!out.includes('42')) throw new Error('value missing: ' + out);
});

check("app framework registered as importRip.modules['app.rip']", () => {
  const app = globalThis.importRip.modules['app.rip'];
  if (!app) throw new Error("importRip.modules['app.rip'] missing");
  if (typeof app.launch !== 'function') throw new Error('launch missing');
  if (typeof app.stash !== 'function') throw new Error('stash missing');
});

check("legacy 'ui.rip' key is NOT registered (atomic rename, no alias)", () => {
  if (globalThis.importRip.modules['ui.rip']) {
    throw new Error("'ui.rip' key still present — rename not atomic");
  }
});

check('bundle exposes language version', () => {
  const e = globalThis.__ripExports;
  if (!e || typeof e.VERSION !== 'string') throw new Error('VERSION missing');
  if (!/^\\d+\\.\\d+\\.\\d+/.test(e.VERSION)) throw new Error('bad VERSION: ' + e.VERSION);
});

process.stdout.write('\\u0001RESULTS\\u0001' + JSON.stringify(results) + '\\u0001RESULTS\\u0001');
`;

const child = spawnSync('bun', ['-e', driver], {
  cwd: repoRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});

if (child.status !== 0 && !child.stdout) {
  console.error(red('Bundle driver crashed:'));
  console.error(child.stderr);
  process.exit(1);
}

// Boot-simulation driver. Loads the bundle into a richer document stub
// that mimics a runtime <script src="rip.min.js" data-src="bundle.json">
// tag, stubs fetch to return a synthetic bundle, awaits the auto-boot
// (processRipScripts → globalThis.__ripScriptsReady), then asserts the
// no-router bundle path exposes the same components-source API surface
// that launch() does. Regression-tests the Apr 2026 fix where
// window.__RIP__.components silently went missing on no-router deploys.
const bootDriver = `
const { readFileSync } = require('fs');

let bootListener = null;

globalThis.window = globalThis;
globalThis.location = { pathname: '/', search: '', hash: '', href: 'http://test/' };
globalThis.document = {
  readyState: 'loading',
  addEventListener: (event, fn) => { if (event === 'DOMContentLoaded') bootListener = fn; },
  body: { classList: { add: () => {} }, prepend: () => {} },
  head: { appendChild: () => {} },
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, addEventListener: () => {} }),
  querySelector: (sel) => {
    if (sel.startsWith('script[src')) {
      const attrs = { 'data-src': 'bundle.json' };
      return {
        getAttribute: (a) => (a in attrs ? attrs[a] : null),
        setAttribute: () => {},
        hasAttribute: (a) => a in attrs,
      };
    }
    return null;
  },
  querySelectorAll: () => [],
};

const FAKE_SOURCE = '# foo widget\\nFoo = component\\n  render\\n    div "hi"';
const fetchCalls = [];
globalThis.fetch = async (url) => {
  fetchCalls.push(url);
  if (url === 'bundle.json') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ components: { 'components/foo.rip': FAKE_SOURCE } }),
      text: async () => '',
      headers: { get: () => null },
    };
  }
  return { ok: false, status: 404, json: async () => ({}), text: async () => '', headers: { get: () => null } };
};

const bundleSrc = readFileSync(${JSON.stringify(bundlePath)}, 'utf8');
(0, eval)(bundleSrc);

(async () => {
  const results = [];
  function check(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: e.message }); }
  }

  // Trigger DOMContentLoaded → processRipScripts via the captured listener.
  if (typeof bootListener === 'function') bootListener();
  if (globalThis.__ripScriptsReady) await globalThis.__ripScriptsReady;

  check('processRipScripts fetched bundle.json', () => {
    if (!fetchCalls.includes('bundle.json')) {
      throw new Error('fetch never called for bundle.json: ' + JSON.stringify(fetchCalls));
    }
  });

  check('window.__RIP__ exposed on no-router bundle path', () => {
    if (!globalThis.window.__RIP__) throw new Error('window.__RIP__ missing — no-router path did not wire components store');
  });

  check('window.__RIP__.components.read returns bundled source', () => {
    const store = globalThis.window.__RIP__ && globalThis.window.__RIP__.components;
    if (!store) throw new Error('__RIP__.components missing');
    if (typeof store.read !== 'function') throw new Error('__RIP__.components.read is not a function');
    const src = store.read('components/foo.rip');
    if (!src) throw new Error('components.read returned empty');
    if (!src.includes('Foo = component')) throw new Error('wrong source: ' + src);
  });

  process.stdout.write('\\u0001RESULTS\\u0001' + JSON.stringify(results) + '\\u0001RESULTS\\u0001');
})();
`;

const bootChild = spawnSync('bun', ['-e', bootDriver], {
  cwd: repoRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
});

if (bootChild.status !== 0 && !bootChild.stdout) {
  console.error(red('Boot-simulation driver crashed:'));
  console.error(bootChild.stderr);
  process.exit(1);
}

const mBoot = bootChild.stdout.match(/\u0001RESULTS\u0001(.*?)\u0001RESULTS\u0001/);
if (!mBoot) {
  console.error(red('Boot-simulation driver produced no result envelope.'));
  console.error('stdout:', bootChild.stdout);
  console.error('stderr:', bootChild.stderr);
  process.exit(1);
}

const m = child.stdout.match(/\u0001RESULTS\u0001(.*?)\u0001RESULTS\u0001/);
if (!m) {
  console.error(red('Driver produced no result envelope.'));
  console.error('stdout:', child.stdout);
  console.error('stderr:', child.stderr);
  process.exit(1);
}

const results = [...JSON.parse(m[1]), ...JSON.parse(mBoot[1])];
let passed = 0, failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ${green('✓')} ${r.name}`);
    passed++;
  } else {
    console.log(`  ${red('✗')} ${r.name}`);
    console.log(`    ${red(r.error)}`);
    failed++;
  }
}

console.log('');
if (failed === 0) {
  console.log(green(`${passed} checks: ${passed} passing`));
  console.log('');
  process.exit(0);
} else {
  console.log(red(`${passed + failed} checks: ${passed} passing, ${failed} failing`));
  console.log('');
  process.exit(1);
}
