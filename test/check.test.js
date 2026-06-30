#!/usr/bin/env bun
/**
 * Checker regression pins — `rip check` end-to-end.
 *
 * One section per fixed bug, append-only. These are NOT feature-coverage
 * tests: the curated type audit (test/types/) documents designed behavior
 * and is considered complete; bug pins land here instead, where a case is
 * a few lines with no .ts parity companion.
 *
 * Each case writes a tiny project into a temp dir (strict mode, checkAll)
 * and runs `rip check` over it — the integration point where codegen, the
 * dts emitter, and typecheck.js's merge passes all meet, which is where
 * these bugs lived.
 */

import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const rip = resolve(root, 'bin', 'rip');
// The shipped ambient ARIA contract — single source for the `ARIA.` global,
// pulled in by consumers via `package.json#rip.types`. The ARIA section below
// references it the same way a real project would (an explicit `.d.ts` include).
const ariaDts = resolve(root, 'packages', 'app', 'aria.d.ts');
// Scope the temp root to this process so two concurrent runs (e.g. a second
// `bun test/check.test.js`) never share per-id dirs or wipe each other's.
const tmpRoot = resolve(__dirname, '_check_tmp', String(process.pid));

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s);
let passed = 0, failed = 0;

// Each check spawns its own `rip check` subprocess in its own temp dir — they
// are fully independent. The cost is per-process startup (compiler load + TS
// program init), not the tiny check itself, so running them serially wastes it.
// We queue the checks and drain the queue with bounded concurrency below.
const tasks = [];
function check(name, fn) { tasks.push({ name, fn }); }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

// A private temp dir per checkProject call, so concurrent runs never collide.
// The id is taken synchronously at call time (Node is single-threaded), so each
// call owns its directory before any await.
let projectId = 0;

// Write the given files into a fresh private temp dir and run `rip check .`.
// File names may contain subdirectories ('app/stash.rip').
// `ripConfig` overrides/extends the default `rip` config (e.g. { exclude: [...] }).
function checkProject(files, ripConfig = {}) {
  const dir = resolve(tmpRoot, String(projectId++));
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ripCfg = { strict: true, checkAll: true, ...ripConfig };
  writeFileSync(resolve(dir, 'package.json'),
    JSON.stringify({ rip: ripCfg, dependencies: { '@rip-lang/app': 'workspace:*' } }) + '\n');
  for (const [name, src] of Object.entries(files)) {
    const dest = resolve(dir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, src);
  }
  return new Promise(res => {
    execFile(rip, ['check', '.'], { cwd: dir }, (err, stdout, stderr) => {
      if (err) res({ ok: false, out: (stdout || '') + (stderr || '') });
      else res({ ok: true, out: '' });
    });
  });
}

// ── 1. Inline `schema :shape` as `.extend()` argument carries its type ──
//
// An anonymous expression-position schema used to resolve to the
// `__schema(d: any): any` fallback overload, so `extend<U>` inferred
// nothing and the derived type silently lost every extended field.
// Fixed: codegen stamps a shadow-only `__anon` key on the descriptor and
// the dts pass emits a keyed overload (SCHEMA-GAPS.md gap 14).

check('inline-extend fields survive into the derived type', async () => {
  const r = await checkProject({
    'ex.rip': `export User = schema :shape
  name!  string

export Admin = User.extend (schema :shape
  permissions! string[])

a = Admin.parse({})
ok = a.permissions.length + a.name.length
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('a bogus property on the extended type still errors', async () => {
  const r = await checkProject({
    'ex.rip': `export Base = schema :shape
  title! string

export Extended = Base.extend (schema :shape
  count! integer)

b = Extended.parse({})
bad = b.bogus
`,
  });
  assert(!r.ok, 'expected a type error on b.bogus');
  assert(/bogus/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 2. A typed local must not leak its annotation onto same-named locals ──
//
// `items: OrderItem[]` in one function used to stamp `: OrderItem[]` onto
// every same-named hoist in the file: dts emitted a header `let` line for
// the function-local, and typecheck.js's inline-let merge applies header
// types to body hoists by NAME. Fixed: function-locals no longer emit the
// header line (the in-body typed hoist already covers them, scope-correctly).

check('sibling functions with one typed local check independently', async () => {
  const r = await checkProject({
    'scope.rip': `f = ->
  items = [1, 2]
  items.length

g = ->
  items: string[] = []
  items.push('x')
  items.length
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check("the untyped sibling keeps its own inferred type, not the annotation", async () => {
  const r = await checkProject({
    'scope.rip': `f = ->
  items = [1, 2]
  items.push('nope')
  items.length

g = ->
  items: string[] = []
  items.length
`,
  });
  assert(!r.ok, "expected an error: f's items is number[], 'nope' is a string");
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 3. Render-block conditionals narrow nullable state ──
//
// The shadow used to emit a render `if` as a bare condition statement with
// both branches flattened as unguarded siblings, so `if order then
// order.total` failed strict checking against `T | null`. Fixed: walkRender
// emits real `if (...) { } else { }` blocks (mirroring its for-loop case).

check('reads in the guarded render branch narrow to non-null', async () => {
  const r = await checkProject({
    'dash.rip': `type Order = { id: number, total: number }

export Dash = component
  order: Order | null := null

  render
    if order
      h1 "Order ##{order.id}"
      p "$#{order.total.toFixed(2)}"
    else
      p "loading"
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('reads in the else branch still see the null', async () => {
  const r = await checkProject({
    'dash.rip': `type Order = { id: number, total: number }

export Dash = component
  order: Order | null := null

  render
    if order
      p "ok"
    else
      p "#{order.id}"
`,
  });
  assert(!r.ok, 'expected TS2531 in the else branch');
  assert(/possibly 'null'/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── 4. Render-ready state: gates narrow, ungated reads stay honest ──
//
// `x <~ @app.data.x` stubs as `__computed(() => __ripGate(...))` — the
// generic non-null narrow, sound because the renderer loads the source
// before construction. Ungated reads keep the source's declared
// `T | null`, and the StashMethods intersection types reset()/source().

const SOURCE_STASH = `import { source } from '@rip-lang/app'

export stash =
  cart: { items: [] }
  user: source { fetch: -> Promise.resolve({ firstName: 'Ada', lastName: 'Lovelace' }) }
  order: source { fetch: (id: string) -> Promise.resolve({ id: id, total: 42 }) }
`;

check('gated binding is non-null at every read site', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'profile.rip': `export Profile = component
  user <~ @app.data.user
  form := { ...user }
  render
    h1 "#{user.firstName} #{user.lastName}"
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('ungated source read stays T | null — unguarded access errors', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'nav.rip': `export Nav = component
  user ~= @app.data.user
  render
    h1 user.firstName
`,
  });
  assert(!r.ok, 'expected a nullability error on the ungated read');
  assert(/possibly 'null'/.test(r.out), 'unexpected output:\n' + r.out);
});

check('keyed gate narrows; ungated keyed read stays nullable', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'detail.rip': `export Detail = component
  order <~ @app.data.order(params.id)
  render
    p "total: #{order.total}"
`,
  });
  assert(r.ok, 'expected clean check on the keyed gate, got:\n' + r.out);

  const r2 = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'detail.rip': `export Detail = component
  o ~= @app.data.order('x')
  render
    p "#{o.total}"
`,
  });
  assert(!r2.ok, 'expected a nullability error on the ungated keyed read');
  assert(/possibly 'null'/.test(r2.out), 'unexpected output:\n' + r2.out);
});

check('stash methods are typed: reset() and the source() handle', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'tools.rip': `export Tools = component
  stats := @app.data.source('user')
  signout: -> @app.data.reset()
  render
    if stats.loading
      p "loading"
    else if stats.value
      p stats.value.firstName
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

// ── 5. Gating a plain key is a compile error, not just a mount error ──
//
// The renderer rejects a `<~` on a non-source path deterministically at
// mount; `rip check` mirrors it statically by classifying the stash
// literal's keys (chasing module-level bindings). Conservative: values
// whose source-ness isn't visible (imports, factory calls, spreads) stay
// silent — the mount check backstops those.

check('gating a plain key errors at check time (module-binding indirection)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

orders: number[] = []

export stash =
  orders: orders
  user: source { fetch: -> Promise.resolve({ name: 'Ada' }) }
`,
    'orders.rip': `export Orders = component
  orders <~ @app.data.orders
  render
    p "#{orders.length}"
`,
  });
  assert(!r.ok, 'expected a gate-on-plain-key error');
  assert(/'orders <~' does not resolve to a source/.test(r.out), 'unexpected output:\n' + r.out);
});

check('gating a nullable plain key errors too (the silent-null case)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  selected: null
  user: source { fetch: -> Promise.resolve({ name: 'Ada' }) }
`,
    'sel.rip': `export Sel = component
  selected <~ @app.data.selected
  render null
`,
  });
  assert(!r.ok, 'expected a gate-on-nullable-plain-key error');
  assert(/'selected <~' does not resolve to a source/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a gate on a missing key errors; sources via binding or subpath stay clean', async () => {
  const missing = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> Promise.resolve({ name: 'Ada' }) }
`,
    'c.rip': `export C = component
  stats <~ @app.data.stats
  render null
`,
  });
  assert(!missing.ok, 'expected a missing-key error');
  assert(/'stats <~' does not resolve to a source.*not a key/.test(missing.out), 'unexpected output:\n' + missing.out);

  const clean = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

userSource = source { fetch: -> Promise.resolve({ name: 'Ada' }) }

export stash =
  user: userSource
  settings: { theme: source { fetch: -> Promise.resolve({ dark: true }) } }
`,
    'c.rip': `export C = component
  user <~ @app.data.user
  theme <~ @app.data.settings.theme
  render null
`,
  });
  assert(clean.ok, 'binding indirection and subpath gates should pass: ' + clean.out);
});

// ── source() is non-null and async by contract (`T extends NonNullSourceValue`) ──
//
// A render-ready gate narrows `T | null` to `T`; that narrowing is only
// honest if a source can never RESOLVE to null. The constraint enforces it
// at the declaration: a fetch that can return null/undefined — or forgets
// to return — is a compile error, caught at the source, not deep in a
// component dereferencing a "non-null" null.

check('a source whose fetch can resolve to null errors at the declaration', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> if true then Promise.resolve({ name: 'Ada' }) else Promise.resolve(null) }
`,
  });
  assert(!r.ok, 'expected a non-null-source constraint error');
  assert(/Type 'null' is not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a source whose fetch resolves to undefined (no value) errors at the declaration', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> Promise.resolve(undefined) }
`,
  });
  assert(!r.ok, 'expected a void-fetch constraint error');
  assert(/Type 'undefined' is not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a source with a non-null fetch passes (constraint does not over-fire)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> Promise.resolve({ name: 'Ada' }) }
  orders: source { fetch: -> Promise.resolve([1, 2, 3]) }
`,
    'c.rip': `export C = component
  user <~ @app.data.user
  render
    p "#{user.name}"
`,
  });
  assert(r.ok, 'expected a clean check, got:\n' + r.out);
});

// A forgotten return is the trap case: an async fetch with no return is
// `Promise<void>`. Because a source `fetch` must return `Promise<T>` with `T`
// non-null, `void` fails the constraint — so the error lands at the
// DECLARATION, at the fetch, not later at the consumer (where TS's `void`
// leniency would otherwise only surface it as `{}`).
check('a fetch that forgets to return errors at the declaration (async no-return)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source
    fetch: ->
      x = await Promise.resolve({ name: 'Ada' })
      if not x then throw new Error('no')
`,
  });
  assert(!r.ok, 'a forgotten return must be caught');
  assert(/stash\.rip/.test(r.out), 'error should surface at the declaration:\n' + r.out);
  assert(/not assignable/.test(r.out) && /NonNullSourceValue/.test(r.out), 'should cite the named non-null fetch contract:\n' + r.out);
});

// A source is async by contract — `fetch` must return a `Promise`. A
// synchronous fetch (returning a value directly) is a type error, so static
// non-null data isn't smuggled in as a source; it belongs in a plain stash key.
check('a synchronous (non-Promise) fetch is rejected — a source must be async', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> { name: 'Ada' } }
`,
  });
  assert(!r.ok, 'a sync fetch must be a type error (fetch must return a Promise)');
  assert(/stash\.rip/.test(r.out), 'error should surface at the declaration:\n' + r.out);
});

// An inline @event handler's first param is explicitly annotated with the
// event type (matching __RipEvents), rather than left to TS contextual typing
// through __ripEl's generic props — which silently drops the param to `any`
// for certain sibling-prop combinations. The handler must type-check cleanly
// regardless of surrounding props, and the param must be genuinely typed.
check('an inline @event handler types its param, robust to sibling props', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `import { createMutation } from '@rip-lang/app'

export C = component
  send = createMutation (-> Promise.resolve({ n: 1 }))
  render
    form @submit: ((e) -> e.preventDefault(); send()), noValidate: true, class: "x"
      div "a"
`,
  });
  assert(r.ok, 'inline handler with sibling props should check clean: ' + r.out);
});

// Scope-based bare-identifier disambiguation reaches the type-check (stub)
// path too. A bare identifier that resolves to nothing is boolean-attribute
// shorthand (`form noValidate`), NOT a reference — so it must not surface as
// "Cannot find name". A bare identifier that resolves to an in-scope value is
// still emitted as a reference, so a genuine value typo is still caught.
check('an unresolved bare-ident attribute (form noValidate) checks clean', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export C = component
  render
    form noValidate, class: "x"
      div "a"
`,
  });
  assert(r.ok, 'a bare-ident boolean attribute must not error as an undefined name: ' + r.out);
});

check('a bare-ident text child that IS in scope still type-checks (loop var)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export C = component
  items := ['a', 'b']
  render
    for item in items
      li item
`,
  });
  assert(r.ok, 'an in-scope loop var rendered as a text child should check clean: ' + r.out);
});

check('an unresolved bare-ident flag on a component checks clean (Btn disabled)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Btn = component
  render
    button
      slot

export C = component
  render
    Btn
      disabled
      "Save"
`,
  });
  assert(r.ok, 'a bare-ident boolean flag on a component must not error as a missing element: ' + r.out);
});

check('an inline @event handler param is genuinely typed (a bogus member errors)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export C = component
  render
    form @submit: ((e) -> e.preventDefaultz())
      div "a"
`,
  });
  assert(!r.ok, 'a bogus member on the typed event must error (param is not any)');
  assert(/preventDefaultz/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── A required prop is satisfiable by a `<=>` two-way binding ──
//
// `mode <=> mode` compiles to the mangled `__bind_mode__: <signal>`, so a
// REQUIRED public prop bound this way used to report TS2741 ("Property 'mode'
// is missing") — the binding only supplied `__bind_mode__`, never the bare
// required `mode`. Fixed: the constructor types each required prop as a union
// of { value } | { __bind_value__ }, so either form satisfies it. Optional
// props never hit this (nothing to leave missing).

check('a required prop bound with <=> checks clean (binding satisfies it)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  mode: 'a' | 'b' := 'a'
  render
    Child mode <=> mode

Child = component
  @mode: 'a' | 'b'
  render
    p "#{mode}"
`,
  });
  assert(r.ok, 'a required prop bound via <=> should check clean: ' + r.out);
});

check('a required prop passed by direct value still checks clean', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  render
    Child mode: 'a'

Child = component
  @mode: 'a' | 'b'
  render
    p "#{mode}"
`,
  });
  assert(r.ok, 'a required prop passed directly should check clean: ' + r.out);
});

check('omitting a required prop entirely still errors', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  render
    Child config: 'x'

Child = component
  @config: string
  @mode: 'a' | 'b'
  render
    p "#{mode}"
`,
  });
  assert(!r.ok, 'omitting a required prop must still error');
  assert(/mode/.test(r.out), 'error should name the missing prop:\n' + r.out);
});

// ── A prop-less component used as a child has no required props ──
//
// A component declaring no props emits `constructor(props?: {});` — an inline,
// empty object type. The DTS parser used to see the `{`, enter multi-line
// mode, and read the class's own reactive members (`term: Signal<any>;` …) as
// required props, so every call site errored `Missing required prop 'term'`.
// Worse, the runaway reader never found a `});` close and swallowed the next
// class too. Fixed: an inline `{ … }`/`{}` on the constructor line is the
// complete prop list — parse it inline, don't fall through to class members.

check('a prop-less child component has no phantom required props', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  render
    Picker
    Sibling label: 'x'

Picker = component
  term := ''
  results := []
  render
    p "#{term}"

Sibling = component
  @label: string
  render
    p "#{label}"
`,
  });
  assert(r.ok, 'a prop-less child must not require its reactive members as props: ' + r.out);
});

check('a prop-less component does not corrupt a following component def', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  render
    Picker
    Sibling label: 5

Picker = component
  term := ''
  render
    p "#{term}"

Sibling = component
  @label: string
  render
    p "#{label}"
`,
  });
  assert(!r.ok, 'Sibling defined after a prop-less component must still type-check its props');
  assert(/label/.test(r.out), 'error should name the mistyped prop:\n' + r.out);
});

check('a non-exported prop-less component still rejects unknown props', async () => {
  // `Picker` is non-exported (`declare class`, not `export declare class`) and
  // declares no props. It must still land in the component registry so its
  // usage sites are prop-checked — passing it `bogus` is an error, not silently
  // accepted.
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export Parent = component
  render
    Picker bogus: 99

Picker = component
  term := ''
  render
    p "#{term}"
`,
  });
  assert(!r.ok, 'passing an unknown prop to a prop-less component must error: ' + r.out);
  assert(/bogus/.test(r.out), 'error should name the unknown prop:\n' + r.out);
});

check('opaque stash values stay silent (the mount check backstops them)', async () => {
  const r = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'
import { makeThing } from './factory.rip'

export stash =
  thing: makeThing()
  user: source { fetch: -> Promise.resolve({ name: 'Ada' }) }
`,
    'app/factory.rip': `export makeThing = -> null\n`,
    'c.rip': `export C = component
  thing <~ @app.data.thing
  render
    p "#{thing}"
`,
  });
  assert(r.ok, 'opaque values must not produce gate errors: ' + r.out);
});

// ── 6. staleTime duration strings are template-literal typed ──
//
// `staleTime?: Duration | symbol` where Duration is number |
// `${number}${Unit}` | `${number} ${Unit}` — so '5 min' checks clean and
// typos like '5 mins' (which would otherwise parseInt to 5ms) error at
// the declaration site. Also pins backtick template-literal types
// surviving the type emitter (buildTypeString re-wraps JS tokens).

check("staleTime '5 min' checks clean; '5 mins' is a type error", async () => {
  const good = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: '5 min' }
`,
  });
  assert(good.ok, "'5 min' should be a valid Duration: " + good.out);

  const bad = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: '5 mins' }
`,
  });
  assert(!bad.ok, "'5 mins' should be rejected by the Duration type");
  assert(/5 mins/.test(bad.out), 'unexpected output:\n' + bad.out);
});

check("staleTime 'forever' checks clean; symbols and near-misses are type errors", async () => {
  const good = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: 'forever' }
`,
  });
  assert(good.ok, "'forever' should type-check: " + good.out);

  const sym = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: :forever }
`,
  });
  assert(!sym.ok, 'the :forever symbol should be rejected — the keyword is a string');

  const typo = await checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: 'foreverz' }
`,
  });
  assert(!typo.ok, "'foreverz' should be rejected");
  assert(/foreverz/.test(typo.out), 'unexpected output:\n' + typo.out);
});

// ── 7. User-defined onError gets the canonical param type ──
//
// The typed optional onError declaration is only emitted when the user
// does NOT define the hook, so a user-defined `onError: (err) ->` had no
// signature to inherit and errored as an implicit any in strict mode.
// The stub now injects the canonical payload type for an unannotated
// single param.

check('untyped onError param checks clean and is typed, not any', async () => {
  const r = await checkProject({
    'comp.rip': `export Layout = component
  msg: string | null := null
  onError: (err) -> msg = err.message ?? 'unknown'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const misuse = await checkProject({
    'comp.rip': `export Layout = component
  msg: string | null := null
  onError: (err) -> msg = err.bogus
  render null
`,
  });
  assert(!misuse.ok, 'err should carry the structured type, not any');
  assert(/bogus/.test(misuse.out), 'unexpected output:\n' + misuse.out);
});

// ── 8. `?` widens a member with an explicit `:= undefined` initializer ──
//
// `x?: string := undefined` used to declare Signal<string> but initialize
// it with undefined — an immediate TS2322. The `?` marker now widens the
// payload to `| undefined` when the initializer is the undefined literal,
// matching the no-initializer prop case (`@label?: T`). A `?` with a real
// default stays unwidened (the default fills the gap).

check("x?: T := undefined declares Signal<T | undefined>; use still narrows", async () => {
  const r = await checkProject({
    'comp.rip': `export C = component
  gateError?: string := undefined
  msg ~= gateError ?? 'ok'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const unguarded = await checkProject({
    'comp.rip': `export C = component
  gateError?: string := undefined
  bad ~= gateError.length
  render null
`,
  });
  assert(!unguarded.ok, 'unguarded use must require narrowing');
  assert(/possibly 'undefined'/.test(unguarded.out), 'unexpected output:\n' + unguarded.out);
});

// ── 9. `query` is typed as the Record the router actually hands components ──
//
// Component stubs used to declare query: URLSearchParams, but the router
// passes a plain Record<string, string> (Object.fromEntries over the params).
// The honest type catches URLSearchParams-only calls like query.get(...) that
// would crash at runtime, and lets keyed gates read query fields directly.

check("query is Record<string, string>; URLSearchParams calls error", async () => {
  const ok = await checkProject({
    'comp.rip': `export C = component
  sort ~= @query.sort ?? 'asc'
  render null
`,
  });
  assert(ok.ok, 'plain query field access should check clean, got:\n' + ok.out);

  const bad = await checkProject({
    'comp.rip': `export C = component
  sort ~= @query.get('sort')
  render null
`,
  });
  // query is a Record<string, string>: its index signature makes `.get` a
  // string, so calling it fails as "not callable" — proving query is not the
  // URLSearchParams the stub used to claim (where `.get('sort')` was valid).
  assert(!bad.ok, 'query.get(...) must error — query is not URLSearchParams');
  assert(/not callable|no call signatures/.test(bad.out), 'unexpected output:\n' + bad.out);
});

// ── 10. `href:` on a component is route-checked like intrinsic `<a href>` ──
//
// A component that forwards href to an anchor (`component extends a`) exposes
// it via `@rest` typed as plain `string`, so `Btn href: "/typo"` used to escape
// route validation entirely — the typo only surfaced at runtime. Codegen now
// wraps slash-prefixed href literals on component calls in `__ripRoute(...)`,
// the same helper intrinsic anchors use, so invalid routes error at the call
// site while external URLs and variables pass through.

// Shared project: a NavLink that extends `a`, plus an `/orders` route so the
// generated `__RipRoutes` union is `"/" | "/orders"`.
const routeProject = (homeBody) => ({
  'index.rip': `x = 1\n`,
  'app/stash.rip': `stash =\n  count: 0\n`,
  'app/components/link.rip': `export NavLink = component extends a
  @outline?: boolean

  render
    a
      role: "button"
      class: @outline and 'outline'
      slot
`,
  'app/routes/orders.rip': `export Orders = component\n  render null\n`,
  'app/routes/index.rip': `import { NavLink } from '../components/link.rip'

export Home = component
  render
${homeBody}
`,
});

check('a bogus route in a component href errors at the call site', async () => {
  const r = await checkProject(routeProject('    NavLink href: "/nope", "Broken"'));
  assert(!r.ok, 'expected a route error on NavLink href: "/nope"');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
  assert(/"\/nope"/.test(r.out), 'error should name the bad href:\n' + r.out);
});

check('valid routes, external URLs, and variables in component href pass', async () => {
  const r = await checkProject(routeProject(
    `    NavLink href: "/", "Home"
    NavLink href: "/orders", "Orders"
    NavLink href: "https://example.com", "External"`));
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

// ── 11. router.push / router.replace are route-checked like href ──
//
// All three nav surfaces share one rule: a slash-prefixed string LITERAL must be
// a known route (typos error, with a clean route-list message); dynamic strings
// fall through and pass. Build query/hash URLs as `string` values, not literals.
const routerBodyProject = (body) => ({
  'index.rip': `x = 1\n`,
  'app/stash.rip': `stash =\n  count: 0\n`,
  'app/routes/orders.rip': `export Orders = component\n  render null\n`,
  'app/routes/index.rip': `export Home = component\n${body}\n  render\n    div\n`,
});

check('router.replace: a valid route passes; a path typo errors', async () => {
  let r = await checkProject(routerBodyProject(`  mounted: -> @router.replace('/orders')`));
  assert(r.ok, 'valid route replace should pass:\n' + r.out);
  r = await checkProject(routerBodyProject(`  mounted: -> @router.replace('/nope')`));
  assert(!r.ok, 'a path typo in replace should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('router.replace / push: a dynamic (non-literal) string passes', async () => {
  let r = await checkProject(routerBodyProject(`  url: string := '/whatever'\n  mounted: -> @router.replace(url)`));
  assert(r.ok, 'dynamic string replace should pass:\n' + r.out);
  r = await checkProject(routerBodyProject(`  url: string := '/whatever'\n  mounted: -> @router.push(url)`));
  assert(r.ok, 'dynamic string push should pass:\n' + r.out);
});

check('router.push: a valid route passes; a path typo errors', async () => {
  let r = await checkProject(routerBodyProject(`  mounted: -> @router.push('/orders')`));
  assert(r.ok, 'valid route push should pass:\n' + r.out);
  r = await checkProject(routerBodyProject(`  mounted: -> @router.push('/nope')`));
  assert(!r.ok, 'a push typo should error');
});

// ── 12. `RoutePath` ambient type exposes the route union to app code ──
//
// Data-driven hrefs (a nav array threaded through a component) lose the
// automatic literal `<a href>` check, so app code needs to name the route
// union. `RoutePath` is injected ambiently into any app file that references
// it — same union the href/push checks use — so a typo or a non-existent
// route errors at the annotation, with no import or `__RipRoutes` leak.
const routePathProject = (body) => ({
  'index.rip': `x = 1\n`,
  'app/stash.rip': `stash =\n  count: 0\n`,
  'app/routes/orders.rip': `export Orders = component\n  render null\n`,
  'app/routes/index.rip': `${body}\n\nexport Home = component\n  render\n    div\n`,
});

check('RoutePath: a valid route literal passes', async () => {
  const r = await checkProject(routePathProject(`home: RoutePath = '/orders'`));
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('RoutePath: a bogus route literal errors', async () => {
  const r = await checkProject(routePathProject(`home: RoutePath = '/nope'`));
  assert(!r.ok, 'expected a route error on RoutePath = "/nope"');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('RoutePath: a file-local declaration wins (no duplicate-identifier clash)', async () => {
  const r = await checkProject(routePathProject(`type RoutePath = 'custom'\n\nval: RoutePath = 'custom'`));
  assert(r.ok, 'a user-defined RoutePath should win cleanly:\n' + r.out);
});

// ── Single-quoted string literals are valid prop defaults ──
//
// validatePropDefault only recognized double-quoted literals (/^"[^"]*"$/),
// so a single-quoted default like `@value?: string := ''` was reported as
// `Type '''' is not assignable to type 'string'` — a false positive, since
// '' and "" are the same empty string in Rip. String-literal unions escaped
// it only by accident (their single-quoted members also failed the regex, so
// the whole branch was skipped). Fixed: accept either quote style, and
// compare union membership by inner content.

check('single-quoted string prop defaults pass', async () => {
  const r = await checkProject({
    'c.rip': `export Input = component extends input
  @value?: string := ''
  @label?: string := 'hi'
  render
    input
`,
  });
  assert(r.ok, 'single-quoted string defaults should pass:\n' + r.out);
});

check('single-quoted defaults in a string-literal union pass; a non-member errors', async () => {
  let r = await checkProject({
    'c.rip': `export Button = component extends button
  @variant?: 'primary' | 'secondary' := 'primary'
  render
    button
`,
  });
  assert(r.ok, 'single-quoted union default should pass:\n' + r.out);
  r = await checkProject({
    'c.rip': `export Button = component extends button
  @variant?: 'primary' | 'secondary' := 'tertiary'
  render
    button
`,
  });
  assert(!r.ok, 'a default outside the union should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a genuinely mismatched default still errors (string default on number)', async () => {
  const r = await checkProject({
    'c.rip': `export Box = component extends div
  @count?: number := 'oops'
  render
    div
`,
  });
  assert(!r.ok, 'a string default on a number prop should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── Only literal defaults are validated; non-literals are left to the checker ──
//
// validatePropDefault judges a default by its literal kind (string/number/
// boolean). A default that is an identifier, call, or other expression has no
// statically known type here, so it must NOT be flagged — flagging it was a
// false positive on valid code. A literal of the wrong kind is still caught.

check('a non-literal default (identifier/expression) is not flagged', async () => {
  const r = await checkProject({
    'c.rip': `DEFAULT_COUNT = 5
export Box = component extends div
  @count?: number := DEFAULT_COUNT
  @label?: string := DEFAULT_COUNT.toString()
  render
    div
`,
  });
  assert(r.ok, 'a non-literal prop default must not be flagged:\n' + r.out);
});

// ── A '#' inside a string default is not mistaken for a trailing comment ──
//
// The default-value comment strip used to cut at the first '#', mangling a CSS
// color / fragment URL into an unterminated literal and reporting a bogus type
// error. A '#' inside quotes is part of the value; only a '#' outside a string
// starts a comment.

check("a '#' inside a string default is kept (CSS color checks clean)", async () => {
  const r = await checkProject({
    'c.rip': `export Box = component extends div
  @bg?: string := '#fff'  # the background color
  render
    div
`,
  });
  assert(r.ok, "a '#' inside a quoted default must not be treated as a comment:\n" + r.out);

  // The literal kind is still recognized after the strip, so a genuine mismatch
  // (a string literal on a number prop) is caught — with the value intact.
  const bad = await checkProject({
    'c.rip': `export Box = component extends div
  @hex?: number := '#fff'
  render
    div
`,
  });
  assert(!bad.ok, "a string default on a number prop should still error");
  assert(/'#fff'/.test(bad.out), 'the offending value should appear intact:\n' + bad.out);
});

// ── globToRegex escapes regex metacharacters in exclude patterns ──
//
// globToRegex only escaped `.`, leaving `[ ] ( ) { } + ^ $ |` raw. That
// silently broke excludes for Rip's own route-dir syntax: `[id]/**` compiled
// to a char class, so `app/routes/[id]/x.rip` never matched and the file was
// type-checked despite being excluded. Fixed: escape the full metacharacter
// set. The error file below would fail `rip check` if the exclude were a no-op.

check('exclude patterns with route-dir brackets/parens are honored', async () => {
  const files = {
    'app/routes/index.rip': `export Home = component\n  render\n    div\n`,
    'app/routes/[id]/x.rip': `bad: number := 'oops'\n`,
    'app/routes/(app)/y.rip': `bad: number := 'oops'\n`,
  };
  // Sanity: without the exclude, the bracketed files' errors surface.
  let r = await checkProject(files);
  assert(!r.ok, 'the deliberate errors should surface when not excluded');
  // With the exclude, both bracketed dirs are skipped → clean.
  r = await checkProject(files, { exclude: ['app/routes/[id]/**', 'app/routes/(app)/**'] });
  assert(r.ok, 'excluded route-dir files should be skipped:\n' + r.out);
});

// ── 13. The ambient `ARIA` global is typed (aria.d.ts ↔ AriaApi) ──
//
// The `ARIA.` global contract ships as `packages/app/aria.d.ts`, advertised by
// `@rip-lang/app`'s `package.json#rip.ambient`. A project gets it two ways:
// automatically (just by depending on `@rip-lang/app` — mechanism ②, the
// zero-config path) or explicitly via `package.json#rip.types` (mechanism ①, the
// escape hatch). Either way `rip check` loads that `.d.ts` as an explicit program
// root so `declare const ARIA: { ... }` is visible to every `.rip` file. That
// decl is the consumer-facing twin of `AriaApi` in packages/app/index.rip (the
// impl contract). These pins guard the pairing: good usage checks clean, and the
// strict signatures (literal orientation, `char(key: string)`, `hasAnchor()` as
// a method, no index-signature escape hatch) reject misuse. If either side
// drifts, one of these flips. The textual AriaApi ↔ aria.d.ts drift guard lives
// in section 15 below. (These cases pass `{ types: [ariaDts] }` explicitly so
// they exercise mechanism ① directly; mechanism ② is covered by its own pins.)

check('typed ARIA usage checks clean against the ambient include', async () => {
  const r = await checkProject({
    'aria.rip': `export demo = (el: HTMLElement): boolean ->
  ARIA.listNav new KeyboardEvent('keydown'), { next: (->), char: ((k: string) -> undefined) }
  ARIA.rovingNav new KeyboardEvent('keydown'), {}, 'both'
  d = ARIA.popupDismiss true, el, (->), [el], null
  ARIA.combine(d, (->))()
  g = ARIA.popupGuard 200
  g.block 100
  g.canOpen() and ARIA.hasAnchor()
`,
  }, { types: [ariaDts] });
  assert(r.ok, 'typed ARIA usage should check clean against the ambient include:\n' + r.out);
});

check('a bad ARIA orientation literal errors', async () => {
  const r = await checkProject({
    'aria.rip': `bad = (el: HTMLElement) ->
  ARIA.rovingNav new KeyboardEvent('keydown'), {}, 'diagonal'
`,
  }, { types: [ariaDts] });
  assert(!r.ok, "'diagonal' is not a valid orientation");
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check("an ARIA char handler's key is a string, not a number", async () => {
  const r = await checkProject({
    'aria.rip': `bad = (el: HTMLElement) ->
  ARIA.listNav new KeyboardEvent('keydown'), { char: ((k: number) -> undefined) }
`,
  }, { types: [ariaDts] });
  assert(!r.ok, 'char receives a string key, so a number param should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('an unknown ARIA method errors (no index-signature escape hatch)', async () => {
  const r = await checkProject({
    'aria.rip': `bad = (el: HTMLElement) ->
  ARIA.bogusMethod()
`,
  }, { types: [ariaDts] });
  assert(!r.ok, 'an unknown ARIA method must error now that [key: string]: any is gone');
  assert(/bogusMethod/.test(r.out), 'error should name the bogus method:\n' + r.out);
});

// ── 13b. Zero-config auto-include via the @rip-lang/app dependency (②) ──
//
// The default checkProject package.json already declares `@rip-lang/app` as a
// dependency, and `@rip-lang/app` advertises `aria.d.ts` via `rip.ambient`. So
// `ARIA.` is typed with NO `rip.types` line — purely from the dependency. This is
// the "you used the framework, so its types are just there" behavior, and it's
// what lets `@rip-lang/ui` drop its manual `rip.types` while keeping ARIA typing
// (via its `@rip-lang/app` peerDependency).

check('ARIA is auto-included via the @rip-lang/app dependency (zero-config)', async () => {
  const r = await checkProject({
    'aria.rip': `export demo = (el: HTMLElement): boolean ->
  ARIA.rovingNav new KeyboardEvent('keydown'), {}, 'both'
  ARIA.hasAnchor()
`,
  }); // NO rip.types — relies solely on the @rip-lang/app dependency's rip.ambient
  assert(r.ok, 'ARIA should be auto-included via the @rip-lang/app dependency:\n' + r.out);
});

check('auto-included ARIA still enforces its signature (zero-config)', async () => {
  const r = await checkProject({
    'aria.rip': `bad = (el: HTMLElement) ->
  ARIA.rovingNav new KeyboardEvent('keydown'), {}, 'diagonal'
`,
  }); // NO rip.types
  assert(!r.ok, "'diagonal' must error even when ARIA arrives via auto-include");
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// The discoverability trade-off only remains for a project that doesn't depend on
// the package providing the ambient: with no `@rip-lang/app` dependency AND no
// `rip.types`, `ARIA` is simply undeclared. (Custom package.json drops the
// default `@rip-lang/app` dep.)
check('ARIA is undeclared with neither a providing dependency nor rip.types', async () => {
  const r = await checkProject({
    'package.json': JSON.stringify({ name: 'no-deps', rip: { strict: true, checkAll: true } }) + '\n',
    'aria.rip': `bad = (el: HTMLElement) ->
  ARIA.rovingNav new KeyboardEvent('keydown'), {}, 'both'
`,
  });
  assert(!r.ok, 'ARIA must be undeclared with no provider dependency and no rip.types');
  assert(/Cannot find name 'ARIA'|ARIA/.test(r.out), 'error should reference the missing ARIA global:\n' + r.out);
});

// ── 14. The general ambient-include mechanisms (rip.types ① + rip.ambient ②) ──
//
// ① `package.json#rip.types: ["x.d.ts"]` adds hand-written `.d.ts` files as
//    explicit TS program roots, so their global `declare`s reach every `.rip`
//    file (like tsconfig `files`) — the escape hatch.
// ② A declared `@rip-lang/*` dependency that advertises `rip.ambient` in its own
//    package.json has those files auto-included, resolved relative to the
//    dependency's location — the zero-config path.
// This is the seam the ARIA contract rides on. These pins guard the mechanisms
// themselves, independent of ARIA, including dedupe across the two.

// Build a project that depends on a fake `@rip-lang/widget` whose package.json
// advertises an ambient `.d.ts`. `rip.ambient` paths resolve relative to the
// dependency's own directory, so the file lives under its node_modules entry.
function widgetDepFiles(extra = {}) {
  return {
    'node_modules/@rip-lang/widget/package.json':
      JSON.stringify({ name: '@rip-lang/widget', version: '1.0.0', rip: { ambient: ['ambient.d.ts'] } }) + '\n',
    'node_modules/@rip-lang/widget/ambient.d.ts': `declare const WIDGET: { ping(name: string): number };\n`,
    ...extra,
  };
}

check('an ambient .d.ts from a declared @rip-lang/* dependency is auto-included (②)', async () => {
  const r = await checkProject(widgetDepFiles({
    'package.json': JSON.stringify({ name: 'consumer', rip: { strict: true, checkAll: true }, dependencies: { '@rip-lang/widget': '1.0.0' } }) + '\n',
    'use.rip': `export n: number = WIDGET.ping('ok')\n`,
  }));
  assert(r.ok, 'a dependency-declared rip.ambient should be auto-included with no rip.types:\n' + r.out);
});

check('an auto-included dependency ambient still enforces its signature (②)', async () => {
  const r = await checkProject(widgetDepFiles({
    'package.json': JSON.stringify({ name: 'consumer', rip: { strict: true, checkAll: true }, dependencies: { '@rip-lang/widget': '1.0.0' } }) + '\n',
    'use.rip': `export n: number = WIDGET.ping(123)\n`,
  }));
  assert(!r.ok, 'passing a number where the ambient decl wants a string must error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a dependency without rip.ambient contributes nothing (no crash)', async () => {
  const r = await checkProject({
    'node_modules/@rip-lang/widget/package.json': JSON.stringify({ name: '@rip-lang/widget', version: '1.0.0' }) + '\n',
    'package.json': JSON.stringify({ name: 'consumer', rip: { strict: true, checkAll: true }, dependencies: { '@rip-lang/widget': '1.0.0' } }) + '\n',
    'ok.rip': `export n: number = 1 + 2\n`,
  });
  assert(r.ok, 'a dependency with no rip.ambient must not affect the check:\n' + r.out);
});

check('auto-include + explicit rip.types on the same file does not double-include (dedupe)', async () => {
  const r = await checkProject(widgetDepFiles({
    'package.json': JSON.stringify({
      name: 'consumer',
      rip: { strict: true, checkAll: true, types: ['node_modules/@rip-lang/widget/ambient.d.ts'] },
      dependencies: { '@rip-lang/widget': '1.0.0' },
    }) + '\n',
    'use.rip': `export n: number = WIDGET.ping('ok')\n`,
  }));
  assert(r.ok, 'the same file via both auto-include and rip.types must dedupe cleanly:\n' + r.out);
});

// A dependency that declares a rip.ambient file that does not exist is warned and
// skipped, never fatal — the rest of the project still checks.
check('a dependency-declared ambient that is missing is skipped gracefully (②)', async () => {
  const r = await checkProject({
    'node_modules/@rip-lang/widget/package.json': JSON.stringify({ name: '@rip-lang/widget', version: '1.0.0', rip: { ambient: ['nope.d.ts'] } }) + '\n',
    'package.json': JSON.stringify({ name: 'consumer', rip: { strict: true, checkAll: true }, dependencies: { '@rip-lang/widget': '1.0.0' } }) + '\n',
    'ok.rip': `export n: number = 1 + 2\n`,
  });
  assert(r.ok, 'a missing dependency ambient file must not crash the check:\n' + r.out);
});

check('a rip.types ambient .d.ts makes its globals visible to .rip files', async () => {
  const r = await checkProject({
    'ambient.d.ts': `declare const FORTY_TWO: number;\ndeclare function widget(name: string): number;\n`,
    'use.rip': `export n: number = FORTY_TWO + widget('ok')\n`,
  }, { types: ['ambient.d.ts'] });
  assert(r.ok, 'globals from a rip.types include should be visible:\n' + r.out);
});

check('a rip.types ambient global still enforces its signature', async () => {
  const r = await checkProject({
    'ambient.d.ts': `declare function widget(name: string): number;\n`,
    'use.rip': `export n: number = widget(123)\n`,
  }, { types: ['ambient.d.ts'] });
  assert(!r.ok, 'passing a number where the ambient decl wants a string must error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// An explicit root-file `.d.ts` applies its globals even though the program's
// `types` compiler option is set (rip always sets it from the auto-discovered
// `@types/bun`). If the include were funnelled through `types` it would be
// suppressed; as an explicit program root it is not. This is the scoping point
// the design hinges on.
check('a rip.types root-file global applies despite the types option being set', async () => {
  const r = await checkProject({
    'ambient.d.ts': `declare const ONLY_VIA_ROOT_FILE: string;\n`,
    // Bun globals (from @types/bun → the `types` option) AND the root-file global
    // must both resolve in the same file.
    'use.rip': `export ok: string = ONLY_VIA_ROOT_FILE + (typeof Bun)\n`,
  }, { types: ['ambient.d.ts'] });
  assert(r.ok, 'root-file globals must apply even though the types option is set:\n' + r.out);
});

// A missing rip.types path is warned and skipped, not fatal — the rest of the
// project still checks (here: clean).
check('a missing rip.types path is skipped gracefully', async () => {
  const r = await checkProject({
    'ok.rip': `export n: number = 1 + 2\n`,
  }, { types: ['does/not/exist.d.ts'] });
  assert(r.ok, 'a missing rip.types path must not crash the check:\n' + r.out);
});

// ── 15. Textual AriaApi ↔ aria.d.ts drift guard ──
//
// The single source for the ARIA contract is `AriaApi` in packages/app/index.rip
// (impl) and its shipped consumer twin `packages/app/aria.d.ts` (the ambient
// decl). They are written in two syntaxes (Rip type alias vs TS `declare const`)
// and use differently-prefixed helper-type names, but each method's normalized
// signature must match. This guard normalizes both sides and asserts the method
// maps are identical, so adding/removing/retyping a method on one side without
// the other fails here.
check('AriaApi (index.rip) and aria.d.ts do not drift', async () => {
  const { readFileSync } = await import('fs');
  // Map alias names + Rip/TS syntax differences onto one canonical token form.
  const canon = (s) => s
    .replace(/__RipAria/g, '')                                   // d.ts helper prefix
    .replace(/Aria/g, '')                                        // index.rip alias prefix
    .replace(/'vertical'\s*\|\s*'horizontal'\s*\|\s*'both'/g, 'Orientation') // inline literal ↔ alias
    .replace(/\s+/g, '');
  // index.rip: `name: (params) => ret` lines under `export type AriaApi =`.
  const ripSrc = readFileSync(resolve(root, 'packages', 'app', 'index.rip'), 'utf8').split('\n');
  const ripStart = ripSrc.findIndex(l => /^export type AriaApi\s*=\s*$/.test(l));
  assert(ripStart >= 0, 'could not locate `export type AriaApi =` in index.rip');
  const ripMethods = new Map();
  for (let i = ripStart + 1; i < ripSrc.length; i++) {
    const line = ripSrc[i];
    if (!/^\s{2}\S/.test(line)) break; // first non-2-space-indented line ends the block
    const m = line.match(/^\s{2}(\w+):\s*\((.*)\)\s*=>\s*(.+?)\s*$/);
    assert(m, 'unparsed AriaApi line in index.rip: ' + JSON.stringify(line));
    ripMethods.set(m[1], canon(m[2]) + '->' + canon(m[3]));
  }
  // aria.d.ts: `name(params): ret;` lines inside `declare const ARIA: {`.
  const dtsSrc = readFileSync(ariaDts, 'utf8').split('\n');
  const dtsStart = dtsSrc.findIndex(l => /declare const ARIA:\s*\{/.test(l));
  assert(dtsStart >= 0, 'could not locate `declare const ARIA: {` in aria.d.ts');
  const dtsMethods = new Map();
  for (let i = dtsStart + 1; i < dtsSrc.length; i++) {
    const line = dtsSrc[i];
    if (/^\};/.test(line)) break;
    const m = line.match(/^\s{2}(\w+)\((.*)\):\s*(.+?);\s*$/);
    assert(m, 'unparsed ARIA member in aria.d.ts: ' + JSON.stringify(line));
    dtsMethods.set(m[1], canon(m[2]) + '->' + canon(m[3]));
  }
  assert(ripMethods.size > 0 && dtsMethods.size > 0, 'parsed zero ARIA methods');
  // Same method set.
  const ripKeys = [...ripMethods.keys()].sort().join(',');
  const dtsKeys = [...dtsMethods.keys()].sort().join(',');
  assert(ripKeys === dtsKeys, `ARIA method sets drifted:\n  index.rip: ${ripKeys}\n  aria.d.ts: ${dtsKeys}`);
  // Same normalized signature per method.
  for (const [name, sig] of ripMethods) {
    assert(dtsMethods.get(name) === sig,
      `ARIA method '${name}' drifted:\n  index.rip: ${sig}\n  aria.d.ts: ${dtsMethods.get(name)}`);
  }
});

// ── A no-`@` event binding (`@event: handler`) types the handler's param ──
//
// The param-typing prescan only matched the `@event: @handler` (this-member)
// reference, so the bare `@event: handler` form fell back to implicit-any.
// Fixed: it resolves the handler from either reference shape.

check('a no-`@` event binding types the handler param from the event', async () => {
  const r = await checkProject({
    'box.rip': `export Box = component extends input
  closed := false
  onKeydown = (e) ->
    closed = true if e.key is 'Escape'
  render
    input @keydown: onKeydown
`,
  });
  assert(r.ok, 'expected clean check (e typed as KeyboardEvent), got:\n' + r.out);
});

check('a no-`@` event binding types the param as the specific event, not any', async () => {
  const r = await checkProject({
    'box.rip': `export Box = component extends input
  closed := false
  onKeydown = (e) ->
    closed = true if e.clientX > 0
  render
    input @keydown: onKeydown
`,
  });
  assert(!r.ok, 'expected an error (clientX is not on KeyboardEvent)');
  assert(/clientX/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── Drain the queued checks with bounded concurrency ──
// Workers pull from a shared cursor; results are stored by index and printed in
// definition order afterward, so output is deterministic regardless of which
// subprocess finishes first.
rmSync(tmpRoot, { recursive: true, force: true });
const concurrency = Math.max(2, (os.availableParallelism?.() ?? os.cpus().length) - 1);
const results = new Array(tasks.length);
let cursor = 0;
async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= tasks.length) break;
    const { name, fn } = tasks[i];
    try { await fn(); results[i] = { ok: true, name }; }
    catch (e) { results[i] = { ok: false, name, msg: e.message }; }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

for (const r of results) {
  if (r.ok) { console.log(`  ${green('✓')} ${r.name}`); passed++; }
  else { console.log(`  ${red('✗')} ${r.name}`); console.log(`    ${red(r.msg)}`); failed++; }
}

rmSync(tmpRoot, { recursive: true, force: true });
console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
