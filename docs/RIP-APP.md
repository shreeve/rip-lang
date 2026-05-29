<p align="center">
  <img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip-schema-social.png" alt="Rip App" width="640">
</p>

# Rip App — Application Framework

> **The browser-side framework that ships with rip-lang. Stash, resource,
> timing, components store, file-based router, fine-grained renderer,
> orchestrated launch, and shared ARIA primitives — all in one bundle,
> no build step required.**

Rip App is to the browser what `@rip-lang/server` is to HTTP: a
batteries-included, opinionated application framework written in Rip
itself. It uses the language's compiler and reactive primitives the
same way any user's app would — Rip App doesn't extend the language,
it just exposes a coherent set of pieces (state, async data, routing,
rendering, lifecycle) on top of them.

If you've loaded `<script src="rip.min.js">` and called `app.launch(...)`,
you've used Rip App. This doc explains what's inside it, why it's
shaped the way it is, and how to use it well.

---

# Contents

- [Rip App — Application Framework](#rip-app--application-framework)
- [Contents](#contents)
  - [1. The four-layer architecture](#1-the-four-layer-architecture)
  - [2. Quick start](#2-quick-start)
    - [Real apps: bundles + file-based routing](#real-apps-bundles--file-based-routing)
  - [3. The subsystems](#3-the-subsystems)
    - [Stash](#stash)
    - [createResource](#createresource)
    - [Timing helpers](#timing-helpers)
    - [Components store](#components-store)
    - [createRouter](#createrouter)
    - [createRenderer](#createrenderer)
    - [launch](#launch)
    - [ARIA helpers](#aria-helpers)
  - [4. Lifecycle invariants](#4-lifecycle-invariants)
    - [Component lifecycle order](#component-lifecycle-order)
    - [User hooks](#user-hooks)
    - [Effect ownership](#effect-ownership)
    - [Effect cleanup-on-rerun](#effect-cleanup-on-rerun)
    - [Parent chain (for context)](#parent-chain-for-context)
    - [Layout and page parentage](#layout-and-page-parentage)
    - [Factory blocks (for/if in render)](#factory-blocks-forif-in-render)
    - [Keyed list reconciliation](#keyed-list-reconciliation)
  - [5. Async effects](#5-async-effects)
  - [6. Gotchas](#6-gotchas)
    - [The bundle boundary matters](#the-bundle-boundary-matters)
    - [Render-template name shadowing (fixed)](#render-template-name-shadowing-fixed)
    - [Nested `for` loops can both name `i` (fixed)](#nested-for-loops-can-both-name-i-fixed)
    - [Snapshot tests are brittle](#snapshot-tests-are-brittle)
    - [No browser e2e tests](#no-browser-e2e-tests)
  - [7. When NOT to use Rip App](#7-when-not-to-use-rip-app)

---

## 1. The four-layer architecture

Rip's framework code splits into four layers. Knowing which layer a
piece of code lives in tells you what it can assume about its
dependencies and what it owes its callers.

```text
Layer 0   Language core             src/compiler.js, src/lexer.js, src/parser.js,
          (compiler + reactive       src/types.js, src/dts.js, src/typecheck.js,
           runtime + types +         src/schema/, src/grammar/grammar.rip
           schema runtime)

Layer 1   Component runtime         src/components.js
          (__Component class,        - __pushComponent / __popComponent /
           render-template codegen,    __getCurrentComponent (the bridge)
           __reconcile, __lis,       - __reconcile (LIS-based keyed list update)
           __transition, context)    - render-template → DOM codegen

Layer 2   Rip App framework         packages/app/index.rip
          (this doc's subject)       - Stash, Resource, Timing, Components store,
                                       Router, Renderer, Launch, ARIA helpers

Layer 3   Headless widgets          packages/ui/browser/components/*.rip
          (ARIA-driven UI library)   - 54+ widgets: Dialog, MultiSelect, DatePicker,
                                       Combobox, Slider, ScrollArea, etc.
```

Layer 2 (Rip App) depends on Layers 0 + 1 via two `globalThis`
bridges:

- `globalThis.__rip` — reactive primitives (`__state`, `__computed`,
  `__effect`, `__batch`, `__getEffectSignal`).
- `globalThis.__ripComponent` — component machinery
  (`__pushComponent`, `__popComponent`, `__getCurrentComponent`,
  `setContext`, `getContext`, `hasContext`, `__Component`,
  `__reconcile`, `__transition`, `__handleComponentError`, `__clsx`,
  `__lis`).

The bridges are populated when the runtime is loaded (either via the
embedded preamble in standalone-compiled output, or via the framework
bundle's evaluation). Rip App reads them lazily so module load order
is irrelevant.

Rip App **does not extend the compiler**. Anything that compiles
without Rip App also compiles with Rip App; Rip App's value is purely
the user-land API it exposes.

---

## 2. Quick start

The smallest possible Rip App is one HTML file you can drop into any
static server (or open straight from disk):

```html
<!doctype html>
<html>
<body>
  <script defer
          src="https://shreeve.github.io/rip-lang/dist/rip.min.js"
          data-src=""
          data-mount="App"></script>
  <script type="text/rip">
    App = component
      @name := "world"
      render
        h1 "Hello, #{@name}!"
        button @click: (=> @name = "Rip"), "Click me"
  </script>
</body>
</html>
```

Save as `index.html`, run `python3 -m http.server` (or any other
static server, or just double-click the file), and you're live.

What each attribute does:

- `defer` — wait for the document to parse so the inline
  `<script type="text/rip">` block is in the DOM when the framework
  runs.
- `src=...` — the framework bundle (compiler + reactive runtime +
  Rip App). Use the GitHub Pages CDN URL above, or self-host a copy
  of `dist/rip.min.js`.
- `data-src=""` — **explicitly empty**. Without this, the runtime
  defaults to `GET /app` (the auto-bundle endpoint provided by
  `@rip-lang/server`'s `serve` middleware). When you're not running
  a Rip server, the empty string suppresses that fetch.
- `data-mount="App"` — name of the top-level component to mount.
  Mounted onto `<body>` by default; pass `data-target="#app"` (or
  any selector) to mount somewhere else.

The browser loads `rip.min.js`, the compiled framework + compiler
evaluate, all inline `<script type="text/rip">` blocks share scope
and compile in-browser, and the runtime calls `App.mount('body')`
for you. Clicking the button mutates `@name`; reactivity updates
only the `<h1>`'s text node.

A note on the `@` prefix: `@name := "world"` declares `name` as a
**prop** — the parent can pass `App name: "Rip"` to override the
default, and the component's own code reads/writes it via `@name`.
A bare `name := "world"` (no `@`) declares an internal-only state
that isn't exposed as a prop. The two are not interchangeable; if
you write `name := "world"` in the declaration but then `@name = ...`
in a handler, you'll be writing to a different binding than the one
your render reads. **Use `@` consistently for anything you want
both reactive and externally settable.**

### Real apps: bundles + file-based routing

For multi-page apps you serve a bundle (a JSON map of paths → Rip
source) and let the runtime route between them. The
`@rip-lang/server` middleware emits the bundle for you; the browser
runtime auto-detects and calls `app.launch(...)` internally:

```html
<script defer
        src="/dist/rip.min.js"
        data-src="/bundle.json"
        data-router
        data-persist="local"></script>
```

The `data-router` attribute switches the runtime from "mount one
component" mode to "file-based router with renderer" mode. With a
bundle in hand, the runtime calls `launch({ bundle, hash, persist })`
and you get the full Rip App stack — stash, router, renderer, hot
reload — wired up automatically.

Direct `app.launch(opts)` is still public for advanced use (custom
target, custom error handling, multiple launches over the lifetime
of the page) but you rarely need it.

---

## 3. The subsystems

### Stash

A deep reactive proxy with path navigation. Single-app state,
JSON-persistable, fine-grained signal subscription per key.

```rip
app = createStash
  user:
    name: "Alice"
    prefs:
      theme: "dark"
  todos: []

# Path-based access
app['user/prefs/theme']         # → 'dark'
app['user/prefs/theme'] = 'light'

# Reserved methods (not properties — atomic ops)
app.inc 'todos/length'           # increment counter
app.flip 'user/prefs/expanded'   # toggle boolean
app.has 'user/email'             # → false
app.del 'user/prefs/theme'       # remove
app.keys 'user'                  # → ['name', 'prefs']
app.join 'user', email: "..."    # shallow merge

# Use raw object underneath
plain = unwrapStash(app)         # back to a plain JS object
```

**Single-stash policy**: Rip App assumes one stash per page (the one
`launch()` creates as `app.data`). `persistStash` and the
beforeunload-flush mechanism both rely on this. Apps needing
isolated state silos should use plain `__state(...)` signals or
namespace under different keys on `app.data`.

### createResource

Async data with race protection, abort support, and reactive loading
state.

```rip
user = createResource ->
  signal = getEffectSignal()       # capture BEFORE await; aborts on dispose
  res = fetch! "/api/users/#{userId}", { signal }
  res.json!

# Reactive consumers see loading/data/error transitions
~> if user.loading
     "Loading..."
   else if user.error
     "Error: #{user.error.message}"
   else
     user.data?.name

user.refetch!     # rejected promises rethrow; awaiters see them
user.dispose()    # cancels in-flight, clears state
```

Race protection: each refetch increments a generation counter. Old
responses that resolve after a newer fetch is in flight are dropped.
AbortController signal is passed to `fn` and aborted on
dispose/refetch.

### Timing helpers

`delay`, `debounce`, `throttle`, `hold` — all reactive, all return a
disposable signal-like object.

```rip
showLoading := delay 200 -> loading      # truthy waits 200ms, falsy immediate
debouncedQuery := debounce 300 -> query  # propagates 300ms after last change
smoothScroll := throttle 100 -> scrollY  # at most once per 100ms
showSaved := hold 2000 -> saved          # once truthy, stays true ≥ 2000ms

# All return objects with .value, .read(), .dispose()
debouncedQuery.dispose()
```

The `.dispose()` is auto-called when the enclosing component unmounts
(via the `__getCurrentComponent` bridge). Manual disposal is only
needed when used outside a component.

### Components store

In-memory virtual filesystem of `.rip` source files with hot-reload
watchers. The renderer uses it; you rarely touch it directly.

```rip
store = createComponents()
store.write 'components/Card.rip', source
store.read 'components/Card.rip'
store.list 'components'
store.watch (event, path) -> ...    # 'create' | 'change' | 'delete'
unwatch = store.watch (...) -> ...
unwatch()                            # idempotent disposer
```

### createRouter

File-system routing with base prefix, query/hash preservation, hash
mode, error callback, and nav-callback hooks.

```rip
router = createRouter components,
  root: 'components'        # root directory in the store
  base: '/admin'            # path prefix (e.g. for sub-app deployment)
  hash: false               # hash-mode routing
  onError: (err) ->
    console.error "Routing error: #{err.status} #{err.path}"

router.push '/users/42?tab=settings'
router.replace '/login'
router.back()
router.forward()

# Reactive properties (each is its own signal)
router.path        # '/users/42'
router.params      # { id: '42' }
router.route       # { file, regex, pattern }
router.layouts     # ['_layout.rip', 'users/_layout.rip']
router.query       # { tab: 'settings' }
router.hash        # ''
router.navigating  # true while resolve() in flight (200ms delay)

# router.current is a single __computed (one subscription, not 6)
~> info = router.current
   mountThePage(info) if info.route

# Subscribe to nav events explicitly
unwatch = router.onNavigate (current) -> log current.path
unwatch()
```

The renderer uses `router.current` to drive its mount effect. Each
field is also a separate signal so subscribers can track only what
they care about.

#### Anchor opt-outs and active-link styling

The router intercepts plain `<a>` clicks at the document level. Two
per-anchor attributes adjust that behavior:

| Attribute               | Effect                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `data-router-ignore`    | Skip SPA interception entirely. The browser performs a full navigation.               |
| `data-router-noscroll`  | Take the SPA navigation, but don't reset scroll to `(0, 0)`.                          |

Anchors with `target="_blank"`, `[download]`, cross-origin hrefs, or
hrefs outside `base` are also skipped automatically.

**Active-link highlighting.** On every navigation the router walks
in-document anchors and sets `aria-current` on those that match the
current path:

- exact match → `aria-current="page"`
- prefix match (`/blog` on `/blog/123`) → `aria-current="true"`
- otherwise → attribute removed (only if the router set it)

Style it with attribute selectors — no per-link boilerplate needed:

```css
nav a[aria-current="page"] { color: red; font-weight: bold; }
nav a[aria-current="true"] { color: red; }
```

Setting `aria-current` manually on an anchor wins — the router only
touches values it set itself.

**Scroll restoration.** New navigations (`push` or a link click)
reset scroll to `(0, 0)`. Back/forward (`popstate`) restores the
scroll position the page had when you left it. Same-document fragment
links (`#section`) defer to the browser.

**Typed routes (compile-time).** In a typed project (one with
`rip.strict: true` or `::` annotations), `rip check` synthesizes a
`__RipRoutes` union from the file tree under `app/routes/` and
threads it through three places:

| Place                              | Type                                                                  | Catches                            |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `<a href: "...">` in render blocks | `__RipRoutes` for `/`-prefixed literals; any string otherwise         | Typos in known routes              |
| `router.push url, opts?`           | `__RipRoutes` (replaces base `string`)                                | Typos in programmatic navigation   |
| `@params` in `routes/[id].rip`     | `{ id: string }` (replaces `Record<string, string>`)                  | Typos like `@params.bogus`         |

Anchor `href` uses a `const`-generic conditional: a literal starting
with `/` must satisfy `__RipRoutes`, while external schemes
(`https://`, `mailto:`, `tel:`), fragments (`#anchor`), and dynamic
`string` values fall through unchecked. Typos like `<a href: "/crat">`
produce a single-line error naming the valid routes.
`router.replace` is deliberately left at `string` — it's commonly
used to mutate the current URL with query strings, where the built
value can't satisfy a literal-route union. Catch-all routes
(`[...rest].rip`) are excluded from `__RipRoutes` — they're runtime
404 fallbacks, not navigation targets, so including them as
`/${string}` would defeat typo-catching for every other route.

### createRenderer

The render loop. Subscribes to `router.current`, mounts/unmounts
page + layout components, manages the lifecycle. You rarely call this
directly — `launch()` does it for you — but the API is public.

```rip
renderer = createRenderer
  router: router
  app: app
  components: components
  resolver: resolver
  compile: compile         # the rip-lang compileToJS function
  target: '#app'
  onError: (err) -> console.error err

renderer.start()           # idempotent — second call is a no-op
renderer.remount()         # re-mount the current route
renderer.remount(true)     # force a full unmount + remount (hot reload)
renderer.stop()            # tears down lifecycle, revokes blob URLs
```

### launch

The orchestrator. Single entry point that wires bundle → stash →
components → resolver → router → renderer → lifecycle.

```rip
result = await app.launch
  bundle: { components: {...}, routes: {...}, data: {...} }
  base: '/admin'           # optional URL prefix
  target: '#app'           # optional mount target
  persist: 'local'         # optional: 'local' | 'session' | true | false
  hash: false              # optional: hash-mode routing

# Returns
result.app                 # the stash proxy
result.components          # the components store
result.router              # the router
result.renderer            # the renderer
result.destroy()           # teardown — symmetric to launch
```

**`launch` is single-arg**: just `launch(opts)`. Earlier polymorphic
forms like `launch(base, opts)` are gone.

`destroy()` is idempotent and cleans up everything: closes the SSE
hot-reload watch, stops the renderer, destroys the router, disposes
the persist stash, deletes the resolver classes key from globalThis,
clears `globalThis.__ripApp` / `__ripLaunched` / `window.app` /
`window.__RIP__`. After `destroy()`, you can `launch(...)` again with
a different config.

### ARIA helpers

Shared keyboard/popup/focus primitives used by Rip UI widgets.
Registered on `globalThis.__aria` and `globalThis.ARIA` when the
framework bundle evaluates. Available globally in any component
without imports.

```rip
ARIA.listNav e, h          # popup list nav (ArrowDown/Up, Enter, Escape, Home/End, typeahead)
ARIA.rovingNav e, h, orient  # inline composite nav (radiogroup, tabs, toolbar)
ARIA.popupDismiss open, popup, close, els, repos
ARIA.popupGuard delay      # per-component reopen suppression after pointer-driven closes
ARIA.bindPopover open, popover, setOpen, source
ARIA.bindDialog open, dialog, setOpen, dismissable
ARIA.position trigger, floating, opts   # CSS anchor positioning with fallback
ARIA.positionBelow trigger, popup, gap, setVisible
ARIA.trapFocus panel       # Tab wraps first↔last
ARIA.wireAria panel, id    # auto-label panel from heading + paragraph
ARIA.lockScroll inst       # body scroll lock with stack management
ARIA.unlockScroll inst
ARIA.combine ...disposers  # fold N disposers into one
ARIA.hasAnchor()           # feature-detect CSS anchor positioning
```

The `bindPopover`, `bindDialog`, and `popupDismiss` helpers are
**idempotent at the element level** — calling them repeatedly (as
happens when an enclosing `~>` effect re-runs) doesn't accumulate
listeners. Each call removes any prior listener it had attached
before adding a new one. This was earned the hard way; see
[Gotchas](#6-gotchas) below.

---

## 4. Lifecycle invariants

These are the contracts the framework upholds. Reading these is
faster than tracing through 13 commits' worth of fixes.

### Component lifecycle order

```text
constructor (props)            ← user code receives initial props
  └─ _init(props)              ← @state, @computed, top-level ~> effects all wire here
                                  __pushComponent(this) wraps this call
                                  → _parent established (set-once)
                                  → effects auto-register on this._disposers

mount(target)                  ← only the renderer calls this directly
  └─ __pushComponent(this)
       _create()               ← DOM tree construction; reactive bindings + child components
                                  Per-child push wrap: each child's _create runs with
                                  child as current, so the child's reactive bindings
                                  register on child._disposers, not parent's.
       beforeMount()           ← user hook; signals/state ready, DOM not yet in tree
                                  effects created here auto-register on this component
       _setup()                ← post-creation effects (rare; most go in _init)
       mounted()               ← user hook; DOM is in the tree now
     __popComponent

[ ... reactive updates happen here, ad infinitum ... ]

unmount({ removeDOM = true })  ← idempotent (_unmounted flag short-circuits second calls)
  └─ beforeUnmount()           ← user hook; signals/effects still live
     children.forEach unmount  ← cascade BEFORE this instance's disposers
     _disposers.forEach run    ← effect cleanup fires
     unmounted()               ← user hook; final notification
     DOM removal (if requested)
```

### User hooks

The framework recognizes these hook names on any component. All are
optional; the runtime calls each only if defined.

| Hook            | When it fires                                              | Notes                                                                            |
| --------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `beforeMount`   | After `_create`, before DOM is attached                    | Effects created here auto-register on the component                              |
| `mounted`       | After DOM attached                                         | Runs once per visit                                                              |
| `beforeUnmount` | Before children unmount and disposers fire                 | Signals/effects still live                                                       |
| `unmounted`     | After disposers fire and DOM is removed                    | Final notification; runs once per visit                                          |
| `onError`       | A throw escapes any component method (render, hook, event) | Receives `{ status?, message?, error?, path? }`; the renderer walks the layout chain to find the nearest defining component |


### Effect ownership

Every `__effect(fn)` call automatically registers its disposer with
the **currently-pushed component** at the time of the call (via
`globalThis.__ripComponent.__getCurrentComponent`). On
`component.unmount()`, all registered disposers fire. This is the
mechanism that makes `~> ARIA.bindPopover(...)` work without a
per-widget `beforeUnmount` hook.

Two exceptions:

1. Effects created by **factory blocks** (`for`/`if` in render
   templates) opt out of auto-registration via
   `__effect(fn, {skipRegister: true})`. Their disposers live in the
   factory's local `disposers` array and are called by `d(detaching)`
   when the block is removed.
2. Top-level effects created outside any component context have no
   parent to register with; the disposer must be called manually.

### Effect cleanup-on-rerun

If a `~>` body returns a function, that function becomes the effect's
cleanup. It fires:

1. Before each re-run, just after the new run is about to start.
2. On `effect.dispose()` (which fires when the owning component
   unmounts).

For sync bodies, this is straightforward. For async bodies (the body
returns a Promise), the cleanup function still works, but with two
extra guards in place:

- A per-run `runId` counter discards async resolutions from a
  superseded run. If the effect re-ran while the prior body was
  awaiting, the prior body's eventual resolution is run-and-discarded
  immediately, never installed on the now-current run's `_cleanup`.
- The effect's `AbortSignal` is aborted on every re-run / dispose.
  User code that captured the signal via `getEffectSignal()` and
  passed it to `fetch` / `setTimeout` etc. sees `AbortError` and
  unwinds cleanly.

### Parent chain (for context)

`component._parent` is **set-once** during the first
`__pushComponent` that has a non-self predecessor. Subsequent pushes
preserve the construction-time chain. This keeps `getContext` /
`hasContext` / `__handleComponentError` walking up the tree
correctly even after the same component is re-pushed for its own
mount or factory re-entry.

The graph-traversal sites (`getContext`, `hasContext`,
`__handleComponentError`) all carry a `visited` Set as
defense-in-depth against any future bug that corrupts the chain. A
self-cycle in `_parent` no longer hangs the runtime; it's just an
early termination.

### Layout and page parentage

The renderer instantiates layouts in order, threading each as the
parent for the next, so an outer layout's `setContext` is visible to
inner layouts and to the page via `getContext`. The page is parented
to the innermost layout. Construction-time parent chain survives the
mount-time re-pushes.

### Factory blocks (for/if in render)

Factory blocks own their child component instances exclusively in a
local `_factoryChildren` array. When the block is detached
(`d(detaching)`), each child has `unmount({removeDOM: false})`
called. Child instances are NOT pushed onto the parent's `_children`
— that array would otherwise grow unboundedly under loop churn
(every removed iteration would leave a stale ref).

Conditional / loop reactive effects in **class mode** (top-level
component) push a manual disposer onto the parent's `_disposers`
that calls `currentBlock.d(true)` on unmount. Without this, parent
unmount would dispose the effect (preventing future re-runs) but
leave the current block alive — its DOM, signal subscriptions, and
child components all leaked.

### Keyed list reconciliation

`__reconcile` reuses blocks across renders when their keys match.
Phase-1 prefix scan calls `p()` (the per-render update) on the reused
block ONLY if the underlying item reference changed (even if the key
is the same). With a custom `keyFn` like `(item) -> item.id`, this
catches the case where stable keys map to mutated item content (an
item was replaced wholesale but the id stayed the same).

---

## 5. Async effects

For `~>` bodies that use `await`, capture the effect's
`AbortSignal` BEFORE any await, then pass it through to anything
that supports it (fetch, setTimeout via `AbortSignal.timeout`, etc.):

```rip
~>
  signal = getEffectSignal()                   # capture before await
  return unless @userId
  res = fetch! "/api/users/#{@userId}", {signal}
  return if signal.aborted                     # bail if disposed mid-flight
  data = res.json!
  return if signal.aborted
  @user = data
```

`getEffectSignal()` returns the AbortSignal of the currently-running
effect, or `null` if called outside an effect or before
`AbortController` is available. The signal is aborted whenever the
effect re-runs (a dependency changed) or is disposed (the owning
component is unmounting).

If you don't capture the signal, the await still runs to completion,
but the effect's cleanup-via-return-function still works — and any
post-await mutation might write to a destroyed component. The signal
is the cleanest way to bail early.

---

## 6. Gotchas

Things that have bitten us before. Each is documented at its
in-source enforcement site too, but here's the unified list.

### The bundle boundary matters

The framework bundle (`docs/dist/rip.min.js`) loads ONCE at app
startup. Anything inside it evaluates exactly once and registers its
globals (`__rip`, `__ripComponent`, `__aria`, etc.) for the page
lifetime. The widget bundle (`docs/ui/bundle.json`) loads on-demand
when a widget is referenced; each widget compiles separately.

**Do not move framework-level helpers into the widget bundle.** ARIA
helpers were once moved to `packages/ui/browser/components/_aria.rip`
to "decouple" them. Two things broke immediately:

1. `globalThis.ARIA` was undefined when widgets evaluated — the
   widget bundle is module-graph-driven; nothing imported `_aria.rip`
   so it never loaded.
2. We added `import './_aria.rip'` to 21 widgets to compensate. The
   per-widget import was fragile (a new widget contributor could
   forget) and didn't actually save bytes (it just shifted them
   between bundles).

We reverted. ARIA stays in `packages/app/index.rip` because *that
file is part of the framework bundle* — guaranteed-once evaluation,
guaranteed-globally-available. If you want to refactor a primitive
out of `index.rip`, it can move to a sibling file in `packages/app/`
**only if `scripts/build.js` is updated to include it in the
framework bundle**.

### Render-template name shadowing (fixed)

Earlier versions of the compiler treated a lowercase identifier as
an HTML tag *even when a local of the same name was in lexical
scope*. Writing `code = ex.body` then `span code` either silently
mis-routed the reference or emitted a stray `<code>` element. The
rule now matches every other lexically-scoped language: a render-
scope local shadows the HTML tag with the same name.

```rip
# Both of these now do what they look like — `code` is read as a value,
# not interpreted as the <code> HTML tag.
for ex in examples
  code = if ex.curl? then buildCurl(ex) else ex.code
  CodeBlock label: ex.label, code: code

for code in examples
  span code   # → <span>{code}</span>
```

Bindings introduced by `name = expr` and loop variables introduced
by `for x in ...` / `for x, i in ...` are both treated as lexical
locals. The shadowing only resolves within the same block factory
(loop body, conditional branch) — render locals do not currently
thread across factory boundaries the way loop variables do.

Render bindings are creation-time captures, not reactive computeds.
`code = ex.body` evaluates once when the block is built and never
re-runs, mirroring the existing semantics of `span ex.body` (also
one-shot). If you need the value to track changes, lift the
expression to a class-level `:=` / `~=` member, or read the reactive
source directly inside the DOM expression.

### Nested `for` loops can both name `i` (fixed)

The outer `for item in items` no longer auto-allocates `i` and then
collides with an inner `for v, i in ...`. The compiler now pre-scans
the loop body for explicit descendant index names and skips any name
that would clash, falling back to a mangled internal name only if
every conventional letter is taken. The patch function's parameter
list stays unique at any nesting depth.

```rip
# All of these now compile cleanly:
for item in items
  for v, i in item.options
    span "#{v}@#{i}"

for item in items
  for group in item.groups
    for v, i in group.values
      span "#{v}@#{i}"
```

(User-explicit duplicates — e.g. `for x, i in xs / for y, i in ys`
where the same `i` is bound at two nesting levels — are still a
strict-mode error. That's a real name conflict in the user's source,
not something the compiler should silently rewrite.)

### Snapshot tests are brittle

The compiler's codegen is exercised by ~50 `code "..."` snapshot
tests in `test/rip/components.rip`. Any codegen change (we did 19
snapshot updates in Wave 8a, 11 in Wave 11) requires updating those
expected outputs. The pattern of "compile this Rip → expect this
exact JS" is fragile but catches accidental codegen regressions.

When you change codegen, expect snapshot churn. Use the snapshot
auto-update script (`/tmp/update-snapshots.mjs` from the wave 8a-12
sessions) only after **manually verifying the diff is mechanical**
(your intentional change, not a behavior regression).

### No browser e2e tests

The unit test suite (`bun run test`) covers compiler codegen,
runtime semantics, schema, and server behaviors — but does NOT load
`rip.min.js` in a browser-like environment and verify the framework
runs end-to-end. We rely on:

- Snapshot tests catching codegen regressions.
- Runtime unit tests catching reactive/lifecycle regressions.
- `scripts/check-bundle-graph.js` catching bundle-composition
  regressions.
- Manual verification (loading a real app) for end-to-end behavior.

This is a real coverage gap. Refactors that touch the bundle
composition or the browser entry point should be smoke-tested by
loading an actual app.

---

## 7. When NOT to use Rip App

Honest list of where Rip App is the wrong tool:

- **Server-side rendering (SSR) or streaming.** Rip App is
  browser-first by design. There's no `renderToString`, no hydration
  protocol, no resumability. If your project's primary requirement
  is SEO-friendly server rendering, use a framework that has SSR as
  a core concern (Next.js, SvelteKit, Nuxt, SolidStart).
- **Multi-team scale.** The render DSL is unconventional enough that
  a large team will keep tripping on the conceptual model (block
  factories, fine-grained reactivity, the `@`/`:=`/`~=` keyword
  family) even after the historical tag-name and loop-index
  footguns are gone. Rip App is happiest with a small focused team
  that fits the framework's mental model in one head.
- **Plugin-ecosystem-dependent apps.** If your roadmap depends on
  "there's a library for that" — auth, charts, maps, file uploads,
  rich-text editing — the npm ecosystem around React/Vue is
  dramatically larger. Rip's first-party packages cover the basics;
  they don't cover everything.
- **TypeScript-strict shops.** Rip has its own type system with
  growing capability, but it's not yet at the maturity of TypeScript
  + a major framework's `@types/*`. If your team's correctness story
  is "TypeScript catches it," Rip is a step laterally, not forward.
- **Multiple isolated app instances on one page.** The single-stash
  / single-launch / single-`globalThis.__ripApp` model assumes one
  app per page. Multi-app embedding is possible but you'd be
  fighting the design.

For everything else — single-team browser apps, internal tools,
dashboards, documentation sites, demos, weekend projects, hobbyist
work — Rip App is genuinely competitive. The "no build step,
batteries included, drop in a script tag" pitch is real, and the
framework's lifecycle + reactive model is honestly solid.
