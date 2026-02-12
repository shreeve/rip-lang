# Web Framework Landscape: 2025–2026

> A structured comparison for evaluating the positioning of Rip UI against the
> five dominant JavaScript UI frameworks. Data gathered February 2026.

---

## Summary Matrix

| Dimension                | React 19                  | Solid.js 1.9              | Svelte 5                   | Vue 3.5                   | Angular 19–20              |
|--------------------------|---------------------------|---------------------------|-----------------------------|---------------------------|----------------------------|
| **Reactive model**       | VDOM + compiler hints     | Signals (fine-grained)    | Compiler + signals (runes)  | Proxy-based reactivity    | Signals + zone.js (legacy) |
| **Runtime size (gzip)**  | ~45 KB                    | ~7 KB                     | ~2–18 KB (scales w/ usage)  | ~27–34 KB                 | ~50–65 KB (130 KB+ fresh)  |
| **Build step**           | Required (Babel/SWC+)     | Required (Vite/Rollup)    | Required (Svelte compiler)  | Required (Vite)           | Required (Angular CLI)     |
| **Compiler**             | React Compiler (opt-in)   | Compile-time transforms   | Core design (deep compiler) | Vapor mode (in progress)  | AOT template compiler      |
| **SSR strategy**         | RSC + streaming           | SolidStart (streaming)    | SvelteKit (streaming)       | Nuxt 3 (streaming)        | Angular SSR + incremental  |
| **Hydration**            | Full (selective w/ RSC)   | Streaming progressive     | Progressive (SvelteKit)     | Lazy hydration (3.5)      | Incremental (on-demand)    |
| **Component model**      | Functions + hooks          | Functions + signals       | `.svelte` files + runes     | SFC (script/template)     | Classes → standalone fns   |
| **State management**     | External (Zustand, etc.)  | Built-in (signals/stores) | Built-in (runes)            | Built-in (ref/reactive)   | Built-in (signals) + RxJS  |
| **Maturity / ecosystem** | Dominant (60% job market) | Niche (~1.2% adoption)    | Growing (loved by devs)     | Strong (esp. APAC/EU)     | Enterprise standard        |

---

## 1. React 19+

### Core Reactive Model
**Virtual DOM with compiler-assisted optimization.** React still diffs a virtual
tree against the real DOM, but the new React Compiler (formerly React Forget)
automatically inserts memoization, eliminating most manual `useMemo`/`useCallback`.
Components re-execute on every state change — the VDOM diffing algorithm then
determines what DOM mutations to apply.

### Runtime Size
- **~45 KB** min+gzip for `react` + `react-dom`
- Server Components reduce *shipped* JS by keeping components server-side (zero
  client JS for those components), but the React runtime itself is unchanged
- Real-world production apps with Server Components: ~156 KB total JS (vs. heavier
  without RSC)

### Build Step
Required. Babel or SWC for JSX transforms, plus a bundler (Webpack, Vite, Turbopack).
React Compiler is an additional Babel plugin. Next.js/Remix abstract most of this.

### Developer Experience
- **Strengths:** Massive ecosystem (50,000+ npm packages), dominant job market (~60%
  of frontend positions), excellent tooling (React DevTools, extensive docs), Server
  Components reduce full-stack data-fetching boilerplate
- **React Compiler:** Eliminates memoization ceremony — one project removed 2,300
  lines of `useMemo`/`useCallback` after migration

### Known Pain Points
- **`useEffect` remains the #1 footgun:** Dependency array confusion, accidental
  infinite loops, race conditions, memory leaks. Developers consistently misuse it
  for data fetching, subscription management, and lifecycle events
- **Mental model complexity:** Rules of hooks (no conditionals, no loops), closure
  stale-state bugs, the server/client component boundary adds another dimension of
  mental overhead (`'use client'` directives, RSC payload format)
- **Bundle size:** Even with RSC, the base runtime is the largest among non-Angular
  frameworks. Tree-shaking doesn't reduce React's core
- **Decision paralysis:** No canonical state management, routing, or data fetching —
  developers must evaluate Zustand vs. Jotai vs. Redux vs. Recoil vs. signals
  libraries vs. context, etc.

### Component Composition
Functions returning JSX. Server Components (default) render on server, Client
Components (opt-in via `'use client'`) render on client. Props flow downward; state
is lifted or managed externally. Context API for dependency injection.

### State Management
No built-in solution beyond `useState`/`useReducer`. Ecosystem solutions dominate:
Zustand, Jotai, Redux Toolkit, Recoil. React 19 adds `useActionState` and
`useOptimistic` for form/mutation state.

### SSR / Hydration
- **React Server Components (RSC):** Components render on the server, producing a
  compact binary RSC Payload. Client components receive serialized props and hydrate.
  Server components ship zero JS to clients.
- **Streaming SSR:** HTML streams to the client progressively via `renderToPipeableStream`
- **Selective hydration:** Suspense boundaries allow React to hydrate high-priority
  components first
- **Performance:** Initial page loads improve ~38% with RSC; e-commerce cases report
  47% load time reduction
- **Limitation:** RSC is effectively a Next.js/framework feature — raw React doesn't
  provide SSR infrastructure

---

## 2. Solid.js 1.9 (2.0 Experimental)

### Core Reactive Model
**True fine-grained reactivity via signals.** Components execute once — only signal
subscriptions trigger targeted DOM updates. No virtual DOM. No diffing. No
re-rendering of component functions. Signal reads automatically create subscriptions;
signal writes trigger only the exact DOM nodes that depend on them.

### Runtime Size
- **~7 KB** min+gzip (compiler + minimal runtime)
- 3x smaller than React's initial bundle
- Near-vanilla-JS benchmark performance: scores **1.07** (vs. 1.00 for raw JS, vs.
  React's **1.71** — lower is better)

### Build Step
Required. Vite with `vite-plugin-solid` for JSX compilation. The compiler transforms
JSX into fine-grained reactive DOM operations (not virtual DOM creation).

### Developer Experience
- **Strengths:** JSX syntax familiar to React devs, signals are simple
  (`createSignal`, `createEffect`, `createMemo`), no rules-of-hooks constraints,
  components run once (easier mental model for when code executes), extreme
  performance out of the box
- **SolidStart 1.0:** Full-stack meta-framework with SSR, SSG, CSR, file-based
  routing, server functions — comparable to Next.js but for Solid

### Known Pain Points
- **Tiny ecosystem:** ~1.2% adoption (declining from 1.36%), disappeared from 2025
  Stack Overflow survey. Few UI component libraries, limited third-party integrations
- **Bus factor:** 1,592 of 1,592 commits from Ryan Carniato; second contributor has
  33. Entire project depends on one person
- **Code quality concerns:** 204 `@ts-expect-error`/`@ts-ignore` annotations,
  `type TODO = any` at the core of the signal system (persisted 4+ years)
- **Hot reload instability:** Regular crashes requiring dev server restarts
- **Job market:** Negligible hiring demand
- **Solid 2.0 is experimental:** Breaking changes to reactivity, SSR, and hydration
  are in progress. No release date. SolidStart 2.0 (Vite-native) is also being
  rebuilt from scratch

### Component Composition
Functions returning JSX (same syntax as React). Components execute once — the return
value is the actual DOM. Control flow via `<Show>`, `<For>`, `<Switch>` components
(not JS conditionals, because the function body doesn't re-execute).

### State Management
Built-in and first-class:
- `createSignal()` — atomic reactive value
- `createStore()` — nested reactive objects (Proxy-based)
- `createResource()` — async data with Suspense integration
- `createMemo()` — derived computations
No need for external state libraries in most cases.

### SSR / Hydration
- **SolidStart:** Streaming SSR with progressive hydration
- **Islands architecture:** Partial hydration possible via Astro integration
- **Performance:** Among the fastest SSR implementations due to no VDOM overhead
- **Limitation:** SolidStart is less battle-tested than Next.js/Nuxt; the Vinxi
  foundation is being replaced with pure Vite in SolidStart 2.0

---

## 3. Svelte 5

### Core Reactive Model
**Compiler-first with signal-like runes.** The Svelte compiler transforms `.svelte`
files into imperative DOM operations at build time. Svelte 5 introduces "runes" — a
signal-based reactivity system using `$state`, `$derived`, `$effect` — replacing the
implicit `let`-based reactivity of Svelte 4.

Key runes:
- `$state(value)` — reactive state (backed by Proxy)
- `$state.raw(value)` — reactive but non-deep (no Proxy)
- `$derived(expr)` — computed value, auto-tracks dependencies
- `$effect(() => ...)` — side effect that re-runs on dependency changes

### Runtime Size
- **~2–18 KB** depending on features used (compiler includes only what's needed)
- Svelte 5 achieves **up to 50% smaller bundles** vs. Svelte 4
- Production dashboard benchmark: 47 KB total JS (vs. React's 156 KB for identical
  functionality)
- The "disappearing framework" ideal is partially preserved — but Svelte 5 now ships
  a small runtime for the reactivity system

### Build Step
Required. The Svelte compiler is the core of the framework — `.svelte` files are not
valid JavaScript. SvelteKit uses Vite as the build tool.

### Developer Experience
- **Strengths:** Minimal boilerplate, single-file components with scoped CSS, runes
  provide explicit reactivity that works outside `.svelte` files (in `.svelte.js` and
  `.svelte.ts`), excellent tutorial/documentation, SvelteKit is batteries-included
- **Performance:** Fastest initial render in benchmarks (110ms vs. Vue 142ms vs.
  React 178ms), lowest memory footprint (7.9 MB idle vs. React's 18.7 MB)

### Known Pain Points
- **Runes add complexity:** Three state runes (`$state`, `$state.raw`,
  `$state.snapshot`) force choices that didn't exist before. Proxy-based state has
  non-obvious performance implications
- **Loss of "magic" simplicity:** Svelte 4's `let x = 0` reactivity was beloved for
  its simplicity. Runes feel more like "React hooks but for Svelte" to some devs
- **Store deprecation:** The transparent, simple store system is deprecated in favor
  of runes. Stores and runes have subtly different reactivity models that don't fully
  interoperate
- **Runtime shift:** Svelte now ships actual runtime code for reactivity, moving away
  from the pure "compile-away-the-framework" philosophy
- **Custom component format:** `.svelte` files are not standard JS — requires tooling
  for every editor, linter, formatter, and build pipeline
- **Smaller ecosystem than React/Vue:** Fewer component libraries, less hiring demand

### Component Composition
Single-file `.svelte` components with `<script>`, markup, and `<style>` sections.
Props via `$props()` rune. Slots for content projection. Snippets (new in Svelte 5)
for reusable template fragments.

### State Management
Built-in via runes:
- `$state` for component-local and shared state
- `$derived` for computed values
- `$effect` for side effects
- Shared state via `.svelte.js` modules (exportable reactive state)
- Legacy stores still work but are deprecated

### SSR / Hydration
- **SvelteKit:** Full-featured meta-framework with streaming SSR, SSG, ISR
- **Progressive hydration:** Components hydrate as needed
- **Load functions:** Data fetching runs on server, serialized to client
- **Adapter system:** Deploy to Node, Vercel, Cloudflare, static, etc.
- **Performance:** Excellent — small JS payloads mean fast hydration

---

## 4. Vue 3.5+

### Core Reactive Model
**Proxy-based reactivity system.** Vue uses JavaScript Proxies to intercept
property access and mutation on reactive objects. When a reactive property is read
during a component's render, Vue tracks it as a dependency. When the property changes,
Vue re-renders only the affected components.

Key primitives:
- `ref(value)` — reactive wrapper (access via `.value`)
- `reactive(object)` — deep reactive proxy
- `computed(() => ...)` — cached derived value
- `watch()` / `watchEffect()` — explicit side effects

**Vapor Mode** (in development for Vue 3.6): A new compilation strategy that
eliminates the Virtual DOM entirely, generating direct DOM-update code similar to
Solid.js. Same developer-facing API, different compilation output.

### Runtime Size
- **~27–34 KB** min+gzip (official: ~27 KB runtime, reported in benchmarks as ~34 KB)
- Vue 3.5: 56% memory usage improvement, 10x faster for large reactive arrays
- Vapor Mode (when stable) will further reduce overhead by removing VDOM diffing code

### Build Step
Required. Vite (created by Vue's author, Evan You) is the standard build tool.
Single-file components (`.vue`) require the Vue compiler.

### Developer Experience
- **Strengths:** Best learning curve among major frameworks, excellent documentation,
  Composition API offers React-hooks-like composability without the footguns,
  progressive adoption (can use Options API or Composition API), strong TypeScript
  integration
- **Nuxt 3:** Mature meta-framework with auto-imports, file-based routing, server
  routes, excellent DX

### Known Pain Points
- **`.value` ceremony:** `ref()` requires accessing `.value` in script but not in
  templates — a persistent source of confusion
- **Two API styles:** Options API vs. Composition API creates ecosystem fragmentation;
  tutorials/libraries may use either
- **Vapor Mode delays:** Originally planned for Vue 3.4, now expected in 3.6+.
  Compatibility challenges have pushed the timeline repeatedly
- **Enterprise adoption gaps:** Strong in APAC/EU design-led markets but limited
  hiring pools in US enterprise compared to React/Angular
- **Ecosystem size:** Large but smaller than React's — fewer choices in some niches

### Component Composition
Single-file `.vue` components with `<script setup>`, `<template>`, and `<style>`
sections. `<script setup>` is the modern default — top-level bindings are
automatically exposed to the template. Props via `defineProps()`, events via
`defineEmits()`. Slots for content projection.

### State Management
Built-in reactivity is often sufficient:
- `ref()` / `reactive()` for local/shared state
- `computed()` for derived values
- `provide` / `inject` for dependency injection
- **Pinia** (official) for complex global state — simple, TypeScript-native, devtools
  integration
- Vue 3.5+ SSR: `useId()` for hydration-safe unique IDs

### SSR / Hydration
- **Nuxt 3:** Full-featured meta-framework (SSR, SSG, ISR, hybrid rendering)
- **Lazy hydration (Vue 3.5):** Components can defer hydration until needed
- **Streaming SSR:** Supported via Nuxt 3 + `renderToWebStream`
- **`useId()`:** Stable hydration-safe IDs for accessibility and form elements
- **Performance:** Good — smaller runtime means less JS to hydrate

---

## 5. Angular 19–20

### Core Reactive Model
**Signals (new) + Zone.js change detection (legacy).** Angular is transitioning from
Zone.js-based change detection (monkey-patches all async APIs to trigger global
change detection) to a granular Signals-based system.

Signal primitives:
- `signal(value)` — writable reactive value (`.set()`, `.update()`)
- `computed(() => ...)` — read-only derived signal
- `effect(() => ...)` — side effect (stabilized in Angular 20)
- `linkedSignal()` — signal linked to a source (stabilized in Angular 20)

**Zoneless** (Developer Preview in Angular 20): Removes Zone.js entirely, relying
on Signals for change detection. Cleaner stack traces, smaller bundles, better
compatibility with third-party code.

### Runtime Size
- **~50–65 KB** gzipped for core framework
- Fresh "Hello World" project: **130–138 KB+** min+gzip
- Removing Zone.js (zoneless) reduces this, but Angular remains the heaviest framework
- FCP: 400–800 ms (vs. Vue's 150–300 ms, React's ~300 ms)

### Build Step
Required. Angular CLI with Webpack or esbuild. AOT (Ahead-of-Time) template
compilation is the default — templates are compiled to optimized JS at build time.
Strict project structure enforced by the CLI.

### Developer Experience
- **Strengths:** Opinionated "batteries-included" framework (routing, forms, HTTP,
  i18n, testing all built-in), excellent for large teams with enforced patterns,
  strong TypeScript integration (TypeScript is required, not optional), dependency
  injection is powerful for enterprise architecture
- **Angular 19–20 improvements:** Standalone components as default (no more
  NgModules), Signals stabilized, resource API for async data, better DevTools

### Known Pain Points
- **Boilerplate:** Even with standalone components, Angular requires more ceremony
  than alternatives. Decorators, metadata, DI registration
- **Change detection confusion:** `ExpressionChangedAfterItHasBeenCheckedError`
  produces stack traces pointing to framework code, not developer code. This error
  has been a top Angular complaint for years
- **Bundle size:** Largest runtime of all major frameworks. Zone.js adds ~35 KB alone
- **Learning curve:** Steepest of all frameworks. New hires struggle for months.
  RxJS adds another learning dimension on top of Signals
- **Two reactive paradigms:** RxJS Observables and Signals now coexist, creating
  confusion about when to use which. `toSignal()` / `toObservable()` bridge the gap
  but add complexity
- **DI runtime errors:** "No provider for X!" errors are common and hard to debug

### Component Composition
Standalone components (Angular 19+ default) — no NgModule required. Components are
TypeScript classes with decorators. Templates use Angular's own syntax (`@if`, `@for`,
`@switch` — new control flow in Angular 17+). Content projection via `<ng-content>`.
Directives for cross-cutting behavior.

### State Management
Built-in (increasingly):
- Signals for synchronous reactive state
- RxJS for async streams (legacy but deeply embedded)
- Services + DI for shared state
- **NgRx** (Redux-like) for complex enterprise state — being updated for Signals
- **Resource API** (Angular 19+) for async data fetching with Signals integration

### SSR / Hydration
- **Angular SSR:** Built-in (formerly Angular Universal), now tightly integrated
- **Incremental hydration:** Components stay dehydrated until triggered. Triggers:
  `viewport`, `interaction`, `idle`, `timer(ms)`, `immediate`, `never`,
  `when(condition)`
- **`@defer` blocks:** Lazy-load components with built-in hydration trigger syntax
- **Event replay:** User interactions during SSR are captured and replayed after
  hydration (Angular 18+)
- **Performance:** Incremental hydration significantly improves FID and CLS, but
  larger initial bundle still creates overhead vs. lighter frameworks

---

## Cross-Cutting Analysis

### The Convergence Toward Signals

Every major framework is converging on signal-based reactivity:

| Framework | Signal Implementation              | Status           |
|-----------|------------------------------------|------------------|
| Solid.js  | Pioneered the pattern              | Stable (1.x)     |
| Angular   | `signal()`, `computed()`, `effect()` | Stable (v20)   |
| Vue       | `ref()`, `reactive()`, `computed()` | Stable (v3.0+) |
| Svelte    | `$state`, `$derived`, `$effect`    | Stable (v5)      |
| React     | No signals — VDOM + Compiler       | Divergent path   |

React is the outlier. Every other framework has adopted signals (or signal-like
reactivity). React's response is the React Compiler — automating VDOM optimizations
rather than changing the reactive model.

### The Compiler Spectrum

Frameworks sit on a spectrum from pure runtime to pure compiler:

```
Pure Runtime ←——————————————————————————→ Pure Compiler
   React          Vue         Angular        Svelte        (Solid)
   (VDOM +     (Proxy +     (AOT +       (Compiler +     (Compiler +
   Compiler     future       template      runes          signals,
   hints)       Vapor)       compile)      runtime)       minimal RT)
```

- **React:** Mostly runtime. Compiler adds optimization hints but doesn't change
  the execution model.
- **Vue:** Runtime reactivity. Vapor Mode will add a compiler path that bypasses VDOM.
- **Angular:** AOT template compilation + runtime change detection. Signals are
  reducing runtime overhead.
- **Svelte:** Deep compiler, but Svelte 5 added a signal runtime. Shifting right
  to left.
- **Solid:** Compiler transforms JSX to fine-grained DOM ops. Minimal runtime (~7 KB).

### Where the Gaps Are (Opportunities for Rip UI)

1. **No framework has unified the server/client model cleanly.** React's RSC is the
   most ambitious attempt but creates a two-world problem (`'use client'` directives,
   different rules for each). Every other framework punts to a meta-framework (Nuxt,
   SvelteKit, SolidStart).

2. **Reactivity is powerful but each flavor has ergonomic costs.** React's hooks have
   rules and footguns. Vue's `.value` is a papercut. Svelte's runes added complexity.
   Angular's Signals coexist awkwardly with RxJS. Solid's signals are elegant but the
   JSX control flow (`<For>`, `<Show>`) is a compromise.

3. **Bundle size vs. DX is an unresolved tension.** Svelte and Solid ship tiny bundles
   but require custom file formats or component-level conventions. React and Angular
   are heavy but offer familiar JS/TS ergonomics.

4. **State management is fragmented.** React has no built-in solution (dozens of
   competing libraries). Vue/Svelte/Solid have built-in primitives but each with
   quirks. Angular has two competing paradigms (RxJS + Signals).

5. **Hydration is still a problem everyone is solving differently.** Full hydration
   (wasteful), progressive hydration (complex), incremental hydration (Angular's
   approach), resumability (Qwik's approach). No consensus, each with trade-offs.

6. **TypeScript integration varies.** Angular requires it. React/Vue/Svelte support
   it but with varying degrees of type inference quality (Svelte's compiler and Vue's
   SFC templates are harder to type-check than plain TSX).

7. **Custom file formats create tooling tax.** `.svelte`, `.vue`, `.astro` files
   each need custom language server support, linter plugins, formatter configs. Plain
   `.js`/`.ts` (React, Solid) avoid this at the cost of less framework-level
   optimization.

### Performance Benchmarks (JS Framework Benchmark, 2025)

| Framework    | Score (lower = faster) | Startup (ms) | Memory (MB) |
|-------------|------------------------|-------------|-------------|
| Vanilla JS  | 1.00                   | —           | —           |
| Solid.js    | 1.07                   | 28          | ~8          |
| Svelte 5    | ~1.10                  | 35          | ~8          |
| Vue 3       | ~1.30                  | 42          | ~11         |
| React 19    | 1.71                   | 55          | ~19         |
| Angular 19  | ~1.80+                 | 78          | ~22         |

---

## Positioning Questions for Rip UI

Based on this landscape, a new framework should be prepared to answer:

1. **Reactive model:** Signals, VDOM, compiler-generated, or something new? The
   industry has nearly converged on signals — deviating needs a strong argument.

2. **Compiler depth:** How much work happens at build time vs. runtime? The trend is
   toward more compilation, but each compiler approach creates tooling complexity.

3. **Runtime weight:** Can you beat Solid's 7 KB? Can you approach zero-runtime like
   original Svelte promised? What's the minimum viable runtime?

4. **Server integration:** Is the server/client boundary a first-class concept? Can
   it avoid the `'use client'` / meta-framework split that plagues React?

5. **Hydration strategy:** Full, progressive, incremental, resumable, or none? This
   is the current frontier of framework innovation.

6. **File format:** Custom (`.svelte`, `.vue`) or standard JS/TS? Custom formats
   enable deeper optimization but impose ecosystem costs.

7. **State management:** Built-in or ecosystem? Every framework that delegated this
   to the ecosystem (React) regrets it. Every framework with built-in state must
   balance simplicity with power.

8. **TypeScript story:** First-class types? Type inference quality? Can the framework
   provide better type safety than existing options?

9. **Migration story:** Can React/Vue/Svelte developers adopt incrementally, or is it
   all-or-nothing?

10. **What's the one thing you can do that none of them can?** Every successful
    framework had a clear differentiator: React had the VDOM (2013), Vue had
    progressive adoption (2014), Svelte had compile-away-the-framework (2019),
    Solid had true fine-grained reactivity (2021), Qwik had resumability (2023).
