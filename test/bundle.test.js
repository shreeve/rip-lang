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
  removeEventListener: () => {},
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
  if (typeof app.createStash !== 'function') throw new Error('createStash missing');
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

check("@rip-lang/app exports copied to globalThis", () => {
  for (const k of ['launch', 'createStash', 'createResource', 'createRouter', 'createRenderer', 'createComponents', 'source', 'createMutation']) {
    if (typeof globalThis[k] !== 'function') {
      throw new Error('globalThis.' + k + ' missing — @rip-lang/app entry preamble did not copy it');
    }
  }
});

// ── Source cells — async behavior checks ────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SOURCE_TAG = Symbol.for('rip.source');
const asyncChecks = [];
function checkAsync(name, fn) {
  asyncChecks.push(
    Promise.resolve()
      .then(fn)
      .then(() => results.push({ name, ok: true }),
            (e) => results.push({ name, ok: false, error: e.message }))
  );
}

checkAsync('source: lazy — ungated proxy read is null, kicks the load, lands in place', async () => {
  let calls = 0;
  const stash = globalThis.createStash({ user: globalThis.source({ fetch: async () => { calls++; return { n: 1 }; } }) });
  const v = stash.user;
  if (v != null) throw new Error('unloaded read must be null');
  if (calls !== 1) throw new Error('first touch must kick the load');
  await sleep(5);
  if (!stash.user || stash.user.n !== 1) throw new Error('value must land in place');
});

checkAsync('source: ensure dedupes — one in-flight load per source', async () => {
  let calls = 0;
  const stash = globalThis.createStash({ user: globalThis.source({ fetch: async () => { calls++; await sleep(10); return { name: 'Ada' }; } }) });
  const cell = globalThis.unwrapStash(stash).user;
  if (calls !== 0) throw new Error('source must be lazy');
  await Promise.all([cell.ensure(), cell.ensure()]);
  if (calls !== 1) throw new Error('ensure must dedupe in-flight loads: ' + calls);
  if (stash.user.name !== 'Ada') throw new Error('proxy read must unwrap the cell value');
});

checkAsync('source: a write wins over an in-flight load', async () => {
  let resolveFetch;
  const stash = globalThis.createStash({ user: globalThis.source({ fetch: () => new Promise((r) => { resolveFetch = r; }) }) });
  const cell = globalThis.unwrapStash(stash).user;
  cell.ensure().catch(() => {});
  stash.user = { name: 'written' };
  resolveFetch({ name: 'stale' });
  await sleep(5);
  if (stash.user.name !== 'written') throw new Error('late load clobbered a newer write: ' + stash.user.name);
});

checkAsync('source: staleTime 0 (default) serves cached value and revalidates in background', async () => {
  let calls = 0;
  const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; } }) });
  const cell = globalThis.unwrapStash(stash).k;
  await cell.ensure();
  const v = await cell.ensure();
  if (!v || v.v !== 1) throw new Error('stale ensure must serve the cached value instantly');
  await sleep(10);
  if (calls !== 2) throw new Error('expected a background revalidate: ' + calls);
  if (stash.k.v !== 2) throw new Error('revalidate must update in place');
});

checkAsync("source: staleTime '5 min' serves within the window without refetching", async () => {
  let calls = 0;
  const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; }, staleTime: '5 min' }) });
  const cell = globalThis.unwrapStash(stash).k;
  await cell.ensure();
  await cell.ensure();
  await sleep(5);
  if (calls !== 1) throw new Error('fresh value must not refetch: ' + calls);
});

checkAsync('source: unrecognized staleTime warns and falls back to 0 (typo string, quoted/wrong symbol)', async () => {
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => { warns.push(a.join(' ')); };
  try {
    let calls = 0;
    const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; }, staleTime: '5 mins' }) });
    if (!warns.some((w) => w.includes('unrecognized staleTime'))) throw new Error('expected a warning for the typo: ' + JSON.stringify(warns));
    const cell = globalThis.unwrapStash(stash).k;
    await cell.ensure();
    await cell.ensure();   // fallback 0 -> stale-on-arrival -> background revalidate
    await sleep(10);
    if (calls !== 2) throw new Error('typo staleTime must behave as 0 (revalidate), got calls=' + calls);

    // Only the string 'forever' means forever — symbols (including
    // :forever, which untyped projects might try) warn instead of
    // silently meaning 0.
    warns.length = 0;
    globalThis.source({ fetch: async () => 1, staleTime: Symbol.for('forever') });
    if (!warns.some((w) => w.includes('Symbol(forever)'))) throw new Error('symbols must warn with their name: ' + JSON.stringify(warns));
  } finally {
    console.warn = origWarn;
  }
});

checkAsync('source: bare numeric staleTime string is ms, no warning', async () => {
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...a) => { warns.push(a.join(' ')); };
  try {
    let calls = 0;
    const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; }, staleTime: '300000' }) });
    const cell = globalThis.unwrapStash(stash).k;
    await cell.ensure();
    await cell.ensure();
    await sleep(5);
    if (calls !== 1) throw new Error("'300000' must behave as 5 minutes of freshness: " + calls);
    if (warns.length) throw new Error('numeric string must not warn: ' + JSON.stringify(warns));
  } finally {
    console.warn = origWarn;
  }
});

checkAsync("source: staleTime 'forever' loads once; refetch() still reloads", async () => {
  let calls = 0;
  const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; }, staleTime: 'forever' }) });
  const cell = globalThis.unwrapStash(stash).k;
  await cell.ensure();
  await cell.ensure();
  await sleep(5);
  if (calls !== 1) throw new Error("'forever' must not revalidate: " + calls);
  await cell.refetch();
  if (calls !== 2) throw new Error('explicit refetch must reload: ' + calls);
});

checkAsync('source: failed initial load stays unloaded + retries; failed refetch keeps last-good', async () => {
  let mode = 'fail';
  let calls = 0;
  const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; if (mode === 'fail') throw new Error('boom'); return { ok: calls }; } }) });
  const cell = globalThis.unwrapStash(stash).k;
  let rejected = false;
  await cell.ensure().catch(() => { rejected = true; });
  if (!rejected) throw new Error('a failed initial load must reject ensure');
  if (cell.peek() != null) throw new Error('cell must return to unloaded');
  if (cell.error == null) throw new Error('error must be recorded on the cell');
  mode = 'ok';
  const v = await cell.ensure();
  if (!v || v.ok !== 2) throw new Error('next gate must retry the load');
  mode = 'fail';
  await cell.refetch().catch(() => {});
  if (cell.peek() == null || cell.peek().ok !== 2) throw new Error('a failed refetch must keep last-good');
  if (cell.error == null) throw new Error('refetch error must be recorded');
});

checkAsync('source: write-null invalidates — ungated readers see null, next ensure refetches', async () => {
  let calls = 0;
  const stash = globalThis.createStash({ k: globalThis.source({ fetch: async () => { calls++; return { v: calls }; }, staleTime: '5 min' }) });
  const cell = globalThis.unwrapStash(stash).k;
  await cell.ensure();
  stash.k = null;
  if (cell.peek() != null) throw new Error('write-null must clear the cell value');
  await cell.ensure();
  if (calls !== 2) throw new Error('ensure after invalidate must refetch: ' + calls);
});

checkAsync('source: keyed family — one cell per key, callable proxy read, write-assign throws', async () => {
  const calls = [];
  const stash = globalThis.createStash({ order: globalThis.source({ fetch: async (id) => { calls.push(id); return { id }; } }) });
  const fam = globalThis.unwrapStash(stash).order;
  if (typeof stash.order !== 'function') throw new Error('keyed read must be callable through the proxy');
  if (stash.order('a') != null) throw new Error('unloaded keyed read must be null');
  await fam.cellFor('a').ensure();
  if (stash.order('a').id !== 'a') throw new Error('keyed value must land');
  await fam.cellFor('b').ensure();
  if (calls.length !== 2 || calls[1] !== 'b') throw new Error('one load per key expected: ' + JSON.stringify(calls));
  let threw = false;
  try { stash.order = { id: 'x' }; } catch (e) { threw = true; }
  if (!threw) throw new Error('value-assign to a keyed source must throw');
  fam.reset();
  if (stash.order('a') != null) throw new Error('family reset must clear keyed cells');
});

checkAsync('persistStash: projection skips source keys on save and restore', async () => {
  const store = {};
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.sessionStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
  const app1 = { data: globalThis.createStash({ cart: { items: [1] }, user: globalThis.source({ fetch: async () => ({ secret: true }) }) }) };
  const dispose1 = globalThis.persistStash(app1);
  dispose1();
  const saved = JSON.parse(store['__rip_app']);
  if (!saved.cart || saved.cart.items[0] !== 1) throw new Error('plain key must persist');
  if (saved.user != null) throw new Error('source key must not persist');
  store['__rip_app'] = JSON.stringify({ cart: { items: [2] }, user: { stale: true } });
  const app2 = { data: globalThis.createStash({ cart: { items: [] }, user: globalThis.source({ fetch: async () => ({ ok: 1 }) }) }) };
  const dispose2 = globalThis.persistStash(app2);
  if (app2.data.cart.items[0] !== 2) throw new Error('plain key must restore');
  const rawU = globalThis.unwrapStash(app2.data).user;
  if (!rawU || rawU[SOURCE_TAG] !== true) throw new Error('restore must not clobber a live source cell');
  dispose2();
});

checkAsync('stash: source(path) handle — reactive value/loading/error + refetch/reset, dev error on non-source', async () => {
  let calls = 0;
  const stash = globalThis.createStash({
    plain: 1,
    stats: globalThis.source({ fetch: async () => { calls++; return { n: calls }; } }),
    order: globalThis.source({ fetch: async (id) => ({ id }) }),
  });
  let threw = false;
  try { stash.source('plain'); } catch (e) { threw = true; }
  if (!threw) throw new Error('handle on a non-source path must throw');
  threw = false;
  try { stash.source('order'); } catch (e) { threw = true; }
  if (!threw) throw new Error('keyed handle without a key must throw');
  const h = stash.source('stats');
  if (h.value != null) throw new Error('handle value of unloaded cell must be null');
  await sleep(5); // handle .value read kicked the lazy load
  if (!h.value || h.value.n !== 1) throw new Error('handle value must land');
  await h.refetch();
  if (h.value.n !== 2) throw new Error('handle refetch must reload');
  h.reset();
  if (h.value != null && calls === 3) throw new Error('handle reset must unload');
  const hk = stash.source('order', 'o1');
  hk.value = { id: 'seeded' };  // test-seeding path for keyed cells
  if (stash.order('o1').id !== 'seeded') throw new Error('keyed handle write must seed the cell');
});

checkAsync('stash: reset() restores defaults, unloads sources, drops undeclared keys', async () => {
  let calls = 0;
  const stash = globalThis.createStash({
    cart: { items: [1, 2], total: 10 },
    user: globalThis.source({ fetch: async () => { calls++; return { name: 'Ada' }; } }),
  });
  // createStash itself doesn't stamp defaults (launch does) — stamp via the
  // same path launch uses: assert reset is sources-only without defaults.
  await globalThis.unwrapStash(stash).user.ensure();
  stash.cart.total = 99;
  stash.extra = 'undeclared';
  stash.reset();
  if (globalThis.unwrapStash(stash).user.peek() != null) throw new Error('reset must unload sources');
  if (stash.cart.total !== 99) throw new Error('without a defaults snapshot, plain keys stay');
  // now stamp defaults the way launch() does and reset again
  const raw = globalThis.unwrapStash(stash);
  Object.defineProperty(raw, Symbol.for('rip.defaults'), { value: { cart: { items: [1, 2], total: 10 } }, configurable: true });
  let purged = false;
  raw[Symbol.for('rip.persist')] = () => { purged = true; };
  stash.reset();
  if (stash.cart.total !== 10 || stash.cart.items.length !== 2) throw new Error('reset must restore declared defaults');
  if (stash.extra !== undefined) throw new Error('reset must drop undeclared keys');
  if (!purged) throw new Error('reset must purge the persisted snapshot');
});

checkAsync('createMutation: reactive pending/succeeded/error with onSuccess write-back', async () => {
  const stash = globalThis.createStash({ user: globalThis.source({ fetch: async () => ({ name: 'old' }) }) });
  let failNext = false;
  let errSeen = null;
  const update = globalThis.createMutation(
    async (data) => { if (failNext) throw new Error('422'); return { name: data.name }; },
    { onSuccess: (u) => { stash.user = u; }, onError: (e) => { errSeen = e; } }
  );
  if (update.pending !== false || update.succeeded !== false) throw new Error('initial flags must be false');
  const p = update({ name: 'new' });
  if (update.pending !== true) throw new Error('pending must flip during the action');
  await p;
  if (update.pending !== false || update.succeeded !== true) throw new Error('flags must settle on success');
  if (stash.user.name !== 'new') throw new Error('onSuccess write-back must update the stash key');
  failNext = true;
  await update({ name: 'x' });
  if (update.succeeded !== false || update.error == null) throw new Error('flags must settle on error');
  if (errSeen == null) throw new Error('onError must receive the error');
  if (stash.user.name !== 'new') throw new Error('a failed mutation must not roll anything back');
});

checkAsync('stash: peek never triggers a load and reads through cells', async () => {
  let calls = 0;
  const stash = globalThis.createStash({ user: globalThis.source({ fetch: async () => { calls++; return { name: 'Ada' }; } }), plain: { a: 1 } });
  if (stash.peek('user') !== null && stash.peek('user') !== undefined) throw new Error('peek of unloaded cell must be empty');
  if (calls !== 0) throw new Error('peek must never trigger a load');
  if (stash.peek('plain.a') !== 1) throw new Error('peek must walk plain paths');
  await globalThis.unwrapStash(stash).user.ensure();
  if (stash.peek('user.name') !== 'Ada') throw new Error('peek must read through a loaded cell');
  if (calls !== 1) throw new Error('peek must not refetch');
});

// ── Renderer gate flow — DOM-stubbed integration check ─────────────────
// Pre-seeded compiled modules (components.setCompiled) let mountRoute run
// without blob-URL imports, and 'render null' components never touch real
// DOM beyond createElement/appendChild stubs.
checkAsync('renderer: gates load before construction; failures route to onError; non-source path errors', async () => {
  const makeEl = () => ({
    children: [], attrs: {}, style: {}, innerHTML: '', textContent: '',
    appendChild(c) { this.children.push(c); },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector: () => null,
    remove() {},
  });
  globalThis.window = globalThis.window || { addEventListener: () => {}, removeEventListener: () => {} };
  globalThis.document.createElement = () => makeEl();
  globalThis.document.getElementById = () => null;
  globalThis.document.body.appendChild = () => {};

  const C = globalThis.__ripComponent.__Component;
  const gb = globalThis.__ripComponent.__gateBind;

  let constructedWith;
  let failConstructed = false;
  let calls = 0;
  class Page extends C {
    static __gates = ['user'];
    _init() { this.user = gb(this, 'user'); constructedWith = this.user.value; }
    _create() { return null; }
  }
  class FailPage extends C {
    static __gates = ['bad'];
    _init() { this.bad = gb(this, 'bad'); failConstructed = true; }
    _create() { return null; }
  }
  class PlainGate extends C {
    static __gates = ['plain'];
    _init() { this.plain = gb(this, 'plain'); }
    _create() { return null; }
  }

  const components = globalThis.createComponents();
  components.write('_route/index.rip', 'stub');
  components.setCompiled('_route/index.rip', { Page });
  components.write('_route/fail.rip', 'stub');
  components.setCompiled('_route/fail.rip', { FailPage });
  components.write('_route/plain.rip', 'stub');
  components.setCompiled('_route/plain.rip', { PlainGate });

  const app = { data: globalThis.createStash({
    plain: { x: 1 },
    user: globalThis.source({ fetch: async () => { calls++; await sleep(10); return { name: 'Ada' }; } }),
    bad:  globalThis.source({ fetch: async () => { const e = new Error('boom'); e.status = 503; throw e; } }),
  }) };

  const errors = [];
  const routeSig = globalThis.__rip.__state(null);
  const router = {
    get current() { return routeSig.value ?? { route: null }; },
    navigating: false,
    init() {},
    match: () => null,
    ownsAnchor: () => false,
  };
  const renderer = globalThis.createRenderer({
    router, app, components, resolver: {}, compile: (s) => s, target: makeEl(),
    onError: (e) => errors.push(e),
  });
  renderer.start();

  // 1. healthy gate: construction waits for the load; binding is non-null
  routeSig.value = { path: '/', params: {}, route: { file: '_route/index.rip', pattern: '/' }, layouts: [], query: {}, hash: '' };
  await sleep(5);
  if (constructedWith !== undefined) throw new Error('component must not construct before its gate resolves');
  await sleep(30);
  if (!constructedWith || constructedWith.name !== 'Ada') throw new Error('gated binding must be non-null at construction: ' + JSON.stringify(constructedWith));
  if (calls !== 1) throw new Error('gate must load exactly once: ' + calls);

  // 2. failing gate: page never constructs; structured error reaches onError
  routeSig.value = { path: '/fail', params: {}, route: { file: '_route/fail.rip', pattern: '/fail' }, layouts: [], query: {}, hash: '' };
  await sleep(30);
  if (failConstructed) throw new Error('a component whose gate failed must never construct');
  const ge = errors.find((e) => e.path === 'bad');
  if (!ge) throw new Error('gate failure must reach onError with its path: ' + JSON.stringify(errors));
  if (ge.status !== 503 || ge.message !== 'boom') throw new Error('gate failure must carry status/message: ' + JSON.stringify(ge));

  // 3. gate on a non-source key: deterministic dev-time error at mount
  routeSig.value = { path: '/plain', params: {}, route: { file: '_route/plain.rip', pattern: '/plain' }, layouts: [], query: {}, hash: '' };
  await sleep(20);
  const pe = errors.find((e) => /does not resolve to a source/.test(e.message || ''));
  if (!pe) throw new Error('non-source gate path must be a mount-time error: ' + JSON.stringify(errors));

  renderer.stop();
});

Promise.all(asyncChecks).then(() => {
  process.stdout.write('\\u0001RESULTS\\u0001' + JSON.stringify(results) + '\\u0001RESULTS\\u0001');
});
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
      json: async () => ({ modules: { '_route/foo.rip': FAKE_SOURCE } }),
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
    const src = store.read('_route/foo.rip');
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
