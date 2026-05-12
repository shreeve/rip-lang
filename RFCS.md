# Rip RFCs

Design proposals under discussion. Grouped by domain and ordered within each domain by landing dependency — RFC N+1 generally assumes RFC N has landed, but cross-domain RFCs are independent unless their text says otherwise.

## Domain A — Type system & package types

- [RFC 1 — Explicit prop optionality with `?::`](#rfc-1-explicit-prop-optionality-with-)
- [RFC 2 — Rip packages exposing types to typed Rip apps](#rfc-2-rip-packages-exposing-types-to-typed-rip-apps)
- [RFC 3 — App framework types for ambient globals](#rfc-3-app-framework-types-for-ambient-globals)
- [RFC 4 — Typed component `this` shape](#rfc-4-typed-component-this-shape)
- [RFC 5 — Typed server handler `this` shape](#rfc-5-typed-server-handler-this-shape)

## Domain B — Runtime delivery & ergonomics

- [RFC 6 — Trim and align the `@rip-lang/app` global surface](#rfc-6-trim-and-align-the-rip-langapp-global-surface)
- [RFC 7 — Routing ergonomics](#rfc-7-routing-ergonomics)

## Domain C — Compiler / reactivity

- [RFC 8 — Tracking property accesses on `for`-loop iteration variables](#rfc-8-tracking-property-accesses-on-for-loop-iteration-variables)

---

## RFC 1: explicit prop optionality with `?::`

**Status:** Pending discussion — not yet implemented. Documenting the design for review.

**Why this is the first RFC.** RFC 1 is foundational because every later RFC that authors types in `.rip` source — RFC 2 (package annotations), RFC 3 (framework annotations), RFC 4 / RFC 5 (synthesized `this` types) — will write optional fields on options objects (`launch hash?:: boolean`, `createResource opts?:: ResourceOpts`). Landing `?::` second means writing those annotations twice — once with `:: boolean | undefined := undefined` workarounds, once with `?::` after migration. Removing the broken type-suffix operators (`T?`, `T??`, `T!`) at the same time keeps the spec clean for everything that follows.

**Problem:** Today, optionality is determined solely by whether a prop has a default value (`:=`). There is no way to declare an optional prop with no default value. The common pattern `@label:: string := null` doesn't actually type-check in a strict project — `rip check` reports `Type 'null' is not assignable to type 'string'`. Workarounds exist (`@label:: string := ""`, `@label:: string | undefined := undefined`, widening the type to `any`), but none of them say what we actually mean: "optional, no default." `@label?:: string` should be the natural spelling. (`| null` is semantically wrong here; TypeScript's `?` adds `undefined` to the union, not `null`. `null` means "explicitly set to nothing," while `undefined` means "not provided" — optional props are the latter.)

**Proposed syntax — three prop forms:**

```coffee
# Typed
@variant:: 'primary' | 'secondary'                 # required
@shape?:: 'rounded' | 'pill' := 'rounded'          # optional, has default
@label?:: string                                   # optional, no default

# Untyped (unchanged — no breaking change here)
@variant                                           # required
@shape := 'rounded'                                # optional, has default
```

**Key design decisions:**

1. `?` on the prop name is the **sole optionality marker** (like TypeScript's `prop?: type`)
2. `:=` only assigns a default value — it no longer implies optionality
3. `@prop:: type := val` without `?` would technically become **required with a default** — the caller must pass it, but it has a fallback value. This is valid TypeScript but rare in practice; it's called out here because it's what the current `@prop:: type := val` syntax means today, and the migration would convert most of these to `@prop?:: type := val`

**DTS output:**

```typescript
// @variant:: 'primary' | 'secondary'
variant: 'primary' | 'secondary'           // required

// @shape?:: 'rounded' | 'pill' := 'rounded'
shape?: 'rounded' | 'pill'                 // optional

// @label?:: string
label?: string                             // optional
```

**Remove type suffixes (`T?`, `T??`, `T!`):**

The design doc (`docs/RIP-TYPES.md`) describes three type suffix operators:

- `T?` → `T | undefined`
- `T??` → `T | null | undefined`
- `T!` → `NonNullable<T>`

These should be removed from the spec. They are documented but effectively non-functional in the contexts users reach for. The relevant rewrite logic lives in `expandSuffixes()` in `src/dts.js` (called from 17 sites), but the lexer strips trailing `?` and `!` from identifier-position tokens before they reach DTS emission — so `x:: string? = …` declares `let x: string;` and `x:: string?? = …` produces the malformed `let y: string ??;`. Even inside parameter parens the suffixes typically parse as the `?`/`!` operators rather than type modifiers. They add no value beyond syntactic sugar for things already expressible with unions (`string | undefined`, `string | null | undefined`) and built-in utility types (`NonNullable<T>`). Removing them simplifies the `?` story: `?` only ever means "optional" (on a prop name or structural type property), never "value may be undefined."

**Breaking change impact:**

- **Runtime-equivalent migration.** `@prop:: type := val` and `@prop?:: type := val` compile to the same JS — both emit `let prop = props.prop ?? val`. The difference is purely in the type contract: without `?` the caller must pass the prop (even though the default would still apply at runtime); with `?` the caller may omit it. So the migration is a type-system fix, not a behavior change.
- **279 typed prop lines** (`@prop:: type := val`) across the repo would need `?` added → `@prop?:: type := val`
- **89 untyped prop lines** (`@prop := val`) — completely unaffected
- Concentrated in `packages/ui/browser/` (177) and `packages/ui/email/` (71); the rest scattered across `examples/` (15) and `test/` (16). `apps/` has zero typed prop lines today.
- Mechanical fix: single regex find-and-replace across the repo

**Implementation notes:**

- The lexer's predicate handler (`src/lexer.js` lines 664-668) already strips `?` from identifiers and sets `data.predicate = true`
- This flag survives through the parser to s-expressions via `new String(val)` + `Object.assign` in the parser adapter (`src/compiler.js` lines 4203-4210; mirrored in `src/schema/schema.js` lines 1641-1644)
- `data.predicate` is already consumed in 8 places: `src/types.js` (lines 489, 494), `src/components.js` (lines 578, 580), `src/dts.js` (line 359), and `src/schema/schema.js` (lines 544, 1473, 1677). Optionality should reuse this same flag on the prop name.
- Remove the suffix branches from `expandSuffixes()` in `src/dts.js` (the `::` → `:` substitution stays — it's load-bearing); also strip the now-unused suffix expansions and update the 17 call sites accordingly
- Remove the Optionality Modifiers section from `docs/RIP-TYPES.md` and the corresponding sigil table entries (`?`, `??`, `!`)
- Rename `data.predicate` → `data.optional` across lexer/compiler/types/schema — the current name is a CoffeeScript holdover for "predicate methods" (`empty?` → `isEmpty`); the comments at `src/lexer.js` lines 27, 523, 665 still describe that convention, but no `isEmpty` rewrite exists anywhere in the compiler. The flag is only used for existence checks and optionality.

### Relationship to other RFCs

Foundation for every later type-authoring RFC. RFCs 2, 3, 4, 5, and 6 all write `?::` in either user-authored annotations or compiler-synthesized DTS. Independent of RFCs 7 and 8.


## RFC 2: Rip packages exposing types to typed Rip apps

While working on the cart example, only the client is fully type-safe. The root `index.rip` and `api/` routes are currently excluded from `rip check` (via `rip.json`), because type-checking them would require the two server packages they depend on — `@rip-lang/server` and `@rip-lang/server/middleware` — to be typed as well. Neither is.

This is the first time we've hit the question of how Rip packages should expose types to typed Rip apps that consume them. Whatever we pick here becomes the convention for every future Rip package (`@rip-lang/db`, `@rip-lang/ui`, etc.), so it's worth thinking through.

Three approaches were considered. Types in Rip are entirely optional, so any solution has to handle both typed and untyped authors and consumers in any combination.

### Option 1 — annotated source (recommended)

Type contracts live inline in the `.rip` source via `::` annotations. The existing `compileForCheck` pipeline strips annotations for runtime and emits `.d.ts` for type consumers on demand.

**Pros:** one file, one source of truth. Drift is impossible by construction. Consistent with Rip's "types are gradual in the same file" promise — applies that promise at the package boundary too. Untyped packages still work (consumers see `unknown`/`any`, same as untyped JS deps). Same rule for every Rip package in the ecosystem.

**Cons:** Rip's annotation syntax has to be expressive enough for hard cases (`this:` parameters on function-type aliases, validator-driven overloads). If a gap exists, fixing the type system becomes part of this work. Annotated runtime files are denser to read than plain ones.

### Option 2 — sidecar `.rip` file

Runtime stays in `api.rip`; types live in a separate `api.types.rip` (or similar) that the toolchain merges into the same virtual module.

**Pros:** runtime files stay clean. Types and runtime can evolve independently. Still written in Rip, still goes through the existing pipeline.

**Cons:** two files to keep in sync by hand — silent drift is the failure mode. Wiring (how does the type checker know to merge them?) needs new pipeline support. Doesn't solve npm publishing — consumers without the Rip toolchain still need an emitted artifact. Two files per package becomes the convention.

### Option 3 — hand-written `.d.ts`

Author maintains a `.d.ts`, wired in via `package.json` `"types"`. Standard TS pattern.

**Pros:** zero coupling — the `.d.ts` IS the contract. Standard, well-understood by every TS user and tool. npm-friendly out of the box. Avoids any expressiveness gaps in Rip's annotation syntax (TS already covers everything we need).

**Cons:** hand-sync drift in the worst form — types and runtime in two languages. Breaks the "you write Rip" promise inside Rip packages. Reviewers must read both files to understand a change. Doesn't dogfood the Rip type pipeline at all.

### Why Option 1

The drift argument that pushes toward 2 and 3 turns out to be wrong: drift only happens when types and runtime are *separate*. With annotated source they're physically the same source, so drift is impossible by construction.

The expressiveness concern is real, but it's the right concern to confront. Every package shipping a hand-written `.d.ts` is a vote of no confidence in the Rip pipeline. If `this:` parameters on function-type aliases don't work yet, the answer is to make them work — once — and the whole ecosystem benefits.

The convention this establishes is a single, defensible rule:

> Every Rip package's `.rip` source IS its type contract. If a package wants to expose types, it annotates its exports. The Rip toolchain produces `.d.ts` from those annotations on demand. There is no separate types file, no module augmentation, and no hand-written TypeScript anywhere in the source tree.

That rule scales from a one-file untyped package to a deeply-typed framework, and it's the same rule for `@rip-lang/server`, `@rip-lang/db`, `@rip-lang/ui`, and user app code.

### Relationship to other RFCs

Depends on RFC 1 (annotations use `?::` for optional fields). Mechanism re-used by RFCs 3, 4, 5, 6.


## RFC 3: App framework types for ambient globals

RFC 2 covers packages that consumers reach via `import` — `@rip-lang/server`, `@rip-lang/db`, etc. The Rip App framework is a different shape. Its public API — `createResource`, `createComponents`, `createRouter`, `createRenderer`, `launch`, `delay`, `debounce`, `throttle`, `hold`, `stash`, `raw`, `isStash`, `persistStash`, `setContext`, `getContext`, `hasContext` (thirteen framework-authored exports plus three context helpers re-exported from the component runtime, sixteen total) — is exposed as **ambient globals** in the browser, registered onto `globalThis` by the build script when `rip.min.js` loads. Untyped consumers just write `createResource ...` with no import line. That's a deliberate part of the framework's "no build step" promise: a `<script src="rip.min.js">` tag plus a few `<script type="text/rip">` blocks is a complete app.

The problem: today these globals have **no types**. A typed component file that calls `createResource` fails `rip check` with `TS2304: Cannot find name 'createResource'`. Useful framework helpers — and the natural touch points for typed app code — are exactly the ones the type checker can't see.

A note on terminology before the proposal: **Rip's type pipeline is virtual end-to-end.** `compileForCheck` invokes the compiler with `types: 'emit'`, which returns `result.dts` as an in-memory string. That string is prepended to the shadow TS source and handed to the TypeScript language service via `getScriptSnapshot`. **No `.d.ts` file is ever written to disk.** Nothing in `node_modules`, nothing in the package, nothing in the repo. When this RFC mentions "DTS" it means a virtual in-memory string, not a file artifact.

### Proposal — typed apps use explicit imports; the bundle still exposes globals

Three pieces, in order of how they compose:

1. **Annotate `packages/app/index.rip`.** Add `::` type annotations to the framework's public exports — `createResource`, `createComponents`, `createRouter`, `createRenderer`, `launch`, `delay`, `debounce`, `throttle`, `hold`, the stash helpers (`stash`, `raw`, `isStash`, `persistStash`), and the context helpers (`setContext`, `getContext`, `hasContext`). This is the same Option-1 mechanism from RFC 2, applied to the app framework. The framework's `.rip` source becomes the type contract.

2. **Resolve `@rip-lang/app` like any other typed Rip package.** When `typecheck.js` sees `import { createResource } from '@rip-lang/app'` in a typed `.rip` file, it reaches the package via the same path it would use for `@rip-lang/server` or `@rip-lang/db` (RFC 2's mechanism): run `compileForCheck` against the package's annotated `.rip` entry, cache the resulting DTS in memory, hand it to the TS language service through the import specifier. No new resolution path, no auto-detection, no policy list.

3. **Extend the browser compiler to rewrite `@rip-lang/*` import specifiers to global access.** The renderer already has a regex sweep (`ripImportRe`) that rewrites `.rip` imports to Blob URLs. Extend that pass to recognize `import { x } from '@rip-lang/app'` and rewrite to `const { x } = globalThis;` (or the equivalent destructuring) at compile time. The runtime behavior is identical to today — the binding still resolves to whatever the bundle put on `globalThis` — but the import line gives the type checker a real edge to follow.

The result: typed code looks like this —
```rip
import { createResource } from '@rip-lang/app'

export Products = component
  products =! createResource ->
    res = fetch! '/api/products'
    res.json!
```
…and untyped code keeps looking like today —
```rip
export Products = component
  products =! createResource ->
    res = fetch! '/api/products'
    res.json!
```
At runtime, both compile to the same JS that reads `createResource` from `globalThis`. The import line is purely a type-checker hook.

**Pros:**
- One mechanism for the whole language. Types cross package boundaries through imports, period. No special "ambient" pipeline in the type checker.
- Reuses RFC 2's machinery directly. No new resolution path, no detection heuristic, no policy list of "auto-injected packages."
- Discoverable. `import { createResource } from '@rip-lang/app'` tells the reader exactly where the API lives. Editor go-to-definition, find-references, and `grep` all work.
- Aligns the framework with every other Rip package. `@rip-lang/server`, `@rip-lang/db`, `@rip-lang/ui` are imported; `@rip-lang/app` becomes consistent with them, not the special case.
- Forward-compatible. If framework globals are ever retired in favor of imports, or restructured into a namespace, there's nothing to undo. The rewrite target changes; the import-resolution story doesn't.
- Generalizes. Every future Rip package — ambient or not — exposes types the same way.

**Cons:**
- Typed code carries an import line that untyped code doesn't. A typed component starts with `import { createResource } from '@rip-lang/app'`; an untyped one doesn't. The two shapes differ slightly.
- Two valid surface forms exist (the global and the imported binding, both resolving to the same value). Some users will mix styles.

### Implementation notes

- Browser compiler gains pattern matching for the `@rip-lang/*` specifier prefix in the existing `ripImportRe` rewrite pass — roughly ten lines, slotted into the same sweep that already rewrites `.rip` imports to Blob URLs.
- `typecheck.js` reuses RFC 2's package-resolution path verbatim; no new branch.
- Annotations on `packages/app/index.rip` are the same `::` syntax used everywhere else; no new authoring conventions.

### Effect on untyped apps

**None at runtime, in either direction.**

- The bundle continues to register framework helpers on `globalThis` exactly as today. `rip.min.js`, `<script type="text/rip">`, no import line — that path is unchanged.
- The "no build step" promise is preserved. An untyped app stays one HTML file plus `<script>` tags.
- The only thing that changes is what *typed* code writes to satisfy the type checker. Untyped code never sees a difference.

A subtle bonus: once the browser compiler recognizes `import { createResource } from '@rip-lang/app'` and rewrites it to a global access, untyped users *can* write the import too if they want consistency. They're not forced to; they gain an option. Nothing breaks if they don't.

### Alternatives considered

- **Auto-inject ambient declarations into typed `.rip` files** that use the framework (detected via heuristics like `<script src="rip.min.js">` presence, a `launch` import, or a `rip.json` flag). Rejected. The detection heuristic is a new failure mode — when it guesses wrong, the failure presents as "types just don't show up" with no obvious cause. It introduces a second type-resolution path in `typecheck.js` distinct from how every other package resolves. It needs a policy list of "well-known auto-injected packages" that grows with every framework-tier package. Saves typed users one import line per file — a real cost, but smaller than the costs above.

- **Hand-written `APP_TYPE_DECLS` map in the compiler** (parallel to `STDLIB_TYPE_DECLS` in `src/stdlib.js`). Rejected: the stdlib precedent doesn't apply here. Stdlib helpers are hand-written **JavaScript** — `getStdlibCode()` returns a JS string literal — so hand-written TS is the only option for them. The app framework is real Rip with real exports the type pipeline can already analyze. Choosing hand-written TS would re-create the exact drift problem RFC 2 rejected. Doesn't generalize either: every future framework-tier package would need its own bespoke injection block.

- **Build-time DTS generation, shipped as a real `.d.ts` file** (write `packages/app/index.d.ts` during `bun run build`, ship it in the published package, let TS resolve it through `package.json` `"types"`). Same source-of-truth as the proposal — the difference is a build-time, on-disk artifact instead of check-time, in-memory generation. Rejected because it introduces a committed/published file that has to stay in sync with `index.rip`, makes `bun run build` mandatory before `rip check` works, and adds a disk artifact where none is needed. Worth revisiting only if Rip ever needs to expose types to non-Rip TypeScript consumers, which is out of scope here.

- **TS reference directives** (`/// <reference types="@rip-lang/app/globals" />` injected at the top of every shadow TS file) and **synthesized `tsconfig.types`** (have `rip check` add `@rip-lang/app` to a virtual tsconfig's `types` array). Both are alternative *delivery mechanisms* for ambient declarations — variants of the auto-inject path above, sharing all of its drawbacks.

### Relationship to other RFCs

Depends on RFCs 1, 2. Sources the `__RipApp` and `__RipRouter` types that RFCs 4 and 7 reference. Composes with RFC 6 (the renamed exports flow through the import path unchanged).


## RFC 4: typed component `this` shape

Inside a component body, the magic `@` context exposes a fixed set of injected members: `@app`, `@router`, `@params`, `@query`, `@rest`, `@children`, plus the six lifecycle hooks the runtime recognizes (`beforeMount`, `mounted`, `updated`, `beforeUnmount`, `unmounted`, `onError` — the canonical list lives in `LIFECYCLE_HOOKS` at [src/components.js](src/components.js#L20)). The renderer constructs each component with `new Component { app, params, query, router }` ([packages/app/index.rip](packages/app/index.rip#L1309)) and the components runtime additionally exposes `this.rest`, `this._rest`, and `this.children`. None of these are visible to the type checker today — every access types as `any`. (Side note: the hook names are not currently documented in `docs/RIP-APP.md` or `AGENTS.md` — the only public hint is the brief `mounted`/`unmounted` comment at [packages/app/index.rip](packages/app/index.rip#L857). Worth fixing alongside this RFC so the typed shape and the prose docs land together.)

This is the gap RFC 3 explicitly leaves open: RFC 3 types module-level imports, but per-component instance members live on `this`, not on any importable name. Typing them needs its own pipeline hook.

### Proposal — synthesize `__RipComponentThis` and bind it as `this:` for every component

Same precedent as `__RipStash` in [src/typecheck.js](src/typecheck.js): the type checker splices a synthesized type into the shadow TS source at the entry-file anchor, and the compiler emits a `this:` parameter on the function it generates for each `component`-form so the language service ties the two together.

Members of `__RipComponentThis`:

- `app: __RipApp` — the stash type that already exists today (`__RipStash`-flavored, sourced from the project's `stash.rip` if present, otherwise `Record<string, unknown>`)
- `router: __RipRouter` — sourced from RFC 3's annotated `createRouter` return type
- `params: Record<string, string>` — uniform baseline; **RFC 7 tightens this to per-route shapes** for components that live under `routes/` (leaf routes get `{ id: string }` for `routes/users/[id].rip`, etc.); layouts and shared components stay on the baseline
- `query: URLSearchParams` — matches what `createRouter` actually puts on the instance
- `rest: Record<string, unknown>` — the catch-all for unconsumed props
- `children: unknown` — slot content; widened because the framework places no constraint on what a parent passes
- `beforeMount?(): void` — fires before initial DOM mount; effects created here auto-register on the component
- `mounted?(): void` — fires after initial DOM mount; runs once per visit
- `updated?(): void` — fires after every reactive re-render
- `beforeUnmount?(): void` — fires before teardown
- `unmounted?(): void` — fires after teardown; runs once per visit
- `onError?(err: { status?: number; message?: string; error?: Error; path?: string }): void` — error boundary; the runtime walks the layout chain looking for the nearest component that defines this

Concretely, in `src/typecheck.js`:

- Add a `buildComponentThisType()` alongside `findStashFile`/`buildStashType`. It composes from already-resolved pieces: the stash type, the imported router type from `@rip-lang/app` (RFC 3), and the constant param/query/rest/children shapes. Splice into the shadow TS at the same anchor.

In the components emitter (`src/components.js`):

- Where the component function is emitted today, prepend a `this: __RipComponentThis` synthetic parameter in the **DTS slice only** — the runtime emit is unchanged. The type-only annotation lets TypeScript bind `@router` (which compiles to `this.router`) to the synthesized type.
- Guard so untyped projects (no `rip.json` strict mode) skip the splice. The runtime has zero changes either way.

### Effect on existing code

**None at runtime.** The change is purely in the DTS pipeline — synthesized type + a `this:` parameter that TypeScript reads and JavaScript ignores.

**Typed apps.** `@router.path`, `@app.data.user`, `@params.id`, `@query.get('q')` all type correctly without further annotation. `@params.typooo` errors. `@router.push '/cart'` is checked against the router's `push` signature.

**Untyped apps.** No annotation, no opt-in, no behavior change. The compiler still emits the same JS; only the shadow TS gains the `this:` slot.

### Why not extend RFC 3 to cover this

RFC 3 is "ambient module exports become imports." Instance members aren't exports — there's no `this` binding to import. They're injected by the framework's component constructor at runtime, and the natural type-system parallel is a synthesized `this:` parameter, not an import. Different shape, different mechanism. Bundling the two into one RFC would conflate them; splitting keeps each RFC's mechanism crisp.

### Alternatives considered

- **Type the existing `__Component` base class; let inheritance do the work.** The runtime already emits `class Foo extends __Component` (verified by compiling a probe component with `./bin/rip -c`). If `__Component`'s DTS declared the injected members — `app`, `router`, `params`, `query`, `rest`, `children`, plus the optional lifecycle hooks — every user component would inherit them through ordinary TS class inheritance. No splice into the shadow source, no synthetic `this:` parameter, no per-component DTS gymnastics. A user-written `mounted: ->` becomes a method override of the optional base member, which is exactly the relationship TS is designed to model. Rejected as the **primary** mechanism, kept as a future simplification: per-route `params` tightening (RFC 7) is awkward through inheritance, because each component file would need a different generic instantiation of the base, threaded through the components emitter on a per-file basis. The splice approach already has the file path in hand inside `typecheck.js` and can specialize `params` cheaply. Worth revisiting if RFC 7's per-route specialization is later dropped or moved entirely into the renderer.

- **Annotate the `component` factory with `ThisType<__RipComponentThis>`.** TypeScript provides a built-in marker for "infer `this` inside this body": `ThisType<T>`. If the `component` export in `packages/app/index.rip` were typed as a factory taking `ThisType<__RipComponentThis> & ComponentBody`, TS would bind `@app` etc. inside the body without any type-checker pipeline change — pure RFC 2 mechanism, one annotation, done. Rejected because the components emitter today produces a class declaration, not a callback to `component(...)`; the `component` keyword is parsed as a class form, not a function call. To make `ThisType` apply, either the runtime emit would have to change to a callback form (much larger scope, runtime impact, performance regression risk) or the DTS would have to lie about the emit shape. The proposal already accepts a small DTS-only fiction (the `this:` parameter), so this isn't categorically worse, but it solves a smaller slice of the problem at the same cost.

- **Per-component-class generated types** that inspect each component's actual props/state and emit `declare class Foo extends __Component { count: __State<number>; clearFilters(): void; ... }` per file. Strictly more precise — would type user-defined state and methods, not just the injected baseline, and would also help sibling components that import each other. Rejected as too costly: requires a second type-inferer in the components emitter that walks every `name := value` and `name: ->` and infers a TS type from the RHS expression. That's a substantial new piece of compiler infrastructure for a moderate gain over the proposal. Stays as future work; the injected baseline is the "free win" subset.

- **Have the user write `@:: __RipComponentThis`** (or some new sigil) at the top of each component to opt into typed `this`. Rejected — silent universal coverage matches the model of `__RipStash` (no per-file declaration needed) and avoids a 200+ file migration in the UI package alone. The whole point of synthesizing a type is to make it free.

- **Open `interface __RipComponentThis` for declaration merging.** Not a competing alternative — it composes with the proposal. If `__RipComponentThis` is emitted as an `interface` (not a `type` alias), advanced users could augment it from their own code to add app-specific injected members (custom helpers a project's renderer wraps in). Worth doing as part of the proposal; costs nothing.

### Relationship to other RFCs

Depends on RFCs 1 (annotation syntax), 2 (DTS pipeline), 3 (sources `__RipApp`, `__RipRouter`). Unblocks RFC 7 (typed `@router.push`, per-route `@params` tightening). Mirrored structurally by RFC 5 for server handlers.


## RFC 5: typed server handler `this` shape

The server-side parallel to RFC 4. API route handlers in `@rip-lang/server` get the same magic `@` context as components — `@req`, `@json()`, `@send()`, `@session`, `@params`, `@query`, plus the auth-helper return values from the framework's routing pattern. Today these all type as `any`. Without RFC 5, typing the cart example's API routes (or any typed Rip backend) bottoms out at the first `@req.headers` access.

### Proposal — synthesize `__RipServerHandlerThis` and bind it as `this:` for every handler

Same machinery as RFC 4, applied to handlers:

Members of `__RipServerHandlerThis`:

- `req: Request` — the standard fetch `Request` instance the server is built on
- `params: Record<string, string>` — route params from the path matcher
- `query: URLSearchParams` — parsed query string
- `session: Record<string, unknown>` — session bag (typed `unknown` until session schemas are formalized)
- `json(body?: unknown, status?: number): Response` — JSON response helper
- `send(path: string, type?: string): Promise<Response>` — file-serving helper
- `redirect(url: string, status?: number): Response` — redirect helper

In `src/typecheck.js`:

- `buildServerHandlerThisType()` alongside `buildComponentThisType()`. Most of its members are constant shapes; `req`/`params`/`query` are pulled from standard lib types.

In `@rip-lang/server` itself (`packages/server/server.rip`):

- Annotate the route-registration helpers (`get`, `post`, `put`, `delete`, etc.) so their handler argument is typed as a function with `this: __RipServerHandlerThis`. This is the RFC 2 mechanism — annotate the package source, the DTS pipeline does the rest.

The compiler emits the `this: __RipServerHandlerThis` slot in the handler's function signature in the DTS slice, the same way RFC 4 does for components.

### Relationship to other RFCs

Depends on RFCs 1, 2 (mechanism). Mirrors RFC 4. Multi-field input validation — the typical companion to a typed handler — is covered today by `schema :input` with `.safe()`, which already has its own DTS pipeline (`src/schema/dts.js`) and returns `{ok, value, errors}`. The single-field `read()` helper stays as today (returns `unknown` in typed contexts); narrowing its return via string-literal validator overloads was prototyped and dropped — the win was small (one-liner casts at call sites) and the cost was real (~30 hand-maintained overloads kept in sync with `validators` in `packages/server/api.rip`).


## RFC 6: Trim and align the `@rip-lang/app` global surface

`@rip-lang/app` exports sixteen names that the bundle spreads onto `globalThis`. The `AGENTS.md` "don't shadow injected globals" warning treats all sixteen as equally risky, but they aren't. An audit across `apps/`, `examples/`, `docs/`, and `packages/` (excluding the `app` package's own internals and the bundled DuckDB sources) sorts them into three buckets:

**Descriptive enough that no one shadows them** — 11 names: `setContext`, `getContext`, `hasContext`, `persistStash`, `createResource`, `createComponents`, `createRouter`, `createRenderer`, `debounce`, `throttle`, `launch`. They follow a `verb+Noun` convention (`createX`, `persistX`, `getContext`) and don't collide with common identifiers.

**Genuinely collision-prone** — 4 names: `delay`, `hold`, `raw`, `stash`. Short, common-English, and exactly the names a user reaches for naming locals. A component that writes `delay = 200` lexically shadows `globalThis.delay`; a later `delay! 100` crashes with `delay is not a function`, error pointed at the call site, not the shadowing line.

**Effectively unused** — `isStash`. Zero real call sites in the audited tree.

The alternative previously sketched here — wrapping every export in a `globalThis.Rip` namespace and forcing untyped users to write `Rip.createResource` — addressed all sixteen names uniformly and so paid the ergonomics cost on the eleven that didn't need fixing. The audit shows that's the wrong tradeoff: the real surface is small and can be addressed with renames.

### Proposal

Three changes to `packages/app/index.rip`:

1. **Delete `isStash`.** Zero real call sites. Anyone who needs the check can write `obj?[:stash] is true` (which is exactly what the helper returns).

2. **Rename `stash` → `createStash`.** The function builds a reactive proxy. The current name collides with the `export stash::` *language keyword* and with the conceptual noun "the stash" used throughout the docs. The new name aligns with the existing `createResource` / `createRouter` / `createRenderer` / `createComponents` / `persistStash` family — one naming convention for the whole package.

3. **Rename `raw` → `unwrapStash`.** The function strips the reactive proxy off a stash value. The current name collides with `String.raw`, with tagged-template `$"..."` callers commonly named `raw`, and with `[:raw]` symbol keys throughout the codebase. The new name says exactly what it does and won't be shadowed.

The four collision-prone timing helpers (`delay`, `hold`, `debounce`, `throttle`) **stay as-is**. They form a coherent reactive-timing vocabulary and renaming them to `reactiveDelay` / `reactiveHold` / etc. would be uglier than the problem. The AGENTS.md warning shrinks from "don't shadow these sixteen names" to "don't shadow the four reactive timing helpers" — a tighter, more memorable rule about a real family of functions, not a grab bag.

### Migration cost

Zero in this repo. The audit found:

- **`isStash`** — zero real call sites.
- **`stash` as a function call** — zero real call sites. The `stash` keyword in `export stash::` declarations (e.g. [examples/cart/app/stash.rip](examples/cart/app/stash.rip#L14)) is the language form, not the helper, and is unaffected.
- **`raw` as a function call** — zero real call sites in source. One use in a doc snippet ([docs/RIP-APP.md](docs/RIP-APP.md)) needs updating.

External apps using the old names get a one-time find-and-replace plus deprecation shims (`stash = createStash; raw = unwrapStash; isStash = (o) -> o?[:stash] is true`) in the bundle for one minor version, then dropped.

### Effect on existing code

**Untyped apps.** Anyone calling `createStash(...)` or `unwrapStash(value)` reads the same as today, just with a clearer name. No prefix to type, no ceremony. The 11 well-named globals are unchanged.

**Typed apps.** RFC 3 already gives typed apps `import { createStash, unwrapStash } from '@rip-lang/app'`, which is the canonical typed-app idiom. Nothing in RFC 6 changes that path.

**Compiler / runtime.** No build-script change, no namespace global, no import-rewrite-target change, no DTS pipeline change. RFC 6 is a package-level rename, nothing more.

### Pros and cons

**Pros:**
- Fixes the actual problem: the four collision-prone names that are dangerous (kept, but flagged) and the one redundant export (deleted), without touching the eleven that are fine.
- One naming convention (`createX` / `persistX` / `unwrapX`) across the package instead of two.
- No syntactic change for any user. No "two ways to do it" between typed and untyped paths.
- Trivial implementation — three edits to `packages/app/index.rip` plus one doc update.
- Composes cleanly with RFC 3: the renamed exports flow through the existing import path as-is.

**Cons:**
- Doesn't eliminate the `delay`/`hold` shadowing footgun — only narrows it from sixteen names to four. The AGENTS.md warning still exists; it's just shorter.
- Renaming exports is a breaking change for external consumers, mitigated by the one-version deprecation shim.

### Alternatives considered

- **One namespace global (`globalThis.Rip`), every helper accessed as `Rip.*`.** The original RFC 6 sketch. Rejected because it forces a prefix on the eleven well-named globals to fix the four problematic ones — universal cost for partial benefit. Also introduces a typed/untyped divergence (typed apps import, untyped use `Rip.*`) that this proposal avoids.

- **Rename the four timing helpers too** (`delay` → `reactiveDelay`, `hold` → `reactiveHold`, etc.). Considered and rejected: they form a coherent vocabulary with `debounce` and `throttle`, the names match what the function does, and the prefix would be uglier than the problem. The AGENTS.md warning is sufficient mitigation for the timing family.

- **Status quo.** Keep all sixteen exports, including `isStash` (zero users) and the misleadingly-named `stash` and `raw`. Rejected because the rename window is now — both names have zero real call sites and one of them (`stash`) collides with a language keyword, which is the kind of mistake worth fixing before the surface grows.

- **Compiler warning when a `let` declaration shadows an injected global.** Not a competing alternative — it composes with this proposal. Could be added as a future diagnostic in the lexer/rewriter to make the shadowing footgun loud rather than silent. Out of scope for this RFC, but the four-name list (`delay`, `hold`, `debounce`, `throttle`) is exactly the right input.

### Relationship to other RFCs

Independent of every other RFC. Composes with RFC 3 (the renamed exports flow through the import path unchanged). Does not block, and is not blocked by, anything in Domain A or C.


## RFC 7: routing ergonomics

Rip's app framework today gives you file-based routes and document-level `<a>` interception. Two ergonomic features common in modern routers are still missing: **highlighting the active link** (so the current page can be styled distinctly in a nav bar) and **catching typos in route paths** (`<a href: "/crat">` should be a compile error in a typed app, not a 404 at runtime). Neither is essential — plenty of routers ship without one or both — but both are the kind of nice-to-have that nudges a routing library from "functional" to "pleasant." This RFC proposes how Rip should add them.

### Background — what the router already provides

`createRouter` in `packages/app/index.rip` already does three things relevant here. First, it intercepts plain `<a>` clicks at the document level and routes same-origin links through SPA navigation, with a skip list (`target="_blank"`, `[download]`, `[data-router-ignore]`, cross-origin, links outside `base`) for cases that should fall through to the browser. Second, it tracks `router.path` as a reactive signal that updates on every navigation. Third, it exposes `router.push(url)` and `router.replace(url)` for programmatic navigation. So this RFC isn't proposing a new navigation primitive; it's proposing two ergonomic features that build on what's already there.

### Proposal

**1. Auto `aria-current` on the active anchor.**

Subscribe an effect to `router.path` inside `createRouter`. On every change, walk `[href]` anchors within the router's `base`, normalize their hrefs (strip origin, strip `base`, strip `?query` and `#fragment`, decode, trim trailing slash) and compare to the current path:

- **Exact match** → `aria-current="page"` (the standard "this is the current page" value)
- **Prefix match** (current path starts with the link's path + `/`) → `aria-current="true"` (HTML's standard "current within this section" value, used by `<a href="/blog">` when on `/blog/123`)

Reuse the click-interception skip-list verbatim so cross-origin / `[download]` / `data-router-ignore` anchors are left alone. Track "we set this" with a `WeakSet` so a manually-set `aria-current` value is never clobbered. Removing the attribute when an anchor is no longer active is symmetric. In hash mode (`opts.hash: true`), normalization reads from the URL hash instead of the pathname — the rest is identical.

Approx. 25 lines hooked to the existing reactive infrastructure. The user gets to write:

```rip
nav
  a href: "/", "Home"
  a href: "/cart", "Cart (#{cart.count})"
  a href: "/users/#{user.id}", "Profile"
```

```css
nav a[aria-current="page"] { color: red; font-weight: bold; }     /* exact: current page */
nav a[aria-current="true"] { color: red; }                        /* prefix: current section */
```

Query strings and fragments are stripped before comparison, so `<a href="/cart?utm=foo">` is active when `router.path === "/cart"`. No per-link `'aria-current': 'page' if @router.path is '/cart' else null` boilerplate, no manual subscription to `router.path`, and the feature works on third-party HTML the framework never rendered (markdown content, CMS output, embedded widgets).

**2. Type the `href` attribute on `<a>` against a generated `__RipRoutes` union.**

At type-check time, walk the project's routes directory (mirroring `findStashFile` / `__RipStash` in [src/typecheck.js](src/typecheck.js)). The directory defaults to `<appDir>/routes/` to match the `serve()` middleware's default — see [packages/server/middleware.rip](packages/server/middleware.rip), where `routes` is read off the serve options and the on-disk files are mounted under the `components/` key in the bundle (which is why `createRouter` reads from `root: 'components'` while the disk layout uses `routes/`). The path should be readable from `rip.json` (new `"routes"` field, default `"routes"`) so the type-checker stays in sync if a project overrides it.

Mirror the runtime's existing rules when walking: skip `_-prefixed directories` and `_-prefixed files` (the same exclusion `buildRoutes` applies in [packages/app/index.rip](packages/app/index.rip), so `_layout.rip` and helper files don't pollute `__RipRoutes`).

Convert each route file path to a TypeScript template-literal pattern, and emit:

```ts
type __RipRoutes =
  | "/"
  | "/cart"
  | `/users/${string}`
  | `/blog/${string}/${string}`
  | `/admin/${string}`;
```

Splice it into the project's virtual TS at the entry-file anchor (same mechanism `__RipStash` already uses) and update the `a` entry of `__RipElementMap` in `src/dts.js` so `href` becomes `__RipRoutes | __ExternalHref`, where `__ExternalHref` enumerates the non-route URL shapes by prefix:

```ts
type __ExternalHref =
  | `https://${string}`
  | `http://${string}`
  | `mailto:${string}`
  | `tel:${string}`
  | `#${string}`;   // bare fragment — same-page anchor
```

This preserves real type safety: `"/cart"` checks against `__RipRoutes`, `"https://github.com"` checks against `__ExternalHref`, but `"/crat"` matches *neither* and produces a type error — exactly what we want. The rare cases that fall outside this set (protocol-relative `//cdn.example.com`, exotic schemes like `chrome://`, etc.) need a one-line cast (`href: "//cdn.example.com" as __RipRoutes`) or `data-router-ignore`. That's a worthwhile trade for catching real route typos.

The same type should apply to the argument of `router.push` / `router.replace` so programmatic navigation gets the same validation as link clicks. (`router.push` likely wants `__RipRoutes` only, since pushing an external URL through SPA navigation doesn't make sense — that's a `window.location.href = ...` operation.) This piece **depends on RFC 4** — `@router.push` is only typed if the component's `this.router` is typed, which is what RFC 4 establishes.

**3. Per-route `@params` tightening.**

RFC 4 types `@params` as `Record<string, string>` for every component. RFC 7 tightens this for components that live under `routes/`: the route-tree walker already in step 2 knows each leaf route's dynamic-segment names, so it can synthesize a per-file param shape:

- `routes/users/[id].rip` → `params: { id: string }`
- `routes/blog/[slug]/[part].rip` → `params: { slug: string; part: string }`
- `routes/admin/[...rest].rip` → `params: { rest: string }` (catch-all)

Emitted into the same shadow-TS slot RFC 4 uses for `__RipComponentThis`, but specialized per file — one synthesized type variant per route file, applied via the entry-file anchor. Layouts (`_layout.rip`) and components imported from `components/` rather than `routes/` stay on RFC 4's baseline `Record<string, string>` because they don't have a single deterministic param shape.

**4. Document the existing `data-router-ignore` opt-out.**

It already works; it's just not in the public surface yet. Adding it to the framework's docs is the only "new" thing here.

**5. Scroll restoration.**

Every SPA router has to decide what happens to scroll position on navigation. Today, `createRouter` does nothing — the back button leaves you wherever you were on the new page, which is wrong almost everywhere. Match SvelteKit's defaults:

- **New navigation** (`router.push` or a link click) → scroll to top.
- **Back / forward** (popstate) → restore the scroll position saved in `history.state`.
- **Same-document `#fragment` link** → scroll to the element with that ID (browser default; just don't override it).
- **Opt-out** → `data-router-noscroll` on a link, or `router.push(url, noScroll: true)` programmatically.

Enabled automatically. Doing nothing is a worse default than "scroll to top," and the override surface for the rare "don't scroll" case (a tab switcher that updates the URL without changing what's on screen) is small. Implementation is roughly: capture `window.scrollY` into `history.state` before each `pushState`, restore it on `popstate`, and reset to `(0, 0)` on `pushState` unless the opt-out is set.

### What about programmatic navigation?

Programmatic navigation (a successful async action that should redirect the user, like `await login(); router.push '/dashboard'`) is the obvious companion case to clicking a link. The good news: **Rip already has it.** `router.push(url)` and `router.replace(url)` are stable methods on the router object that's already passed to every component as `@router`. The replacement-vs-push distinction (login redirect that shouldn't appear in back-button history → `replace`; normal nav → `push`) lives there, where it belongs.

### What this RFC does *not* propose, and why

- **A `Link` component.** Most framework UIs ship one (TanStack, Vue, Solid, React Router); SvelteKit doesn't, and Rip should follow SvelteKit. A typed-only `Link` would be the first place in Rip where adding types changes the source idiom rather than just validating it — a divergence not paid anywhere else (`::`, `rip.json strict`, schemas all validate an unchanged API). It also wouldn't help markdown, CMS output, or third-party widgets, which all emit `<a>`. Type safety on the route value can be done on the `href` attribute directly.
- **A `data-router-active-class` attribute.** `aria-current="page"` plus `[aria-current="page"]` in CSS covers the common case. A custom class is usually wanted for prefix-match active state (`/blog` styled active on `/blog/*`), which is a separate feature with separate rules — defer.
- **A `data-router-replace` attribute.** Programmatic replace already exists via `router.replace`; click-time replace has no compelling use case.

### Caveats of the template-literal approach

Distinct from the external-URL story above, the `__RipRoutes` union itself is loose on dynamic segments — `${string}` accepts any string, including the empty string and strings containing slashes:

- `<a href: "/users/">` type-checks (matches `` `/users/${string}` ``); the runtime would 404 it.
- `<a href: "/users/foo/bar">` type-checks against `/users/${string}` even though `[id]` is conceptually one segment.
- Catch-all routes (`[...rest]`) type as `` `/admin/${string}` ``, which over-accepts but never under-accepts.

Fully tight per-segment typing requires the TanStack-style approach: type each route as `{ to: "/users/$id", params: { id: string } }`, separating the path template from the params. That changes the source idiom — `<a href: "/users/#{id}">` becomes `<a href: route("/users/$id", id: id)>` or similar — which is the typed/untyped divergence this RFC is explicitly trying to avoid. The proposal here trades segment-shape precision for source-form parity. If the looseness causes real bugs in practice, a follow-up RFC can layer per-segment validation on (the underlying route tree is already known at type-check time), but ship the prefix-discriminated version first and see whether the gap matters.

The `aria-current` walker is `O(n_anchors)` per route change. For typical nav bars with tens of links this is invisible; on pages with thousands of anchors a route-indexed cache or `IntersectionObserver`-scoped walk would handle it. Not a v1 concern.

### Effect on untyped apps

**Behavior changes: `aria-current` is set automatically on active anchors, and scroll position is managed automatically on navigation. Surface change: none.**

No new global, no new component, no new import. Existing `<a href>` markup is unchanged.

- Active-link styling: a user who wants to suppress auto-`aria-current` on a specific link can set it manually to any other value (the `WeakSet` keeps the framework from overriding it) or add `data-router-ignore`.
- Scroll restoration: matches SvelteKit defaults — top on push, restore on back/forward, browser default on `#fragment`. Apps that intentionally update the URL without changing the visible region (tab switchers, filter bars, sub-route swaps inside a scrolled container) opt out per-link with `data-router-noscroll`, or programmatically with `router.push(url, noScroll: true)`. Both are net-new attributes/options; nothing already in the codebase changes meaning.

### Effect on typed apps

The type pipeline gains `findRoutesDir` and `buildRoutesType` in `src/typecheck.js`, and `src/dts.js` gains an `__RipAnchorAttrs` slot in `__RipElementMap` plus typed signatures for `router.push` / `router.replace`. Both follow the existing `__RipStash` precedent, and the per-route `@params` tightening lives in the same walker. `<a href: "/cart">` and `@router.push "/cart"` in a typed file both validate against the project's actual route tree, with no migration and no new syntax.

### Relationship to other RFCs

The `aria-current` + scroll-restoration parts are independent of every other RFC — pure runtime ergonomics. The `<a href>` typing piece depends on RFC 2 (DTS pipeline) and RFC 3 (typed router exports). The `@router.push` typing and per-route `@params` tightening depend on RFC 4 (typed component `this`).


## RFC 8: Tracking property accesses on `for`-loop iteration variables

While building the cart example, the quantity input on each row exhibited two related symptoms that point at the same compiler limitation:

1. **Focus loss on every keystroke.** The original `updateQuantity` did `@items = @items.map (i) -> if i.id is product.id then { ...i, quantity } else i` — a React-style immutable replace. Each keystroke produced a new array of new object identities. The list reconciler tore down the row's `<tr>` (and its `<input>`) and rebuilt it with the new `item`. Symptom: typing one digit blurred the input.

2. **Mutation in place doesn't update the row.** Switching to `item.quantity = quantity` (the idiomatic Rip pattern: mutate the leaf, let signals do the rest) preserved focus but exposed a deeper problem — the displayed quantity and the per-row subtotal stopped updating. The cart total still updated correctly. The `+`/`−` buttons that mutate via the same path also failed to move the displayed quantity.

The compiled output explains both. The per-row block emitted by [src/components.js](src/components.js) for `for item in cart.items` looks like this (excerpt from `create_block_4`):

```js
function create_block_4(ctx, item, i) {
  ...
  c() {
    _t11 = document.createTextNode(String(`${item.image} ${item.name}`));
    _t12 = document.createTextNode(String(`$${item.price.toFixed(2)}`));
    _el31.setAttribute('value', String(item.quantity));
    _t15 = document.createTextNode(String(`$${(item.price * item.quantity).toFixed(2)}`));
  },
  p(ctx, item, i) {
    // empty — no effects emitted
  },
}
```

Every read of `item.foo` is materialized once in the create function `c()` and never wrapped in an `__effect`. The patch function `p()` is empty. The cart total works only because it goes through `cart.totalPrice()`, which is rooted at `ctx.cart` (a tracked component member), so its enclosing effect re-runs when the proxy fires; that effect's body happens to read each `item.quantity` through the proxy and re-renders the total text node.

The reason is documented in [`AGENTS.md`](AGENTS.md):

> Inside a component's `render`, only expressions rooted at `this` (`@app.data...`, component members) are tracked as reactive by the compiler.

A `for`-loop iteration variable is not rooted at `this`, so `hasReactiveDeps(item.quantity)` returns false, and no effect wrapper is emitted. The current "workaround" for per-row reactivity is to extract a child component — the prop binding launders `item` into a tracked member and the inner template's reads become reactive again. That works, but it's a workaround masquerading as a pattern: every list-of-reactive-objects template requires a child component for reasons that have nothing to do with composition or reuse.

### Proposal — treat the iteration variable as reactive when the iterated source is reactive

When the compiler emits a `for x in expr` loop body, if `expr` is already reactive (i.e. would itself be wrapped in an `__effect` by the existing `hasReactiveDeps` check), then within that loop body **any read through a binding that references the proxy** is reactive and gets the same effect-wrapping treatment as a `this`-rooted access.

The day-1 scope covers three cases, all of which boil down to the same underlying mechanism — a name that points at a reactive proxy:

1. **Direct member access on the iter var.** `for item in cart.items` then `item.qty`, `item[0]`, `item.foo.bar`. The base case.
2. **Aliases and rebindings.** `for item in items` then `local = item; local.foo`. `local` references the same proxy as `item`; reads through it are already reactive at runtime — the compiler just needs to know the name is tracked so it emits the effect wrapper.
3. **Object-shaped destructuring of reactive references.** `for {profile} in users` then `profile.name`. `profile` is still a proxy reference, so reads through it stay reactive. Same name-propagation work as aliases.

Concretely, in `src/components.js`:

- The loop emitter already pushes `{ itemVar, indexVar }` onto `_loopVarStack` before walking the body and pops after.
- Add a `reactiveSource: bool` field — captured at push time from the same check that decides whether `__reconcile` is wrapped in `__effect`. When true, `itemVar` is added to a scope-local tracked-names set as the body walk begins.
- During the body walk, when an assignment `ident = X` or a destructuring `{ident, ...} = X` is seen and `X` resolves to a tracked name, add `ident` to the tracked-names set within its lexical scope. Reassigning a tracked name to a non-tracked expression removes it. Pop the scope's additions on scope exit.
- Extend `hasReactiveDeps(node)` to return true when `node` is a member access whose root identifier is in the current tracked-names set. The reactive-source check has already happened at insertion time, so lookup is just a set membership test.

The existing emit paths (`emitAttributes`, the text-interpolation path, `emitConditional`) already route reactive expressions through `_pushEffect` — they'd start firing for `item.foo`, `local.foo`, and `profile.name` automatically. The patch function `p()` would receive the per-row effects it currently lacks, and the row's DOM nodes would update in place when the underlying signals fire. Identity is preserved — no reconciler rebuild, no input blur.

**Deferred to RFC 8b — primitive destructuring.** `for {qty} in items` where `qty` is a number is genuinely a different problem. Once the value is destructured out it's no longer a proxy reference — `qty` is just a `Number`, and `qty * 2` reads from a snapshot. Making it reactive requires either rewriting reads of `qty` back to `item.qty` (a real source-rewrite pass with scoping concerns around shadowing and reassignment), abandoning JS destructuring entirely in favor of `let qty; ... item.qty` everywhere, or some getter-binding scheme that doesn't have a clean syntax. Each of those is a design decision worth its own RFC. Day-1 covers the three reference-preserving cases; primitive destructuring stays static for now (and the workaround — drop the destructuring, write `item.qty` — is local and obvious).

**Pros:**
- Closes the gap between "what users expect from fine-grained reactivity" and what the compiler actually delivers. The cart-row case (and every list-of-reactive-objects case) just works.
- Eliminates the one workaround that exists purely for compiler reasons rather than design reasons. "Extract a child component to make per-row updates reactive" stops being a recommendation; component extraction is once again only about composition and reuse.
- Strictly additive — no regressions. Today, `item.qty` in a template reads once and never updates on in-place mutation; after this RFC, it does. Existing code that *intentionally* relied on the stale-read behavior would change, but that pattern is vanishingly rare and would be better written as a non-reactive snapshot anyway.
- Removes the ergonomic tax of extracting a child component just to get per-row reactivity. The child-component pattern still works (and is still right when composition or reuse is the real motivation), but it stops being mandatory for this one compiler-shaped reason.
- Simpler mental model. AGENTS.md's tracking rule changes from "rooted at `this`" to "rooted at any reactive binding" — shorter, more general, easier to teach.
- Aliases and object-shaped destructuring work day one, so the rule users learn ("reads through a reactive binding are reactive") matches what they actually write. No "don't alias the iter var" caveat in the docs.

**Cons:**
- Primitive destructuring stays static, silently — `for {qty} in items` then `qty * 2` does not become reactive, and there's no warning. Has to be called out in the docs and ideally surfaced as a lint or compile-time hint when the destructured field is read into a tracked context. (Full fix deferred to RFC 8b.)
- Iteration over a `~=` computed that returns fresh objects each recompute is actively wasteful, not just redundant — N per-element effects get torn down and recreated on every recompute, doing work the reconciler already handles via identity change. Not a correctness issue, but worth a docs note: "if your iter source is a `.map`-returning computed, push the reactivity to the source instead of relying on per-element tracking."

### Implementation notes

- **Where the work lands.** `src/components.js`: the loop emitter (the `_loopVarStack` push/pop) gains a `reactiveSource` flag, and `hasReactiveDeps` gains a tracked-names set lookup. Hot path — every `for` in every render — but the per-node cost is one set membership test.
- **Reactive-source detection.** "Source is reactive" reuses the existing `hasReactiveDeps` check that already decides whether to wrap `__reconcile` in `__effect`. The edge cases (`for x in [1,2,3]` — no; `for x in cart.items` — yes; `for x in someLocalArray` — depends) all fall out of the existing analysis.
- **Tracked-name propagation.** Scope-aware analysis for assignments (`local = item`) and object destructuring (`{profile} = item`). Has to handle nested scopes (loops, blocks, function expressions), reassignment (`local = somethingElse` retracts the tracking), and the proxy-preserving vs primitive-destructuring distinction. Small but real.
- **Two update paths interact.** The existing reconciler (handles identity / order / length) and the new per-property effects (handle in-place mutation) are complementary but need explicit test coverage — especially the case where both fire in the same flush.
- **Test surface.** Nested loops, shadowed names, iteration over non-reactive sources, alias chains, object-destructuring chains, reassignment retraction. See the **Test plan** section below.

### Alternatives considered

- **Status quo + child-component workaround.** Current state. Rejected as the long-term answer because it makes every list-of-reactive-objects template require a child component for compiler reasons, not design reasons. The workaround is fine when component extraction is wanted anyway; it's a tax when it isn't.

- **Runtime-only solution: have the proxy track reads inside any effect.** It already does — that's why `cart.totalPrice()` works. The issue is that the compiler never *creates* an effect around the per-row reads in the first place, so there's no effect for the runtime tracking to attach to. This isn't a runtime gap; it's a codegen gap. Shipping a "smarter proxy" doesn't fix the missing effect wrapper.

- **Even more aggressive variant: include primitive destructuring.** Tracks `for {name, qty} in items` → `qty * 2` by source-rewriting `qty` reads back to `item.qty`, or by abandoning JS destructuring at the codegen level. Strictly more correct, materially more work, and the right answer eventually. Deferred to RFC 8b because the design space (rewrite vs. binding-scheme vs. getter-shim) deserves its own discussion, and the day-1 workaround (drop the destructuring, write `item.qty`) is local and obvious.

- **Compiler hint: `for item in! items`** (or some new sigil) that explicitly opts into tracking. Rejected because making reactivity explicit per-loop is exactly the kind of ceremony Rip's whole reactivity model is designed to avoid. If `cart.items` is reactive, `for item in cart.items` should "just work" — no extra punctuation, no opt-in.

- **Document around it.** Add a prominent "use a child component for reactive list rows" note to the AGENTS guide and call it done. Rejected because every Rip developer hits this exact bug, and a docs note is a tax paid forever to avoid a one-time codegen change.

### Relationship to other RFCs

Independent of every other RFC. RFCs 1–5 concern the type and packaging story; RFC 6 cleans up the `@rip-lang/app` export surface; RFC 7 concerns routing. RFC 8 lands purely in `src/components.js` (codegen) and `AGENTS.md` (the tracking-rule docs).

### Migration

None. This is strictly more reactivity than today, never less. Existing code's update granularity gets finer; behavior doesn't change.

### Test plan

A dedicated test in `test/rip/` covering:

- `for x in stashArray` then `x.prop` in a text node — mutating `x.prop` updates the text node without rebuilding the parent.
- `for x in [1,2,3]` (non-reactive source) — emits no per-element effect, behavior unchanged.
- `for x in cart.items` then `<input value: x.qty>` — typing into the input then mutating `x.qty = n` from outside updates the displayed value without blurring the input.
- Alias propagation: `for item in items` then `local = item; <td>= local.qty` — mutating `item.qty` updates the cell.
- Object destructuring: `for {profile} in users` then `<td>= profile.name` — mutating `users[i].profile.name` updates the cell.
- Reassignment retracts tracking: `local = item; local = somethingElse; local.foo` — the read of `local.foo` is not tracked once `local` no longer references the proxy.
- Primitive destructuring stays static (until 8b): `for {qty} in items` then `<td>= qty` — mutating `items[i].qty` does *not* update the cell; documented behavior.
- Nested loops over reactive sources — each loop's iter var tracks independently.
- Shadowed name (`for x in items` containing `for x in subitems`) — inner `x` shadows outer; both tracked correctly.
- Cart example fixture — the `+`/`−`/typed-quantity case from this README ends up green.
