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
function checkProject(files) {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(resolve(tmpDir, 'package.json'),
    '{"rip": {"strict": true, "checkAll": true}, "dependencies": {"@rip-lang/app": "workspace:*"}}\n');
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
// `items:: OrderItem[]` in one function used to stamp `: OrderItem[]` onto
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
  items:: string[] = []
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
  items:: string[] = []
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
  order:: Order | null := null

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
  order:: Order | null := null

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
  user: source { fetch: -> { firstName: 'Ada', lastName: 'Lovelace' } }
  order: source { fetch: (id:: string) -> { id: id, total: 42 } }
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

orders:: number[] = []

export stash =
  orders: orders
  user: source { fetch: -> { name: 'Ada' } }
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
  user: source { fetch: -> { name: 'Ada' } }
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
  user: source { fetch: -> { name: 'Ada' } }
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

userSource = source { fetch: -> { name: 'Ada' } }

export stash =
  user: userSource
  settings: { theme: source { fetch: -> { dark: true } } }
`,
    'c.rip': `export C = component
  user <~ @app.data.user
  theme <~ @app.data.settings.theme
  render null
`,
  });
  assert(clean.ok, 'binding indirection and subpath gates should pass: ' + clean.out);
});

check('opaque stash values stay silent (the mount check backstops them)', () => {
  const r = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'
import { makeThing } from './factory.rip'

export stash =
  thing: makeThing()
  user: source { fetch: -> { name: 'Ada' } }
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
  products: source { fetch: (-> [1, 2]), staleTime: '5 min' }
`,
  });
  assert(good.ok, "'5 min' should be a valid Duration: " + good.out);

  const bad = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> [1, 2]), staleTime: '5 mins' }
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
  products: source { fetch: (-> [1, 2]), staleTime: 'forever' }
`,
  });
  assert(good.ok, "'forever' should type-check: " + good.out);

  const sym = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> [1, 2]), staleTime: :forever }
`,
  });
  assert(!sym.ok, 'the :forever symbol should be rejected — the keyword is a string');

  const typo = checkProject({
    'index.rip': `export ok = true\n`,
    'app/stash.rip': `import { source } from '@rip-lang/app'

export stash =
  products: source { fetch: (-> [1, 2]), staleTime: 'foreverz' }
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
  msg:: string | null := null
  onError: (err) -> msg = err.message ?? 'unknown'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const misuse = checkProject({
    'comp.rip': `export Layout = component
  msg:: string | null := null
  onError: (err) -> msg = err.bogus
  render null
`,
  });
  assert(!misuse.ok, 'err should carry the structured type, not any');
  assert(/bogus/.test(misuse.out), 'unexpected output:\n' + misuse.out);
});

// ── 8. `?` widens a member with an explicit `:= undefined` initializer ──
//
// `x?:: string := undefined` used to declare Signal<string> but initialize
// it with undefined — an immediate TS2322. The `?` marker now widens the
// payload to `| undefined` when the initializer is the undefined literal,
// matching the no-initializer prop case (`@label?:: T`). A `?` with a real
// default stays unwidened (the default fills the gap).

check("x?:: T := undefined declares Signal<T | undefined>; use still narrows", () => {
  const r = checkProject({
    'comp.rip': `export C = component
  gateError?:: string := undefined
  msg ~= gateError ?? 'ok'
  render null
`,
  });
  assert(r.ok, 'expected clean check, got:\n' + r.out);

  const unguarded = checkProject({
    'comp.rip': `export C = component
  gateError?:: string := undefined
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
  @outline?:: boolean

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

rmSync(tmpDir, { recursive: true, force: true });
console.log('');
const total = passed + failed;
if (failed === 0) { console.log(green(`${total} checks: ${passed} passing`)); process.exit(0); }
else { console.log(red(`${total} checks: ${passed} passing, ${failed} failing`)); process.exit(1); }
