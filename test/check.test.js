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
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const rip = resolve(root, 'bin', 'rip');
const tmpDir = resolve(__dirname, '_check_tmp');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s);
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

// Wipe the temp project, write the given files, run `rip check .` over it.
// File names may contain subdirectories ('app/stash.rip').
// `ripConfig` overrides/extends the default `rip` config (e.g. { exclude: [...] }).
function checkProject(files, ripConfig = {}) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const ripCfg = { strict: true, checkAll: true, ...ripConfig };
  writeFileSync(resolve(tmpDir, 'package.json'),
    JSON.stringify({ rip: ripCfg, dependencies: { '@rip-lang/app': 'workspace:*' } }) + '\n');
  for (const [name, src] of Object.entries(files)) {
    const dest = resolve(tmpDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, src);
  }
  try {
    execSync(`'${rip}' check .`, { cwd: tmpDir, stdio: 'pipe' });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: (e.stdout?.toString() || '') + (e.stderr?.toString() || '') };
  }
}

// ── 1. Inline `schema :shape` as `.extend()` argument carries its type ──
//
// An anonymous expression-position schema used to resolve to the
// `__schema(d: any): any` fallback overload, so `extend<U>` inferred
// nothing and the derived type silently lost every extended field.
// Fixed: codegen stamps a shadow-only `__anon` key on the descriptor and
// the dts pass emits a keyed overload (SCHEMA-GAPS.md gap 14).

check('inline-extend fields survive into the derived type', () => {
  const r = checkProject({
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

check('a bogus property on the extended type still errors', () => {
  const r = checkProject({
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

check('sibling functions with one typed local check independently', () => {
  const r = checkProject({
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

check("the untyped sibling keeps its own inferred type, not the annotation", () => {
  const r = checkProject({
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

check('reads in the guarded render branch narrow to non-null', () => {
  const r = checkProject({
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

check('reads in the else branch still see the null', () => {
  const r = checkProject({
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

check('gated binding is non-null at every read site', () => {
  const r = checkProject({
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

check('ungated source read stays T | null — unguarded access errors', () => {
  const r = checkProject({
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

check('keyed gate narrows; ungated keyed read stays nullable', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'detail.rip': `export Detail = component
  order <~ @app.data.order(params.id)
  render
    p "total: #{order.total}"
`,
  });
  assert(r.ok, 'expected clean check on the keyed gate, got:\n' + r.out);

  const r2 = checkProject({
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

check('stash methods are typed: reset() and the source() handle', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': SOURCE_STASH,
    'tools.rip': `export Tools = component
  stats = @app.data.source('user')
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

check('gating a plain key errors at check time (module-binding indirection)', () => {
  const r = checkProject({
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

check('gating a nullable plain key errors too (the silent-null case)', () => {
  const r = checkProject({
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

check('a gate on a missing key errors; sources via binding or subpath stay clean', () => {
  const missing = checkProject({
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

  const clean = checkProject({
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

check('a source whose fetch can resolve to null errors at the declaration', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> if true then Promise.resolve({ name: 'Ada' }) else Promise.resolve(null) }
`,
  });
  assert(!r.ok, 'expected a non-null-source constraint error');
  assert(/Type 'null' is not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a source whose fetch resolves to undefined (no value) errors at the declaration', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  user: source { fetch: -> Promise.resolve(undefined) }
`,
  });
  assert(!r.ok, 'expected a void-fetch constraint error');
  assert(/Type 'undefined' is not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a source with a non-null fetch passes (constraint does not over-fire)', () => {
  const r = checkProject({
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
check('a fetch that forgets to return errors at the declaration (async no-return)', () => {
  const r = checkProject({
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
check('a synchronous (non-Promise) fetch is rejected — a source must be async', () => {
  const r = checkProject({
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
check('an inline @event handler types its param, robust to sibling props', () => {
  const r = checkProject({
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
check('an unresolved bare-ident attribute (form noValidate) checks clean', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'c.rip': `export C = component
  render
    form noValidate, class: "x"
      div "a"
`,
  });
  assert(r.ok, 'a bare-ident boolean attribute must not error as an undefined name: ' + r.out);
});

check('a bare-ident text child that IS in scope still type-checks (loop var)', () => {
  const r = checkProject({
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

check('an unresolved bare-ident flag on a component checks clean (Btn disabled)', () => {
  const r = checkProject({
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

check('an inline @event handler param is genuinely typed (a bogus member errors)', () => {
  const r = checkProject({
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

check('a required prop bound with <=> checks clean (binding satisfies it)', () => {
  const r = checkProject({
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

check('a required prop passed by direct value still checks clean', () => {
  const r = checkProject({
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

check('omitting a required prop entirely still errors', () => {
  const r = checkProject({
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

check('a prop-less child component has no phantom required props', () => {
  const r = checkProject({
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

check('a prop-less component does not corrupt a following component def', () => {
  const r = checkProject({
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

check('a non-exported prop-less component still rejects unknown props', () => {
  // `Picker` is non-exported (`declare class`, not `export declare class`) and
  // declares no props. It must still land in the component registry so its
  // usage sites are prop-checked — passing it `bogus` is an error, not silently
  // accepted.
  const r = checkProject({
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

check('opaque stash values stay silent (the mount check backstops them)', () => {
  const r = checkProject({
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

check("staleTime '5 min' checks clean; '5 mins' is a type error", () => {
  const good = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: '5 min' }
`,
  });
  assert(good.ok, "'5 min' should be a valid Duration: " + good.out);

  const bad = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: '5 mins' }
`,
  });
  assert(!bad.ok, "'5 mins' should be rejected by the Duration type");
  assert(/5 mins/.test(bad.out), 'unexpected output:\n' + bad.out);
});

check("staleTime 'forever' checks clean; symbols and near-misses are type errors", () => {
  const good = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: 'forever' }
`,
  });
  assert(good.ok, "'forever' should type-check: " + good.out);

  const sym = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> Promise.resolve([1, 2])), staleTime: :forever }
`,
  });
  assert(!sym.ok, 'the :forever symbol should be rejected — the keyword is a string');

  const typo = checkProject({
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

check('untyped onError param checks clean and is typed, not any', () => {
  const r = checkProject({
    'comp.rip': `export Layout = component
  msg: string | null := null
  onError: (err) -> msg = err.message ?? 'unknown'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const misuse = checkProject({
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

check("x?: T := undefined declares Signal<T | undefined>; use still narrows", () => {
  const r = checkProject({
    'comp.rip': `export C = component
  gateError?: string := undefined
  msg ~= gateError ?? 'ok'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const unguarded = checkProject({
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

check("query is Record<string, string>; URLSearchParams calls error", () => {
  const ok = checkProject({
    'comp.rip': `export C = component
  sort ~= @query.sort ?? 'asc'
  render null
`,
  });
  assert(ok.ok, 'plain query field access should check clean, got:\n' + ok.out);

  const bad = checkProject({
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

check('a bogus route in a component href errors at the call site', () => {
  const r = checkProject(routeProject('    NavLink href: "/nope", "Broken"'));
  assert(!r.ok, 'expected a route error on NavLink href: "/nope"');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
  assert(/"\/nope"/.test(r.out), 'error should name the bad href:\n' + r.out);
});

check('valid routes, external URLs, and variables in component href pass', () => {
  const r = checkProject(routeProject(
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

check('router.replace: a valid route passes; a path typo errors', () => {
  let r = checkProject(routerBodyProject(`  mounted: -> @router.replace('/orders')`));
  assert(r.ok, 'valid route replace should pass:\n' + r.out);
  r = checkProject(routerBodyProject(`  mounted: -> @router.replace('/nope')`));
  assert(!r.ok, 'a path typo in replace should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('router.replace / push: a dynamic (non-literal) string passes', () => {
  let r = checkProject(routerBodyProject(`  url: string := '/whatever'\n  mounted: -> @router.replace(url)`));
  assert(r.ok, 'dynamic string replace should pass:\n' + r.out);
  r = checkProject(routerBodyProject(`  url: string := '/whatever'\n  mounted: -> @router.push(url)`));
  assert(r.ok, 'dynamic string push should pass:\n' + r.out);
});

check('router.push: a valid route passes; a path typo errors', () => {
  let r = checkProject(routerBodyProject(`  mounted: -> @router.push('/orders')`));
  assert(r.ok, 'valid route push should pass:\n' + r.out);
  r = checkProject(routerBodyProject(`  mounted: -> @router.push('/nope')`));
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

check('RoutePath: a valid route literal passes', () => {
  const r = checkProject(routePathProject(`home: RoutePath = '/orders'`));
  assert(r.ok, 'expected clean check, got:\n' + r.out);
});

check('RoutePath: a bogus route literal errors', () => {
  const r = checkProject(routePathProject(`home: RoutePath = '/nope'`));
  assert(!r.ok, 'expected a route error on RoutePath = "/nope"');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('RoutePath: a file-local declaration wins (no duplicate-identifier clash)', () => {
  const r = checkProject(routePathProject(`type RoutePath = 'custom'\n\nval: RoutePath = 'custom'`));
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

check('single-quoted string prop defaults pass', () => {
  const r = checkProject({
    'c.rip': `export Input = component extends input
  @value?: string := ''
  @label?: string := 'hi'
  render
    input
`,
  });
  assert(r.ok, 'single-quoted string defaults should pass:\n' + r.out);
});

check('single-quoted defaults in a string-literal union pass; a non-member errors', () => {
  let r = checkProject({
    'c.rip': `export Button = component extends button
  @variant?: 'primary' | 'secondary' := 'primary'
  render
    button
`,
  });
  assert(r.ok, 'single-quoted union default should pass:\n' + r.out);
  r = checkProject({
    'c.rip': `export Button = component extends button
  @variant?: 'primary' | 'secondary' := 'tertiary'
  render
    button
`,
  });
  assert(!r.ok, 'a default outside the union should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

check('a genuinely mismatched default still errors (string default on number)', () => {
  const r = checkProject({
    'c.rip': `export Box = component extends div
  @count?: number := 'oops'
  render
    div
`,
  });
  assert(!r.ok, 'a string default on a number prop should error');
  assert(/not assignable/.test(r.out), 'unexpected output:\n' + r.out);
});

// ── globToRegex escapes regex metacharacters in exclude patterns ──
//
// globToRegex only escaped `.`, leaving `[ ] ( ) { } + ^ $ |` raw. That
// silently broke excludes for Rip's own route-dir syntax: `[id]/**` compiled
// to a char class, so `app/routes/[id]/x.rip` never matched and the file was
// type-checked despite being excluded. Fixed: escape the full metacharacter
// set. The error file below would fail `rip check` if the exclude were a no-op.

check('exclude patterns with route-dir brackets/parens are honored', () => {
  const files = {
    'app/routes/index.rip': `export Home = component\n  render\n    div\n`,
    'app/routes/[id]/x.rip': `bad: number := 'oops'\n`,
    'app/routes/(app)/y.rip': `bad: number := 'oops'\n`,
  };
  // Sanity: without the exclude, the bracketed files' errors surface.
  let r = checkProject(files);
  assert(!r.ok, 'the deliberate errors should surface when not excluded');
  // With the exclude, both bracketed dirs are skipped → clean.
  r = checkProject(files, { exclude: ['app/routes/[id]/**', 'app/routes/(app)/**'] });
  assert(r.ok, 'excluded route-dir files should be skipped:\n' + r.out);
});

rmSync(tmpDir, { recursive: true, force: true });
console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
