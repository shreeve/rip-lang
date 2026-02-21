# Rip UI — Roadmap

## What's There

### Core Reactive System
- **Reactive primitives** — `:=` (state), `~=` (computed), `~>` (effects) as
  language syntax. Fine-grained dependency tracking, batching, readonly (`=!`).
- **`__Component` base class** — mount, unmount, context push/pop, constructor
  lifecycle all handled in the runtime. Components just override `_init`.
- **`__state` signal passthrough** — if a value is already a signal, `__state`
  returns it as-is. No separate `isSignal` check needed.
- **Fine-grained DOM** — `_create` builds real DOM nodes, `_setup` wires
  reactive effects that update individual text nodes and attributes.
- **Timing primitives** — `delay`, `debounce`, `throttle`, `hold` as small
  user-space functions composing `:=` + `~>` + cleanup. No framework API.

### Component Model
- **Component composition** — PascalCase identifiers in render blocks
  instantiate child components. `card.rip` → `Card`. App-scoped, lazy-compiled,
  cached after first use. No imports needed.
- **Reactive props** — parent passes `:=` signals directly to children.
  Child's `__state` passthrough returns the signal as-is. Two-way binding.
- **Readonly props** — `=!` for props that children can read but not write.
- **Children blocks** — `Card title: "Hello" -> p "content"` passes children
  as a DOM node via the `@children` slot. `#content` for layout slots.
- **Unmount cascade** — parent tracks child instances in `_children`.
  `unmount()` cascades depth-first.
- **Conditional rendering** — `if`/`else` in render blocks with anchor-based
  conditional DOM.
- **List rendering** — `for item in items` with keyed reconciliation.
- **Event handling** — `@click: method` binds to `this.method` correctly.
- **CSS classes** — `div.counter.active` compiles to static className.
  Dynamic classes via `__clsx(...)`.
- **Context** — `setContext`/`getContext`/`hasContext` for sharing data
  between ancestor and descendant components without prop drilling.
- **Lifecycle hooks** — `mounted`, `unmounted` work. `beforeMount`,
  `beforeUnmount` are recognized.

### State & Routing
- **Reactive stash** — shared reactive store with proxy-based access.
- **File-based router** — URL-to-component mapping with params, guards,
  layouts, `_navigating` signal, keep-alive component cache.
- **Hash routing** — `launch '/app', hash: true` for static single-file
  deployment. Uses `readUrl()`/`writeUrl()` helpers. Back/forward and
  direct URL loading work correctly.
- **State persistence** — `persist: true` enables debounced auto-save of
  `app.data` to sessionStorage. `_writeVersion` signal + `beforeunload` safety.
- **Error boundaries** — catch mount-time errors.

### Infrastructure
- **Component store** — in-memory `.rip` file storage with compilation cache
  and file watchers for hot reload via SSE.
- **`launch bundle:`** — inline all components as heredoc strings in a single
  HTML file. Zero-server deployment. `docs/demo.html` is a 337-line example.
- **Combined bundle** — `rip-ui.min.js` (~52KB Brotli) packages the compiler
  and pre-compiled UI framework in one file. Eliminates the `ui.rip` fetch
  and its runtime compilation. `importRip('ui.rip')` is intercepted and returns
  the pre-compiled module instantly.
- **Parallel loading** — Monaco Editor preloaded via `<link rel="preload">`,
  compiler exports available instantly via `globalThis.__ripExports`. All
  synchronous setup runs in parallel with the Monaco CDN fetch.
- **FOUC prevention** — playground pages use `body { opacity: 0 }` with a
  `body.ready` fade-in transition after full initialization.
- **Runtime deduplication** — both runtimes register on `globalThis.__rip`
  and `globalThis.__ripComponent`. Multiple compilations share one runtime.
- **Smooth app launch** — container fades in after first mount + font load.
- **Navigation anti-flicker** — `_navigating` uses `delay 100` to suppress
  brief loading indicators.

---

## Where Rip UI Wins

1. **Simplicity of the reactive model.** Three operators, minimal complete set. No hooks rules, no dependency arrays, no `.value` papercuts.
2. **Zero-build development.** No other framework runs entirely in the browser with zero build tooling.
3. **Timing primitives from composition.** `delay`, `debounce`, `throttle`, `hold` prove architectural correctness — hard problems dissolve into small functions.
4. **Effect cleanup design.** Returning a function from an effect for cleanup is the cleanest pattern across all frameworks.
5. **Syntax over API.** `:=` beats `ref()`. `~=` beats `computed()`. `~>` beats `watchEffect()`. Less ceremony, same power.
6. **Static deployment.** Hash routing + `launch bundle:` = full SPA in a single HTML file on any static host.

## Where Others Win

1. **Ecosystem.** Zero component libraries, zero third-party integrations, zero community packages.
2. **SSR.** No server-side rendering means no SEO, no progressive enhancement.
3. **Performance proof.** No benchmarks, no published numbers.
4. **TypeScript depth.** Framework exports have no `.d.ts` files.
5. **Tooling.** No DevTools extension, no CLI scaffolding.
6. **Battle-testing.** React serves billions. We serve a demo app.

---

## The Path Forward

### Must-have (blocks adoption)
1. Named slots — multiple content projection points (header, body, footer)
2. Framework `.d.ts` files — TypeScript definitions for all exports

### Should-have (competitive parity)
3. AOT compilation path — component-level ahead-of-time for production (framework AOT done in v0.3.2)
4. SSR — server rendering for SEO
5. js-framework-benchmark — published performance numbers
6. Keyed list reconciliation — optimized array diffing for large datasets

### Nice-to-have (ecosystem growth)
7. DevTools extension — visual component/state inspector
8. `create-rip-app` CLI — project scaffolding
9. Headless UI primitives — accessible dropdown, modal, dialog
10. State-preserving HMR — keep reactive state during hot reload
11. Scoped slots and teleport — advanced composition patterns

---

## Known Caveats

- **`getCompiled`/`setCompiled` cache modules, not JS strings.** Same source
  at two paths = two cached modules. No deduplication across paths.
- **Stash proxy missing `getOwnPropertyDescriptor` trap.** Works in practice
  but could cause issues with `Object.keys`/spread in strict environments.
- **Router regex recreated on every `buildRoutes` call.** Not a problem with
  small route tables. Could optimize with fingerprint comparison.
- **`router.current` creates a new object on every read.** A cached object
  that updates inside batch would reduce garbage.
- **REPL reactive state doesn't persist across `rip()` calls.** Each call is
  a separate compilation. All reactive code must be in a single call.
- **Hash routing and path routing are mutually exclusive.** Set once at
  `launch` time. No runtime switching between modes.
