# Rip RFCs

Design proposals under discussion. The **Tags** column groups by area (`type-system` · `runtime` · `compiler` · `packaging` · `data`) — labels, not partitions, so a cross-cutting RFC carries several.

|    # | RFC                                                                                                                                                                | Tags                      | Status               |
| ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | -------------------- |
|    1 | [Explicit prop optionality with `?::`](#rfc-1-explicit-prop-optionality-with-)                                                                                     | `type-system`             | ✅ Implemented        |
|    2 | [Rip packages exposing types to typed Rip apps](#rfc-2-rip-packages-exposing-types-to-typed-rip-apps)                                                              | `type-system`             | ✅ Implemented        |
|    3 | [App framework types for ambient globals](#rfc-3-app-framework-types-for-ambient-globals)                                                                          | `type-system`             | ✅ Implemented        |
|    4 | [Typed `this` shape for components and server handlers](#rfc-4-typed-this-shape-for-components-and-server-handlers)                                                | `type-system`             | ✅ Implemented        |
|    5 | [Typed routes — `href` typing, typed `router.push`, per-route `@params`](#rfc-5-typed-routes--href-typing-typed-routerpush-per-route-params)                       | `type-system`             | ✅ Implemented        |
|    6 | [Trim and align the `@rip-lang/app` global surface](#rfc-6-trim-and-align-the-rip-langapp-global-surface)                                                          | `runtime`                 | ✅ Implemented        |
|    7 | [Routing ergonomics — active link, scroll, and the `data-router-ignore` opt-out](#rfc-7-routing-ergonomics--active-link-scroll-and-the-data-router-ignore-opt-out) | `runtime`                 | ✅ Implemented        |
|    8 | [Tracking property accesses on `for`-loop iteration variables](#rfc-8-tracking-property-accesses-on-for-loop-iteration-variables)                                  | `compiler`                | ✅ Implemented        |
|    9 | [Consuming Rip packages](#rfc-9-consuming-rip-packages)                                                                                                            | `packaging`               | ✅ Implemented        |
|   10 | [Rename bundle `components` → `modules`, prefix every entry by origin](#rfc-10-rename-bundle-components--modules-prefix-every-entry-by-origin)                     | `packaging`               | ✅ Implemented        |
|   11 | [Render-ready state](#rfc-11-render-ready-state)                                                                                                                   | `data`                    | ✅ Implemented        |
|   12 | [Unified emitter](#rfc-12-unified-emitter)                                                                                                                         | `compiler`, `type-system` | 🚧 In progress |

---

## RFC 1: explicit prop optionality with `?::`

> **Status: Implemented.**

**Why this is the first RFC.** RFC 1 is foundational because every later RFC that authors types in `.rip` source — RFC 2 (package annotations), RFC 3 (framework annotations), RFC 4 (synthesized `this` types) — will write optional fields on options objects (`launch hash?:: boolean`, `createResource opts?:: ResourceOpts`). Landing `?::` second means writing those annotations twice — once with `:: boolean | undefined := undefined` workarounds, once with `?::` after migration. Removing the broken type-suffix operators (`T?`, `T??`, `T!`) at the same time keeps the spec clean for everything that follows.

**Problem:** Today, optionality is determined solely by whether a prop has a default value (`:=`). There is no way to declare an optional prop with no default value. The common pattern `@label:: string := null` doesn't actually type-check in a strict project — `rip check` reports `Type 'null' is not assignable to type 'string'`. Workarounds exist (`@label:: string := ""`, `@label:: string | undefined := undefined`, widening the type to `any`), but none of them say what we actually mean: "optional, no default." `@label?:: string` should be the natural spelling. (`| null` is semantically wrong here; TypeScript's `?` adds `undefined` to the union, not `null`. `null` means "explicitly set to nothing," while `undefined` means "not provided" — optional props are the latter.)

**Scope — four parse contexts where `?::` should mean "optional".** Today only two of the four honor the marker; the other two silently drop it. RFC 1 unifies the rule across all four.

| Context                                             | Example                           | Works today?                                                                |
| --------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Function/method params                              | `def f(x?:: T)`                   | ✅ Implemented — lexer predicate → DTS `x?: T`                               |
| Named type alias fields                             | `type T = { x?: string }`         | ✅ Implemented — same flag, same DTS path                                    |
| **Component prop declarations**                     | `@label?:: string`                | ❌ — components emitter ignores `?` on prop names; keys optionality off `:=` |
| **Structural type literals in annotation position** | `(opts:: { search?: string }) ->` | ❌ — the `?` is silently stripped, every field types as required             |

The two failing cases share a root: the predicate flag is set on the property name but never consulted by the emitter for that context. The structural-literal failure is particularly silent — no parse error, no warning, just every field treated as required at the call site (caught only when the type checker rejects partial calls).

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
3. `@prop:: type := val` without `?` would technically become **required with a default** — the caller must pass it, but it has a fallback value. This is valid TypeScript but rare in practice; it's called out here because it's what the current `@prop:: type := val` syntax means today, and the migration would convert all of these to `@prop?:: type := val` (no real "required with default" usage exists in the codebase today)

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
- Mostly mechanical: a single regex find-and-replace over `@prop:: type := val` → `@prop?:: type := val`.

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

> **Status: Implemented.**

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

> **Status: Implemented.**

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

Depends on RFCs 1, 2. Sources the `__RipApp` and `__RipRouter` types that RFCs 4 and 5 reference. Composes with RFC 6 (the renamed/trimmed exports flow through the import path unchanged).


## RFC 4: typed `this` shape for components and server handlers

> **Status: Implemented.**

Inside a component body, the magic `@` context exposes a fixed set of injected members: `@app`, `@router`, `@params`, `@query`, `@rest`, `@children`, plus the five lifecycle hooks the runtime recognizes (`beforeMount`, `mounted`, `beforeUnmount`, `unmounted`, `onError` — the canonical list lives in `LIFECYCLE_HOOKS` at [src/components.js](src/components.js#L20)). The renderer constructs each component with `new Component { app, params, query, router }` ([packages/app/index.rip](packages/app/index.rip#L1309)) and the components runtime additionally exposes `this.rest`, `this._rest`, and `this.children`. None of these are visible to the type checker today — every access types as `any`. (Side note: the hook names are not currently documented in `docs/RIP-APP.md` or `AGENTS.md` — the only public hint is the brief `mounted`/`unmounted` comment at [packages/app/index.rip](packages/app/index.rip#L857). Worth fixing alongside this RFC so the typed shape and the prose docs land together.)

The server side has the same problem with the same shape. API route handlers in `@rip-lang/server` get the same magic `@` context as components — `@req`, `@json()`, `@send()`, `@session`, `@params`, `@query`, plus the auth-helper return values from the framework's routing pattern. Today these all type as `any`. Without typed handler `this`, typing the cart example's API routes (or any typed Rip backend) bottoms out at the first `@req.headers` access.

Both gaps are the gap RFC 3 explicitly leaves open: RFC 3 types module-level imports, but per-instance injected members live on `this`, not on any importable name. Typing them needs its own pipeline hook — the same hook on both sides.

### Proposal — synthesize `__RipComponentThis` and bind it as `this:` for every component

Same precedent as `__RipStash` in [src/typecheck.js](src/typecheck.js): the type checker splices a synthesized type into the shadow TS source at the entry-file anchor, and the compiler emits a `this:` parameter on the function it generates for each `component`-form so the language service ties the two together.

Members of `__RipComponentThis`:

- `app: __RipApp` — the stash type that already exists today (`__RipStash`-flavored, sourced from the project's `stash.rip` if present, otherwise `Record<string, unknown>`)
- `router: __RipRouter` — sourced from RFC 3's annotated `createRouter` return type
- `params: Record<string, string>` — uniform baseline; **RFC 5 tightens this to per-route shapes** for components that live under `routes/` (leaf routes get `{ id: string }` for `routes/users/[id].rip`, etc.); layouts and shared components stay on the baseline
- `query: URLSearchParams` — matches what `createRouter` actually puts on the instance
- `rest: Record<string, unknown>` — the catch-all for unconsumed props
- `children: unknown` — slot content; widened because the framework places no constraint on what a parent passes
- `beforeMount?(): void` — fires before initial DOM mount; effects created here auto-register on the component
- `mounted?(): void` — fires after initial DOM mount; runs once per visit
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

RFC 3 is "ambient module exports become imports." Instance members aren't exports — there's no `this` binding to import. They're injected by the framework's component constructor (or the server's handler dispatcher) at runtime, and the natural type-system parallel is a synthesized `this:` parameter, not an import. Different shape, different mechanism. Bundling the two into one RFC would conflate them; splitting keeps each RFC's mechanism crisp.

### Server handler `this` — same machinery, different members

The server side is a pure mirror. Same splice, same `this:` parameter, different member set. Calling it out explicitly so the implementation work isn't double-counted:

Members of `__RipServerHandlerThis`:

- `req: Request` — the standard fetch `Request` instance the server is built on
- `params: Record<string, string>` — route params from the path matcher
- `query: URLSearchParams` — parsed query string
- `session: Record<string, unknown>` — session bag (typed `unknown` until session schemas are formalized)
- `json(body?: unknown, status?: number): Response` — JSON response helper
- `send(path: string, type?: string): Promise<Response>` — file-serving helper
- `redirect(url: string, status?: number): Response` — redirect helper

In `src/typecheck.js`, `buildServerHandlerThisType()` sits next to `buildComponentThisType()` and uses standard lib types for `req`/`query`. In `@rip-lang/server` itself ([packages/server/server.rip](packages/server/server.rip)), the route-registration helpers (`get`, `post`, `put`, `delete`, etc.) get RFC 2-style annotations so their handler argument is typed as a function with `this: __RipServerHandlerThis` — the package source is the contract, the DTS pipeline does the rest.

Multi-field input validation — the typical companion to a typed handler — is covered today by `schema :input` with `.safe()`, which already has its own DTS pipeline (`src/schema/dts.js`) and returns `{ok, value, errors}`. The single-field `read()` helper stays as today (returns `unknown` in typed contexts); narrowing its return via string-literal validator overloads was prototyped and dropped — the win was small (one-liner casts at call sites) and the cost was real (~30 hand-maintained overloads kept in sync with `validators` in `packages/server/api.rip`).

### Alternatives considered

- **Type the existing `__Component` base class; let inheritance do the work.** The runtime already emits `class Foo extends __Component` (verified by compiling a probe component with `./bin/rip -c`). If `__Component`'s DTS declared the injected members — `app`, `router`, `params`, `query`, `rest`, `children`, plus the optional lifecycle hooks — every user component would inherit them through ordinary TS class inheritance. No splice into the shadow source, no synthetic `this:` parameter, no per-component DTS gymnastics. A user-written `mounted: ->` becomes a method override of the optional base member, which is exactly the relationship TS is designed to model. Rejected as the **primary** mechanism, kept as a future simplification: per-route `params` tightening (RFC 5) is awkward through inheritance, because each component file would need a different generic instantiation of the base, threaded through the components emitter on a per-file basis. The splice approach already has the file path in hand inside `typecheck.js` and can specialize `params` cheaply. Worth revisiting if RFC 5's per-route specialization is later dropped or moved entirely into the renderer.

- **Annotate the `component` factory with `ThisType<__RipComponentThis>`.** TypeScript provides a built-in marker for "infer `this` inside this body": `ThisType<T>`. If the `component` export in `packages/app/index.rip` were typed as a factory taking `ThisType<__RipComponentThis> & ComponentBody`, TS would bind `@app` etc. inside the body without any type-checker pipeline change — pure RFC 2 mechanism, one annotation, done. Rejected because the components emitter today produces a class declaration, not a callback to `component(...)`; the `component` keyword is parsed as a class form, not a function call. To make `ThisType` apply, either the runtime emit would have to change to a callback form (much larger scope, runtime impact, performance regression risk) or the DTS would have to lie about the emit shape. The proposal already accepts a small DTS-only fiction (the `this:` parameter), so this isn't categorically worse, but it solves a smaller slice of the problem at the same cost.

- **Per-component-class generated types** that inspect each component's actual props/state and emit `declare class Foo extends __Component { count: __State<number>; clearFilters(): void; ... }` per file. Strictly more precise — would type user-defined state and methods, not just the injected baseline, and would also help sibling components that import each other. Rejected as too costly: requires a second type-inferer in the components emitter that walks every `name := value` and `name: ->` and infers a TS type from the RHS expression. That's a substantial new piece of compiler infrastructure for a moderate gain over the proposal. Stays as future work; the injected baseline is the "free win" subset.

- **Have the user write `@:: __RipComponentThis`** (or some new sigil) at the top of each component to opt into typed `this`. Rejected — silent universal coverage matches the model of `__RipStash` (no per-file declaration needed) and avoids a 200+ file migration in the UI package alone. The whole point of synthesizing a type is to make it free.

- **Open `interface __RipComponentThis` for declaration merging.** Not a competing alternative — it composes with the proposal. If `__RipComponentThis` is emitted as an `interface` (not a `type` alias), advanced users could augment it from their own code to add app-specific injected members (custom helpers a project's renderer wraps in). Worth doing as part of the proposal; costs nothing.

### Relationship to other RFCs

Depends on RFCs 1 (annotation syntax), 2 (DTS pipeline), 3 (sources `__RipApp`, `__RipRouter`). Unblocks RFC 5 (typed `@router.push`, per-route `@params` tightening).


## RFC 5: Typed routes — `href` typing, typed `router.push`, per-route `@params`

> **Status: Implemented.**

The runtime-side ergonomics from RFC 7 (active link, scroll restoration) make the router pleasant. RFC 5 closes the type-system side: `<a href: "/crat">` should be a compile error in a typed app, not a 404 at runtime; `@router.push '/cart'` should validate against the actual route tree; `@params.id` in `routes/users/[id].rip` should type as `string` rather than `string | undefined`.

Untyped apps see no change from this RFC. RFC 5 is purely a `rip check` upgrade.

### Proposal

**1. Type the `href` attribute on `<a>` against a generated `__RipRoutes` union.**

At type-check time, walk the project's routes directory (mirroring `findStashFile` / `__RipStash` in [src/typecheck.js](src/typecheck.js)). The directory defaults to `<appDir>/routes/` to match the `serve()` middleware's default — see [packages/server/middleware.rip](packages/server/middleware.rip), where `routes` is read off the serve options and the on-disk files are mounted under the `components/` key in the bundle (which is why `createRouter` reads from `root: 'components'` while the disk layout uses `routes/`). The path should be readable from `package.json#rip.routes` (per RFC 9's config consolidation, default `"routes"`) so the type-checker stays in sync if a project overrides it.

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

**2. Type `router.push` and `router.replace` against `__RipRoutes`.**

The same type applies to the argument of `router.push` / `router.replace` so programmatic navigation gets the same validation as link clicks. (`router.push` likely wants `__RipRoutes` only, since pushing an external URL through SPA navigation doesn't make sense — that's a `window.location.href = ...` operation.) This piece **depends on RFC 4** — `@router.push` is only typed if the component's `this.router` is typed, which is what RFC 4 establishes.

**3. Per-route `@params` tightening.**

RFC 4 types `@params` as `Record<string, string>` for every component. RFC 5 tightens this for components that live under `routes/`: the route-tree walker already in step 1 knows each leaf route's dynamic-segment names, so it can synthesize a per-file param shape:

- `routes/users/[id].rip` → `params: { id: string }`
- `routes/blog/[slug]/[part].rip` → `params: { slug: string; part: string }`
- `routes/admin/[...rest].rip` → `params: { rest: string }` (catch-all)

Emitted into the same shadow-TS slot RFC 4 uses for `__RipComponentThis`, but specialized per file — one synthesized type variant per route file, applied via the entry-file anchor. Layouts (`_layout.rip`) and components imported from `components/` rather than `routes/` stay on RFC 4's baseline `Record<string, string>` because they don't have a single deterministic param shape.

### Caveats of the template-literal approach

Distinct from the external-URL story above, the `__RipRoutes` union itself is loose on dynamic segments — `${string}` accepts any string, including the empty string and strings containing slashes:

- `<a href: "/users/">` type-checks (matches `` `/users/${string}` ``); the runtime would 404 it.
- `<a href: "/users/foo/bar">` type-checks against `/users/${string}` even though `[id]` is conceptually one segment.
- Catch-all routes (`[...rest]`) type as `` `/admin/${string}` ``, which over-accepts but never under-accepts.

This is a real precision gap, not a footnote. The proposal catches typos in the static prefix (`/crat` vs. `/cart`) and unknown route names — the most common authoring bugs — but does not catch malformed dynamic segments. Empty IDs and slash-bearing IDs both type-check today and 404 at runtime; that won't change with this RFC.

Fully tight per-segment typing requires the TanStack-style approach: type each route as `{ to: "/users/$id", params: { id: string } }`, separating the path template from the params. That changes the source idiom — `<a href: "/users/#{id}">` becomes `<a href: route("/users/$id", id: id)>` or similar — which is the typed/untyped divergence this RFC is explicitly trying to avoid. The proposal here trades segment-shape precision for source-form parity. If the looseness causes real bugs in practice, a follow-up RFC can layer per-segment validation on (the underlying route tree is already known at type-check time), but ship the prefix-discriminated version first and see whether the gap matters.

### Effect on existing code

**Untyped apps.** No change. No annotation, no opt-in, no behavior difference. The browser runtime never sees `__RipRoutes`.

**Typed apps.** The type pipeline gains `findRoutesDir` and `buildRoutesType` in `src/typecheck.js`, and `src/dts.js` gains an `__RipAnchorAttrs` slot in `__RipElementMap` plus typed signatures for `router.push` / `router.replace`. Both follow the existing `__RipStash` precedent, and the per-route `@params` tightening lives in the same walker. `<a href: "/cart">` and `@router.push "/cart"` in a typed file both validate against the project's actual route tree. **Migration:** any existing typed app with a real route typo will now get a `rip check` error where it previously had a green build and a 404 at runtime — that's the feature, but it's worth noting that "no migration needed" is conditional on the existing routes being correct.

### Relationship to other RFCs

Depends on RFC 2 (DTS pipeline), RFC 3 (typed router exports), RFC 4 (typed component `this` for `@router.push` and per-route `@params`). Composes with RFC 7 (runtime ergonomics on the same `<a>` element). Reads `routes` directory location from `package.json#rip.routes` (RFC 9).

### As-built notes (deviations from the proposal above)

Two decisions changed during implementation; recorded here so the proposal text isn't read as the final design:

1. **`href` typing uses a `const`-generic conditional, not `__RipRoutes | __ExternalHref`.** The `__ripEl` declaration is specialized to `<K, const H extends string>` so a `/`-prefixed string *literal* must satisfy `__RipRoutes`, while external schemes (`https:`, `mailto:`, `tel:`), fragments (`#x`), and any dynamic `string` value fall through to `H` unchecked. This drops the need to enumerate external URL shapes (`__ExternalHref` no longer exists) and removes the protocol-relative/exotic-scheme false positives the proposal called out — those now pass as plain strings. Interpolated `/`-prefixed templates are wrapped by the compiler in a `__ripRoute(...)` helper so they're still checked against the union.

2. **Routes directory is the fixed convention `app/routes/`, not `package.json#rip.routes`.** The config knob was dropped. Rationale: the type-checker must walk the *same* directory `@rip-lang/server`'s `serve dir: "<root>/app"` actually serves, or route-typo checking silently desyncs from runtime; a configurable path is a second place for the two to drift and, when mismatched, fails silently (`__RipRoutes` resolves to `any`). If a multi-root layout ever needs it, the knob can return as a narrowing override defaulting to `app/routes`. (The RFC 9 cross-reference above is therefore moot for RFC 5.)

Also: catch-all routes (`[...rest].rip`) are *excluded* from the `__RipRoutes` union (they're 404 fallbacks, not navigation targets; including them as `/${string}` would defeat typo-catching), though they still contribute their `{ rest: string }` shape to per-route `@params`.


## RFC 6: Trim and align the `@rip-lang/app` global surface

> **Status: Implemented.**

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

- **One namespace global (`globalThis.Rip`), every helper accessed as `Rip.*`.** An earlier sketch in this RFC. Rejected because it forces a prefix on the eleven well-named globals to fix the four problematic ones — universal cost for partial benefit. Also introduces a typed/untyped divergence (typed apps import, untyped use `Rip.*`) that this proposal avoids.

- **Rename the four timing helpers too** (`delay` → `reactiveDelay`, `hold` → `reactiveHold`, etc.). Considered and rejected: they form a coherent vocabulary with `debounce` and `throttle`, the names match what the function does, and the prefix would be uglier than the problem. The AGENTS.md warning is sufficient mitigation for the timing family.

- **Status quo.** Keep all sixteen exports, including `isStash` (zero users) and the misleadingly-named `stash` and `raw`. Rejected because the rename window is now — both names have zero real call sites and one of them (`stash`) collides with a language keyword, which is the kind of mistake worth fixing before the surface grows.

- **Compiler warning when a `let` declaration shadows an injected global.** Not a competing alternative — it composes with this proposal. Could be added as a future diagnostic in the lexer/rewriter to make the shadowing footgun loud rather than silent. Out of scope for this RFC, but the four-name list (`delay`, `hold`, `debounce`, `throttle`) is exactly the right input.

### Relationship to other RFCs

Independent of every other RFC. Composes with RFC 3 (the renamed exports flow through the import path unchanged). Does not block, and is not blocked by, anything in Domain A or C.


## RFC 7: Routing ergonomics — active link, scroll, and the `data-router-ignore` opt-out

> **Status: Implemented.**

Rip's app framework today gives you file-based routes and document-level `<a>` interception. Two ergonomic gaps that every modern SPA router covers are still open: **highlighting the active link** (so the current page can be styled distinctly in a nav bar) and **scroll position management on navigation** (the back button currently leaves you wherever you were on the new page, which is wrong almost everywhere). A third item — the existing `data-router-ignore` attribute — already works at runtime but isn't in the docs. RFC 7 covers all three, plus the small framing of why programmatic navigation needs no new API.

The matching type-system work — typed `href` against a generated `__RipRoutes` union, per-route `@params` tightening, typed `router.push` — is a separate proposal, RFC 5, because it has a different mechanism (DTS splice, depends on RFCs 2/3/4) and a different audience (typed apps only) from the runtime-ergonomics work below.

### Background — what the router already provides

`createRouter` in `packages/app/index.rip` already does three things relevant here. First, it intercepts plain `<a>` clicks at the document level and routes same-origin links through SPA navigation, with a skip list (`target="_blank"`, `[download]`, `[data-router-ignore]`, cross-origin, links outside `base`) for cases that should fall through to the browser. Second, it tracks `router.path` as a reactive signal that updates on every navigation. Third, it exposes `router.push(url)` and `router.replace(url)` for programmatic navigation. So this RFC isn't proposing a new navigation primitive; it's adding ergonomics on top of what's already there.

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

**Behavior change:** every `<a>` inside the router's `base` that wasn't already setting `aria-current` will now have it set on every navigation. Apps relying on the previous "no `aria-current` ever" behavior (unlikely but possible) need to opt out per-link with `data-router-ignore` or by setting `aria-current` manually before the walker runs.

The `aria-current` walker is `O(n_anchors)` per route change. For typical nav bars with tens of links this is invisible; on pages with thousands of anchors a route-indexed cache or `IntersectionObserver`-scoped walk would handle it. Not a v1 concern.

**2. Scroll restoration.**

Every SPA router has to decide what happens to scroll position on navigation. Today, `createRouter` does nothing — the back button leaves you wherever you were on the new page. Match SvelteKit's defaults:

- **New navigation** (`router.push` or a link click) → scroll to top.
- **Back / forward** (popstate) → restore the scroll position saved in `history.state`.
- **Same-document `#fragment` link** → scroll to the element with that ID (browser default; just don't override it).
- **Opt-out** → `data-router-noscroll` on a link, or `router.push(url, noScroll: true)` programmatically.

Enabled automatically. Doing nothing is a worse default than "scroll to top," and the override surface for the rare "don't scroll" case (a tab switcher that updates the URL without changing what's on screen) is small. Implementation is roughly: capture `window.scrollY` into `history.state` before each `pushState`, restore it on `popstate`, and reset to `(0, 0)` on `pushState` unless the opt-out is set.

**This is a behavior change for every existing app.** Today every navigation leaves the scroll position wherever it was; after this RFC, every push-style navigation jumps to the top. That is the correct default for almost every app — but it *will* change visible behavior, and apps that intentionally update the URL without changing what's on screen (tab switchers, filter bars, sub-route swaps inside a scrolled container) will need to add `data-router-noscroll` to the relevant links. Worth calling out in the release notes, not buried.

**3. Document the existing `data-router-ignore` opt-out.**

It already works at runtime; it's just not in the public surface yet. Adding it to `docs/RIP-APP.md` and `AGENTS.md` is the only "new" thing here. Pure documentation, no code change.

### What about programmatic navigation?

Programmatic navigation (a successful async action that should redirect the user, like `await login(); router.push '/dashboard'`) is the obvious companion case to clicking a link. The good news: **Rip already has it.** `router.push(url)` and `router.replace(url)` are stable methods on the router object that's already passed to every component as `@router`. The replacement-vs-push distinction (login redirect that shouldn't appear in back-button history → `replace`; normal nav → `push`) lives there, where it belongs. No new API needed; only RFC 5's typing of the `url` argument.

### What this RFC does *not* propose, and why

- **A `Link` component.** Most framework UIs ship one (TanStack, Vue, Solid, React Router); SvelteKit doesn't, and Rip should follow SvelteKit. A typed-only `Link` would be the first place in Rip where adding types changes the source idiom rather than just validating it — a divergence not paid anywhere else (`::`, `rip.json strict`, schemas all validate an unchanged API). It also wouldn't help markdown, CMS output, or third-party widgets, which all emit `<a>`. Type safety on the route value can be done on the `href` attribute directly (RFC 5).
- **A `data-router-active-class` attribute.** `aria-current="page"` plus `[aria-current="page"]` in CSS covers the common case. A custom class is usually wanted for prefix-match active state (`/blog` styled active on `/blog/*`), which is a separate feature with separate rules — defer.
- **A `data-router-replace` attribute.** Programmatic replace already exists via `router.replace`; click-time replace has no compelling use case.

### Effect on existing apps

Two real behavior changes — `aria-current` is set automatically on active anchors, and scroll position resets to top on push-style navigation. Surface stays the same: no new global, no new component, no new import; existing `<a href>` markup is unchanged.

Both changes have per-link opt-outs (`data-router-ignore` for `aria-current`, `data-router-noscroll` for scroll) and a programmatic opt-out for scroll (`router.push(url, noScroll: true)`). Apps that hit the edge cases (deliberate manual `aria-current` management, tab-switcher links that shouldn't scroll) update those links once.

### Relationship to other RFCs

Independent of every other RFC. RFC 5 handles the type-system side of routing (`href` typing, per-route `@params`, typed `router.push`); the two are complementary but neither blocks the other.


## RFC 8: Tracking property accesses on `for`-loop iteration variables

> **Status: Implemented.**

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

When the compiler emits a `for x in expr` loop body, if `expr` is already reactive (i.e. would itself be wrapped in an `__effect` by the existing `hasReactiveDeps` check), then within that loop body **direct member access on the iter var** is reactive and gets the same effect-wrapping treatment as a `this`-rooted access.

Scope is intentionally narrow: just the iteration variable itself. `for item in cart.items` then `item.qty`, `item[0]`, `item.foo.bar` becomes reactive. That's the case the cart example actually hits, the case every list-of-reactive-objects template hits, and the smallest change that closes the gap.

Concretely, in `src/components.js`:

- The loop emitter already pushes `{ itemVar, indexVar }` onto `_loopVarStack` before walking the body and pops after.
- Add a `reactiveSource: bool` field — captured at push time from the same check that decides whether `__reconcile` is wrapped in `__effect`. When true, `itemVar` is added to a scope-local tracked-names set as the body walk begins, and removed on pop.
- Extend `hasReactiveDeps(node)` to return true when `node` is a member access whose root identifier is in the current tracked-names set. The reactive-source check has already happened at insertion time, so lookup is just a set membership test.

The existing emit paths (`emitAttributes`, the text-interpolation path, `emitConditional`) already route reactive expressions through `_pushEffect` — they'd start firing for `item.foo` automatically. The patch function `p()` would receive the per-row effects it currently lacks, and the row's DOM nodes would update in place when the underlying signals fire. Identity is preserved — no reconciler rebuild, no input blur.

**Deferred — alias propagation, object-shaped destructuring, and primitive destructuring.** Three cases that share a tracking-set-propagation mechanism, all out of scope:

- **Aliases and rebindings.** `for item in items` then `local = item; local.foo`. `local` references the same proxy as `item`; tracking it requires scope-aware analysis (track the binding, retract on reassignment, handle nested scopes).
- **Object-shaped destructuring of reactive references.** `for {profile} in users` then `profile.name`. `profile` is still a proxy reference; same propagation work as aliases.
- **Primitive destructuring.** `for {qty} in items` then `qty * 2`. Genuinely different — once destructured, `qty` is a `Number`, no longer a proxy reference. A fix would have to rewrite reads back to `item.qty`, abandon JS destructuring at codegen, or introduce a getter-binding scheme.

Workaround for all three: don't alias, don't destructure — write `item.foo` directly. Local, obvious, and one-line. No observed real-world demand has surfaced; if it does, the design can be reopened with full context.

**Pros:**
- Closes the gap between "what users expect from fine-grained reactivity" and what the compiler actually delivers. The cart-row case (and every list-of-reactive-objects case using direct iter-var access) just works.
- Eliminates the one workaround that exists purely for compiler reasons rather than design reasons. "Extract a child component to make per-row updates reactive" stops being a recommendation; component extraction is once again only about composition and reuse.
- Behavior change is small but real: today, `item.qty` in a template reads once and never updates on in-place mutation; after this RFC, it does. Existing code that *intentionally* relied on the stale-read behavior would change, but that pattern is vanishingly rare and would be better written as a non-reactive snapshot anyway.
- Removes the ergonomic tax of extracting a child component just to get per-row reactivity. The child-component pattern still works (and is still right when composition or reuse is the real motivation), but it stops being mandatory for this one compiler-shaped reason.
- Simpler mental model. AGENTS.md's tracking rule changes from "rooted at `this`" to "rooted at `this` or at a reactive iter var" — slightly longer but still teachable.
- Implementation is small: one flag on the loop stack, one set lookup in `hasReactiveDeps`. No scope walker, no propagation pass, no destructuring rewrite.

**Cons:**
- Aliases (`local = item`) and destructuring (`{profile} = item`, `{qty} = item`) all stay static and silent. `for {qty} in items` then `qty * 2` does not become reactive, and there's no warning. Called out in the docs; could be surfaced as a lint or compile-time hint later.
- Iteration over a `~=` computed that returns fresh objects each recompute is wasteful — N per-element effects get torn down and recreated on every recompute, doing work the reconciler already handles via identity change. Not a correctness issue, but worth a docs note: "if your iter source is a `.map`-returning computed, push the reactivity to the source instead of relying on per-element tracking."
- Per-row effect creation is new work on every list render. For lists with thousands of rows times tens of reactive reads, this is observable. Not a v1 blocker for the cart-shaped lists this targets, but flagged here rather than in a Cons-as-asterisk.

### Implementation notes

- **Where the work lands.** `src/components.js`: the loop emitter (the `_loopVarStack` push/pop) gains a `reactiveSource` flag, and `hasReactiveDeps` gains a tracked-names set lookup. Hot path — every `for` in every render — but the per-node cost is one set membership test.
- **Reactive-source detection.** "Source is reactive" reuses the existing `hasReactiveDeps` check that already decides whether to wrap `__reconcile` in `__effect`. The edge cases (`for x in [1,2,3]` — no; `for x in cart.items` — yes; `for x in someLocalArray` — depends) all fall out of the existing analysis.
- **Tracked-name propagation.** Scope-aware analysis for assignments (`local = item`) and object destructuring (`{profile} = item`). Has to handle nested scopes (loops, blocks, function expressions), reassignment (`local = somethingElse` retracts the tracking), and the proxy-preserving vs primitive-destructuring distinction. Small but real.
- **Two update paths interact.** The existing reconciler (handles identity / order / length) and the new per-property effects (handle in-place mutation) are complementary but need explicit test coverage — especially the case where both fire in the same flush.
- **Test surface.** Nested loops, shadowed names, iteration over non-reactive sources, alias chains, object-destructuring chains, reassignment retraction. See the **Test plan** section below.

### Alternatives considered

- **Status quo + child-component workaround.** Current state. Rejected as the long-term answer because it makes every list-of-reactive-objects template require a child component for compiler reasons, not design reasons. The workaround is fine when component extraction is wanted anyway; it's a tax when it isn't.

- **Runtime-only solution: have the proxy track reads inside any effect.** It already does — that's why `cart.totalPrice()` works. The issue is that the compiler never *creates* an effect around the per-row reads in the first place, so there's no effect for the runtime tracking to attach to. This isn't a runtime gap; it's a codegen gap. Shipping a "smarter proxy" doesn't fix the missing effect wrapper.

- **Aggressive variant: include alias propagation and primitive destructuring.** Tracks `local = item; local.foo` and `for {name, qty} in items` → `qty * 2` by adding scope-aware tracking-set propagation and either source-rewriting destructured reads back to `item.qty` or abandoning JS destructuring at codegen. Strictly more correct, materially more work (a new dimension of compiler analysis the codebase doesn't currently model), and not yet demanded by any real app. Deferred until that changes — the workaround (drop the alias / destructuring, write `item.foo`) is local and obvious.

- **Compiler hint: `for item in! items`** (or some new sigil) that explicitly opts into tracking. Rejected because making reactivity explicit per-loop is exactly the kind of ceremony Rip's whole reactivity model is designed to avoid. If `cart.items` is reactive, `for item in cart.items` should "just work" — no extra punctuation, no opt-in.

- **Document around it.** Add a prominent "use a child component for reactive list rows" note to the AGENTS guide and call it done. Rejected because every Rip developer hits this exact bug, and a docs note is a tax paid forever to avoid a one-time codegen change.

### Relationship to other RFCs

Independent of every other RFC. RFCs 1–5 concern the type and packaging story; RFC 6 cleans up the `@rip-lang/app` export surface; RFC 7 concerns routing ergonomics. RFC 8 lands purely in `src/components.js` (codegen) and `AGENTS.md` (the tracking-rule docs).

### Migration

None. This is strictly more reactivity than today, never less. Existing code's update granularity gets finer; behavior doesn't change.

### Test coverage

Three snapshot tests under the "Reactive `for`-loop iter vars" section of [test/rip/components.rip](test/rip/components.rip):

- **Positive** — `for item in items` (reactive `:=` source) then `span "#{item.qty}"` emits the `__effect`-wrapped read in the per-row `p()`.
- **Gate** — `for item in [{...}, {...}]` (literal source) stays static: `p()` is empty, confirming the tracking is conditional on the source being reactive rather than always-on.
- **Boundary (deferred)** — `local = item; span "#{local.qty}"` is *not* tracked. Pins the alias case; if the alias/destructuring work ever lands, this snapshot flips deliberately.

End-to-end validation is the cart example itself: typing into the quantity input, clicking `+`/`−`, and external mutations to `cart.items[i].quantity` all update the displayed row in place without losing input focus.

---

## RFC 9: Consuming Rip packages

> **Status: Implemented.**

The protocol below — declared deps, undeclared-import diagnostic, auto-discovery, bare-specifier rewrite, package-shape contract — is consumer-agnostic: it applies equally to in-repo apps (`examples/*`, `apps/*`, `packages/*/dev-server`, the widget gallery) and to standalone apps living outside the workspace. The migration plan focuses on in-repo apps because that's the audit scope this RFC commits to; standalone apps inherit the protocol the moment they bump to a release of `@rip-lang/server` that includes it. The separate question of standalone *deployment* plumbing (version skew between npm-published packages and the served `rip.min.js`, removing `link-global` as a dev-machine crutch) is genuinely out of scope and called out below.

### Problem

An app under `examples/cart/` wants to write `import { http } from '@rip-lang/http'` from `app/routes/index.rip` (a browser-side component). Today this works partially on both sides — and the parts that don't work fail in different ways than you'd guess.

**Server side** — "works" by accident. `rip-loader.js` rewrites `@rip-lang/*` imports through `import.meta.resolve`, which lands inside the global `node_modules` tree only because `bun run link-global` previously symlinked the workspace into `~/node_modules/` and `~/.bun/install/global/node_modules/`. The example app declares no dependency on `@rip-lang/http`. Remove the symlink, the import breaks.

**Browser side** — works only with manual config, with two ergonomic gaps. The `serve` middleware in [packages/server/middleware.rip](packages/server/middleware.rip) already supports external dirs in its `bundle:` option ([middleware.rip:797–805](packages/server/middleware.rip#L797-L805)) and emits them into `components/_lib/{bundle-name}/{path}` keys, which the runtime resolver in [packages/app/index.rip](packages/app/index.rip#L908-L922) already consumes. What's missing is the two pieces between "I wrote the import" and "it ends up in the bundle":

1. **No bare-specifier rewrite.** [`compileAndImport`'s blob-URL rewrite regex](packages/app/index.rip#L991) is `/\.rip['"]/` — it matches `'app/http.rip'` but never `'@rip-lang/http'`. A component using the natural specifier silently fails in the browser.
2. **No auto-discovery.** Including a Rip package today requires an explicit `bundle: { app: ['.', '../../../packages/http'] }` line, with the relative path written by hand. The `import` statement in the component file isn't enough.

The two server- and browser-side failures share a root cause: **dependency declaration is implicit, and the loader/bundler are guessing.**

This is also the reason `examples/cart/rip.json` has to exclude `index.rip` and `api/**` from `rip check` — the type-checker can't resolve the undeclared `@rip-lang/server` import either, so the only way to keep the build green is to skip those files. Fixing declaration fixes that exclusion as a side effect.

#### Verified-working manual config (May 2026)

For reference: with this `serve` block in `examples/cart/index.rip` and these import lines in the route files, the cart's products + checkout flow runs end-to-end through `@rip-lang/http`:

```coffee
# examples/cart/index.rip
use serve
  dir: "#{dir}/app"
  bundle: { app: ['.', '../../../packages/http'] }
  watch: true

# examples/cart/app/routes/index.rip
import { http } from 'app/http.rip'
products = http.get!("#{location.origin}/api/products").json!
```

Three things are awkward here, all addressed by this RFC: (a) the relative path `'../../../packages/http'`, (b) the import spec `'app/http.rip'` instead of `'@rip-lang/http'`, and (c) the `"#{location.origin}/..."` URL prefix — that last one is a `@rip-lang/http` bug (`buildUrl` calls `new URL(input)` without a base, which fails on relative URLs in browsers). The URL bug is adjacent and gets fixed in §5's package-shape work, not in the bundling change itself.

#### Standalone evidence (May 2026)

The same pattern is verified working in a standalone app outside this workspace. Its `package.json` declares the published `@rip-lang/http` as a real npm dep:

```jsonc
{ "dependencies": { "@rip-lang/http": "^1.1.122" } }
```

Its `index.rip` adds the same manual `bundle:` entry, just pointed at the locally-installed copy:

```coffee
use serve
  dir: "#{dir}/app"
  bundle: ['.', '../node_modules/@rip-lang/http']
  watch: true
```

And its components import via `'app/http.rip'`, identical to the in-repo cart. Server-side, `rip-loader.js`'s `import.meta.resolve` finds `@rip-lang/http` in the app's own `node_modules` — no link-global crutch involved for *this* package, because the dep is properly declared. This is empirical confirmation that §2 (declared deps in `package.json`) is sufficient for the server-side resolution path, and that the §4 ergonomic gaps (manual `bundle:` entry, bundle-key-shaped import spec) are the same on both sides of the in-repo / standalone divide. Notably, the same standalone app does *not* declare `@rip-lang/server` — its server-side resolution still rides on the link-global symlink that puts `rip-server` on `PATH`. That's the asymmetry §2 fixes by requiring all `@rip-lang/*` consumption to go through declared deps.

### Goal

A single declared way for an app to say "I depend on these Rip packages," with three things honoring it consistently:

1. The Bun loader (server-side `import` resolution).
2. The `serve` middleware's bundle builder (browser-side `import` resolution).
3. Rip resolution itself (an undeclared-import error at the loader and bundler), with `rip check` surfacing the same error earlier when typing is on.

### Proposal

#### 1. Single source of truth: `package.json`

Remove the `rip.json` concept entirely. Everything that lives there today (`strict`, `exclude`, future `routes`, future `deps`) moves under the `"rip"` key in `package.json`:

```jsonc
{
  "name": "cart",
  "private": true,
  "dependencies": {
    "@rip-lang/http":   "workspace:*",
    "@rip-lang/server": "workspace:*"
  },
  "rip": {
    "strict": true,
    "checkAll": true,
    "exclude": []
  }
}
```

`readProjectConfig` in [src/typecheck.js](src/typecheck.js) already supports the `package.json#rip` form; the rip.json branch gets deleted. The VS Code LSP file watchers ([packages/vscode/src/lsp.js](packages/vscode/src/lsp.js)) drop their `rip.json` glob.

**Why one file.** Two config files for a single project is two places to forget. `package.json` is already mandatory for any app that has dependencies (which, after this RFC, all in-repo apps do). The "rip" key keeps Rip-specific config namespaced and out of the way of npm tooling.

**Migration.** Two files exist today: `examples/cart/rip.json` and `examples/form/rip.json`. Fold each into the sibling `package.json` and delete. Trivial to do in one commit.

#### 1a. Decouple strictness from coverage: split `strict` into two flags

Today's `strict` flag is overloaded — it controls two genuinely orthogonal axes, and the conflation is visible in [src/typecheck.js](src/typecheck.js#L2613-L2631):

1. **TS strictness level** — passed through to the TypeScript compiler options (`noImplicitAny`, `strictNullChecks`, the whole `strict` family). Controls *how* annotated code is checked.
2. **File inclusion policy** — `hasTypeAnnotations(source) || strict` at line 2631. Controls *which* files get checked at all (only annotated files vs. every non-`@nocheck` file).

These are independent decisions. The four combinations are all reasonable:

|                | Check annotated files only | Check every file     |
| -------------- | -------------------------- | -------------------- |
| **Lenient TS** | default today              | unreachable today    |
| **Strict TS**  | unreachable today          | `strict: true` today |

The two unreachable cells are real use cases:

- **Lenient TS, check all** — gradual-typing project that wants `rip check` to *see* every file (for RFC 9 §3 undeclared-import diagnostics, RFC 5 `__RipRoutes` building, unused-export hints) without committing to strict-null-checks across the codebase.
- **Strict TS, opt-in per file** — mostly-untyped app that wants the few annotated files held to the strictest standard, without pulling everything else in.

TypeScript itself never coupled these — `strict` is severity, `include`/`files` is scope. The Rip overload was a shortcut that's now in the way of RFC 9 §3 (the undeclared-import check is a scope-of-`rip check` question, not a severity one).

**Proposal.** Split into two flags:

```jsonc
{
  "rip": {
    "strict": true,      // TS strictness family (noImplicitAny, strictNullChecks, …)
    "checkAll": true,    // check every non-@nocheck file, not just annotated ones
    "exclude": []
  }
}
```

**Composition with `exclude`.** Cleanly orthogonal. `findRipFiles()` ([typecheck.js:2617](src/typecheck.js#L2617)) applies `exclude` patterns first — those paths never enter the candidate set. `checkAll` then runs over only the survivors. So `checkAll: true` + `exclude: ["legacy/**"]` means "check every file except the legacy tree." Three layered filters, in order:

1. **`exclude`** — filesystem-level removal (path globs)
2. **`# @nocheck`** — file-level opt-out (per-file pragma; always wins, regardless of `checkAll`)
3. **`checkAll` vs. annotated-only** — decision policy on what survives the first two

**Defaults for a fresh project.** Omitting the `"rip"` key entirely (or declaring it empty) should give:

```jsonc
{ "strict": false, "checkAll": false, "exclude": [] }
```

A brand-new app is zero-config and starts permissive. This matches the existing philosophy comment in [src/typecheck.js](src/typecheck.js#L609-L618) ("opt UP to strict") and the mypy / Hack / pre-strict-TS precedent: gradual typing means new projects start permissive and tighten as they grow. The expected opt-in path:

| Project stage                            | `strict` | `checkAll` |
| ---------------------------------------- | -------- | ---------- |
| Brand-new app, no types yet              | `false`  | `false`    |
| Sprinkling `::` annotations on new files | `false`  | `false`    |
| Want no file to slip through untyped     | `false`  | `true`     |
| Mature, fully-typed codebase             | `true`   | `true`     |
| Library / package author (`packages/*`)  | `true`   | `true`     |

**Migration.** Existing `strict: true` projects keep behavior with `{ strict: true, checkAll: true }` — the migration that folds `rip.json` into `package.json#rip` (§1) also expands the old flag into the new pair. The auto-detection rule in [AGENTS.md](AGENTS.md) ("typed if `strict: true` or any `::` annotation") becomes "typed if `strict`, `checkAll`, or any `::`" — same triggering surface, one extra term.

**Why land it here.** §1 is already rewriting `readProjectConfig` to move config from `rip.json` to `package.json#rip` and adding the new `routes` field. Splitting `strict` is a one-line shape change to the same function in the same PR. Deferring the split means migrating the conflated flag once and then migrating it again.

#### 2. Dependencies are declared in `dependencies`, not invented

Rip packages are normal npm packages. The example apps that import them get normal `dependencies` entries (`workspace:*` while in-repo, normal semver when consumed externally). This is the part that's missing today and that the link-global symlinks have been silently papering over.

**Prerequisite: expand the root `workspaces` glob.** Today the root [package.json](package.json) declares only `"workspaces": ["packages/*"]`, so `workspace:*` from `examples/cart` would fail to resolve — the cart isn't a workspace member. Step 1 of the migration adds `examples/*`:

```jsonc
{
  "workspaces": [
    "examples/*",
    "packages/*"
  ]
}
```

Not included: `apps/candor` and `apps/medlabs` are independent git repos that happen to be cloned into `apps/` for dev convenience — they have their own `.git`, manage their own `package.json`, and would be unsafe targets for the root `bun install`. They consume `@rip-lang/*` via link-global (the existing crutch) and stay outside this RFC's scope. `apps/websites/*` is static-asset-shaped (no `.rip` server, no Rip-package imports), so there's nothing to declare.

Every dir matched by the glob has to have a valid `package.json` (the `examples/*` ones already do). After this, `bun install` from the workspace root knows about every in-repo example app, and `workspace:*` means the same thing everywhere — a symlink back to the corresponding `packages/<name>/` dir.

Concretely, this means:

- `examples/cart/package.json` gains `@rip-lang/server` and (when the cart starts using it) `@rip-lang/http`.
- `examples/form/package.json`, `examples/results/package.json`, `examples/analytics/package.json`, and `packages/ui/browser/` (the widget gallery) all get the same audit.
- `bun install` from the workspace root resolves these through Bun's workspace protocol — the `node_modules/@rip-lang/server` symlink points back at `packages/server/`. No publish needed for in-repo development.

After this, `rip-loader.js`'s `import.meta.resolve` still works the same way, but it now resolves through the app's *own* `node_modules` (which actually has the package declared) instead of relying on the rescue path under `~/.bun/install/global/`. The link-global mechanism stays installed for now — it covers things outside this repo's purview — but in-repo apps no longer depend on it.

#### 3. Rip resolution flags undeclared imports

A new diagnostic class. Declaration is a Rip-wide invariant, not a type-system feature — every untyped app should get the same early warning a typed one does. So the check lives at the resolution layer, with two enforcement points:

- **`rip-loader.js` (server-side).** Before calling `import.meta.resolve` on a `@rip-lang/<pkg>` specifier, walk up to the nearest `package.json` and verify the package is in `dependencies` / `devDependencies` / `peerDependencies`. If not, throw with a clear message before resolution is even attempted. Cost: one walk + one object lookup per unique import per process — negligible.
- **`serve` middleware bundler (browser-side).** Same check, run once during the bundle build, against the app's `package.json`. Failure aborts the bundle with the same message text rather than producing a bundle that 404s in the browser.

The error message in both places:

> `` Import of '@rip-lang/<pkg>' is not declared in package.json. Run `bun add @rip-lang/<pkg>` (or use `workspace:*`). ``

**`rip check` surfaces the same error earlier.** When the project is typed (per [AGENTS.md](AGENTS.md), `strict: true` or any `::` usage), `rip check` walks every `.rip` file and runs the same declaration check during its import-resolution pass — catching the bug at check time, before the loader compiles or the bundler builds. Same diagnostic, same message; just an earlier surface.

The **bundler check is the forcing function** for browser-side bundling — it runs unconditionally on every build, typed or not, and it's the latest point at which the error can still fail loudly (the loader check covers server-side imports only, and `rip check` is opt-in via project config). With all three in place, the classic "works on my machine, breaks anywhere else" failure mode either errors at server start, errors at bundle time, or errors at `rip check` — never silently ships to production.

#### 4. Browser-side bundling of Rip packages

The browser-side bundling pipe is already in place. The verified-working manual config in the Problem section uses it end-to-end. What this section proposes is closing the two ergonomic gaps — bare-specifier rewrite and auto-discovery — without inventing new bundle namespaces or runtime fields.

**Discovery is automatic, gated by declaration.** The bundler walks every `.rip` file in `appDir` (recursively), parses the top-of-file imports, and pulls in any `@rip-lang/*` package referenced. Anything imported and declared in `package.json#dependencies` gets bundled; anything imported and *not* declared trips the §3 undeclared-import error at bundle time (and at `rip check` time when typing is on).

This matches what the bundler already does for the app itself — `appDir` is walked recursively today, with no per-file opt-in — and what `rip-loader.js` already does on the server side. An explicit `bundle.lib` list would add a second place to keep in sync with every `import` line, and the failure mode ("I forgot to list it") would be a runtime "module not found" in the browser instead of a build error. With automatic discovery, §3's declaration check is the single forcing function: the import line *is* the bundle list.

**Bundle layout: reuse the existing `_lib` mechanism.** External-dir bundling already produces `components/_lib/{bundle-name}/{path}` keys ([middleware.rip:797–805](packages/server/middleware.rip#L797-L805)) and the runtime resolver already serves them ([packages/app/index.rip:908–922](packages/app/index.rip#L908-L922)). Auto-discovery for a package `@rip-lang/http` whose `package.json#main` resolves to `http.rip` therefore lands at `components/_lib/http/http.rip` — exactly the shape the experiment used, just without the human writing the relative path.

For unscoped third-party packages (whenever those exist), the bundle name comes from the package directory name. For scoped names (`@rip-lang/http`), the bundle name is the trailing segment (`http`) — collisions with an app-local `_lib/http/...` directory are detected at bundle time and named in the error.

**Bare-specifier rewrite.** [`compileAndImport` in packages/app/index.rip:991](packages/app/index.rip#L991) currently rewrites only `\.rip['"]` import specifiers to blob URLs. It gains a second pass: for any specifier matching `^@rip-lang/<pkg>(/.*)?$`, look up the package's bundle entry in the `components` map (using the same name-to-bundle convention the bundler used) and rewrite to that path before the `.rip` rewrite runs. The server-side rewrite in `rip-loader.js` already does the equivalent transformation against the filesystem; the browser version does it against the bundle.

This keeps the runtime resolver, the bundle JSON shape, and the stash field names exactly as they are today. The only new code is: (a) the import-walker in the bundler, and (b) the bare-specifier branch in `compileAndImport`.

**Stash / bundle rename to `modules` is deferred to RFC 10.** The current `bundle.components` field name reads oddly once the contents include third-party packages, and RFC 10 proposes renaming it to `modules` (with a corresponding `_pkg/` prefix split). That cleanup is independent of solving the stated problem — bundling external packages already works under `_lib/`, just less prettily — and conflating it here risks the proposal being judged on the rename's churn rather than on the actual ergonomic deficiency. Punt.

#### 5. Package shape contract

For a `@rip-lang/*` package to be browser-bundleable under §4, it needs:

- A `.rip` entry file (declared via `package.json#main` or a new `package.json#rip.browser` field if the server entry is `.js`).
- No Node-only imports (`fs`, `path`, `child_process`, `node:*`) on the browser path. The bundler refuses to include any package whose entry transitively imports a node-builtin; the error names the offending file.
- No browser-incompatible runtime assumptions on the browser path. The current `@rip-lang/http` is the canonical example: its `buildUrl` calls `new URL(input)` without a base, which throws `TypeError: Invalid URL` in browsers when `input` is a relative path like `/api/products`. Fix on the package side (default `prefixUrl` to `location.origin` when running in a browser context, or accept the relative form directly). This RFC doesn't enumerate every such pitfall — it just notes that "passes Node" isn't the same as "passes browser," and Step 5 of the migration plan validates the cart end-to-end after the fix lands.
- Optional `_lib/` subtree of co-bundled components, mirroring the convention apps already use.

Server-only Rip packages (`@rip-lang/server`, `@rip-lang/db`) don't need any of this — they're never bundled for the browser. The bundler simply doesn't touch them, even if a component file accidentally `import`s them; it errors with "package `@rip-lang/server` is not browser-safe (declares no `rip.browser` entry)."

### Out of scope (deferred to follow-up RFCs or never)

- **Standalone-app *deployment* plumbing** (distinct from the protocol, which standalone apps do get). The rabbit hole here is npm version skew between a published `@rip-lang/server` and the served `rip.min.js`, the `rip.min.js` upward walk in middleware, the `bin/rip-server` ENOENT shim, `bin/rip` dispatch step 4 (cwd vs repoRoot), and removing `link-global` as a dev-machine crutch. Once a standalone app is on a release of `@rip-lang/server` whose middleware implements §4 and whose served runtime implements the bare-specifier rewrite, it consumes Rip packages the same way an in-repo app does — that part isn't deferred. What stays deferred is the cross-version pinning and dev-machine setup work that only matters for downstream maintainers, not for the protocol itself.
- **Stash / bundle field rename (`components` → `modules`, `_pkg/` namespace).** Cosmetically nicer once third-party packages live in the bundle alongside app components, but the existing `_lib/<bundle-name>/...` shape already works for both (verified). Folding it into RFC 9 risks the proposal being judged on rename churn rather than on the ergonomic deltas. Tracked as RFC 10.
- **Tree-shaking inside a Rip package.** Today every `.rip` file in a bundled package gets included. Per-export pruning is a real optimization but doesn't change the protocol — defer.

### Migration plan

0. **Expand the root `workspaces` glob.** Add `examples/*` to the `workspaces` array in the root [package.json](package.json). Run `bun install` once and confirm `node_modules/@rip-lang/*` symlinks resolve from each example app dir. (`apps/candor` and `apps/medlabs` are nested independent git repos and stay out of the workspace; `apps/websites/*` has no Rip-package imports.)
1. **Codify `package.json` as the only config file.** Remove `rip.json` reading from `src/typecheck.js` and the LSP file watchers. Convert and delete the existing `rip.json` files.
2. **Audit every in-repo app.** For every `examples/*/` and `packages/*/` that has its own `package.json` and imports `@rip-lang/*`, add the missing `dependencies` entries with `workspace:*`. One commit per area is fine.
3. **Land §3 (undeclared-import diagnostic).** Two enforcement points: the loader (`rip-loader.js`) and the bundler (`serve` middleware), plus the same check inside `rip check` for typed projects. Now that the audit is done, the new error fires on any regression and on any new app created without proper deps — typed or untyped.
4. **Land §4 + §5 (browser bundling).** Three pieces, all atop the existing `_lib/<bundle-name>/...` machinery: (a) the import-walker in the `serve` middleware that turns declared `@rip-lang/*` deps into auto-added bundle entries; (b) the bare-specifier rewrite branch in [`compileAndImport`](packages/app/index.rip#L991) that turns `'@rip-lang/http'` into the bundle-relative path; (c) the §5 package-shape validator (browser-safety check + `rip.browser` entry). No runtime stash changes, no resolver changes, no bundle JSON shape changes.
5. **Fix `@rip-lang/http`'s browser URL handling**, then migrate the cart to `import { http } from '@rip-lang/http'` with no relative-path workaround (the original ask that started this whole investigation, plus the `buildUrl` fix surfaced by the experiment that informed this RFC).
6. **Re-include `index.rip` and `api/**` in `rip check`** for `examples/cart` (and the other example apps with the same exclusion), now that the type-checker can resolve the server-side imports.

Step 0 unblocks everything else — without it `workspace:*` is a dead reference. Steps 1–3 are otherwise independent and can land in any order. Step 4 depends on 1–3. Step 5 depends on 4. Step 6 depends on 1 (config consolidation) and on RFCs 2 / 5 (so the server-side imports actually resolve to types, not just to packages).

### Relationship to other RFCs

- **Depends on nothing.** Steps 1–3 are pure plumbing — no type-system or component changes.
- **Complements RFC 2, doesn't block it.** RFC 2 ("Rip packages exposing types to typed Rip apps") is about how packages *emit* types from annotated `.rip` source — it can land independently for server packages, since `@rip-lang/server` already resolves via the loader rescue today. What RFC 9 adds is the matching consumer-side honesty: the app *declares* the dependency it's already using. Once both have landed, the cart's `index.rip` and `api/**` come back into `rip check` because (a) the imports resolve through declared deps and (b) the package ships types.
- **Cross-checks RFC 5.** RFC 5's `__RipRoutes` walker reads `routes` from `rip.json`; after this RFC, it reads from `package.json#rip.routes` instead. Trivial swap.
- **Independent of RFCs 1, 3, 4, 5, 6, 7, 8.**
- **Precedes RFC 10.** RFC 10 renames the bundle layout this RFC reuses; landing RFC 9 first means RFC 10 is a pure cosmetic/cleanup pass over a working system rather than a co-mingled change.

---

## RFC 10: Rename bundle `components` → `modules`, prefix every entry by origin

> **Status: Implemented.**

### Problem

After RFC 9 lands, the `serve` middleware bundle JSON has this shape:

```jsonc
{
  "components": {
    "components/_lib/http/http.rip": "...",        // a third-party Rip package (RFC 9 reuse)
    "components/_lib/widgets/spinner.rip": "...",  // an app-local extra dir (`bundle: ['./widgets']`)
    "components/_lib/button.rip": "...",            // an actual app component (auto-scanned from appDir)
    "components/cart.rip": "..."                    // a route file (only unprefixed branch today)
  },
  "data": { ... }
}
```

Three things read poorly once third-party packages live alongside app components:

1. **`components` is a misnomer.** The map now holds modules of all kinds — UI components, plain `.rip` libraries (`@rip-lang/http`), package entry files. Calling the whole thing `components` reads as "all of these are UI components," which is false. The field name is load-bearing in [packages/app/index.rip:908–922](packages/app/index.rip#L908-L922) (`resolveStorePath`) and in every `bundle.components[...]` reference downstream.
2. **`_lib/` is overloaded.** Today `_lib/<name>/...` means three different things: app components auto-scanned from `appDir` (no sub-prefix), app-author-declared extra dirs (`bundle: ['./widgets']` → `_lib/widgets/...`), and — after RFC 9 — third-party packages (`_lib/http/...`). They behave identically at runtime, but they have different *origins*. Conflating them makes bundle dumps harder to read and makes any future per-origin behavior (cache-busting on package version change, package-shape validation, etc.) awkward to add. The `_lib/` overload also means a literal collision: an app with a `widgets/http/...` extra dir would clash with a `@rip-lang/http` dependency.
3. **The namespacing is half-hearted.** Some entries get a `_lib/` prefix; routes sit bare at the root. Two categories self-describe, two don't. The asymmetry is the source of every collision question in this RFC: route-vs-appDir name clashes need a tiebreaker; appDir-vs-extra-dir clashes need another; package-vs-extra-dir is the third. All of them disappear if every entry is prefixed by its origin.

### Goal

Rename the field and put every entry under an origin prefix, with no behavior change other than the new layout being self-describing:

```jsonc
{
  "modules": {
    "_route/cart.rip":            "...",   // URL-addressable route
    "_app/button.rip":            "...",   // auto-scanned appDir file
    "_lib/widgets/spinner.rip":   "...",   // author-declared extra dir
    "_pkg/http/http.rip":         "..."    // auto-discovered package (RFC 9)
  },
  "data": { ... }
}
```

Four buckets, four prefixes. Each key declares where it came from; no two buckets can collide. The redundant `components/` path prefix that wrapped every old key is gone — once the field is `modules`, repeating the field name in each key is pure noise.

### Proposal

#### 1. Rename `bundle.components` → `bundle.modules`

One field rename. The serializer in [packages/server/middleware.rip](packages/server/middleware.rip) emits `modules:` instead of `components:`. The runtime resolver `resolveStorePath` in [packages/app/index.rip:908–922](packages/app/index.rip#L908-L922) reads `bundle.modules` instead of `bundle.components`. The stash-side mirror (whatever lands the bundle into the running app) follows.

No backwards-compatibility shim. The bundle JSON is regenerated on every `serve` start; no consumer reads it across versions.

#### 2. Four origin prefixes: `_route/`, `_app/`, `_lib/`, `_pkg/`

The bundler categorizes every entry by where it came from and prefixes accordingly:

| Prefix    | Origin                                                                  | Today's keying                             |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `_route/` | URL-addressable route files (the file-based router's input)             | `components/<path>` (bare)                 |
| `_app/`   | Auto-scanned `appDir` files (`bundle: { app: ['.'] }` — the `'.'` part) | `components/_lib/<path>` (overloaded)      |
| `_lib/`   | Author-declared extra dirs (`bundle: { app: ['./widgets'] }`)           | `components/_lib/<dir-name>/<path>`        |
| `_pkg/`   | RFC 9 auto-discovered packages                                          | (new — RFC 9 reused `_lib/<pkg-name>/...`) |

The runtime resolver `resolveStorePath` ([packages/app/index.rip:908–922](packages/app/index.rip#L908-L922)) currently tries `components/_lib/{clean}` then `components/{clean}` — a two-step walk with `_lib/` deterministically winning ties. After this RFC the resolver does a single lookup against the `modules` map per category branch: try `_pkg/{clean}`, then `_lib/{clean}`, then `_app/{clean}`, then `_route/{clean}`. The `_pkg/` branch's exact resolution semantics — entry-file lookup, sub-path imports — are TBD and tracked with the package-shape work in [RFC 9 §5](#5-package-shape-contract); this RFC just reserves the prefix.

Collisions become impossible at the categorical level: `_lib/widgets/...` and `_pkg/widgets/...` coexist (different namespaces); a route and an appDir file with the same basename coexist (`_route/cart.rip` and `_app/cart.rip` are distinct keys). The bundler still rejects duplicate keys *within* a single bucket — two route files at the same path is a build error, as today — but cross-bucket clashes go away entirely.

One behavior change worth flagging: today, an `appDir` file and a route file with the same component name resolve deterministically to the appDir file (because `_lib/` is tried before bare `components/`). Under this RFC, both keys exist and the resolver picks based on the prefix order above (`_app/` before `_route/`), so the same call site keeps resolving to the same file — no functional change for the single existing case, but the ambiguity is now visible in the bundle dump.

#### 3. Drop the redundant `components/` path prefix

Every key under the old `components` field was literally prefixed with `components/` — `components/_lib/foo.rip`, `components/cart.rip`. Once the field is `modules`, the prefix is pure noise. Strip it. Keys become `_pkg/http/http.rip`, `_lib/widgets/foo.rip`, `_app/cart.rip`, `_route/checkout.rip`.

The bare-specifier rewrite from [RFC 9 §4](#4-browser-side-bundling-of-rip-packages) targets `_pkg/<name>/<entry>` directly; the `.rip` extension blob-URL rewrite is unaffected.

### Out of scope

- **Renaming on-disk source dirs.** Apps already separate `routes/` and `components/` on the filesystem (verified across `examples/cart`, `examples/form`, `examples/results`, `examples/analytics`, `apps/candor` — all use `routes/` + `components/`, not a single conflated dir). The bundle's misnomer comes from the bundler flattening these into one `components` map, not from the source-tree convention. This RFC fixes the bundle layout; the source tree needs no changes.
- **Per-package versioning in the bundle.** `_pkg/<name>/...` does not encode a version; one bundle = one version of each package. Multi-version coexistence stays out of scope (also noted in RFC 9).

### Migration plan

1. **Rename in the bundler and resolver in one commit.** Touch the bundle serializer ([packages/server/middleware.rip](packages/server/middleware.rip)), the runtime resolver ([packages/app/index.rip](packages/app/index.rip#L908-L922)), and the bare-specifier rewrite ([packages/app/index.rip](packages/app/index.rip#L991)). Strip the `components/` prefix in the same commit.
2. **Re-key every entry by origin** in the bundler — routes to `_route/`, auto-scanned appDir files to `_app/`, author-declared extra dirs to `_lib/<dir-name>/`, RFC 9's auto-discovered packages to `_pkg/<pkg-name>/`. Update `resolveStorePath` to walk the four branches in `_pkg/` → `_lib/` → `_app/` → `_route/` order.
3. **Update tests and any docs that reference the old layout.** Search for `bundle.components`, `components/_lib/`, and the literal field name across the repo. In particular, delete the "Router note — `routes/` vs. `components/`" paragraph in [packages/app/AGENTS.md](packages/app/AGENTS.md#L27-L31) — that note exists only to warn agents about the bundler re-keying `routes/*.rip` under the `components/` prefix, and after this RFC the bundle key (`_route/`) matches the on-disk dir (`routes/`), making the warning obsolete.
4. **Smoke-test the cart end-to-end.** RFC 9's verified cart config is the regression target; if the cart still renders products and completes checkout after this RFC lands, the rename is non-breaking.

### Relationship to other RFCs

- **Depends on RFC 9.** RFC 9 establishes the bundling pipe and the `_lib/<bundle-name>/...` reuse this RFC then renames. Landing RFC 10 first would mean inventing a `_pkg/` branch with no consumer.
- **Independent of all other RFCs.** Pure cleanup; no type-system, component-system, or schema interaction.

---

## RFC 11: render-ready state

> **Status: Implemented.**

**Problem:** rip makes state reactive — `:=` (state), `~=` (computed), `~>` (effect) — but has no reactive form for **server data that's guaranteed present before its screen renders**. Every fetched value is typed `T | null`, and that null radiates to every consumer. The cart example pays for it on every screen:

- `_layout.rip` renders the nav from `userName ~= if user then "…" else ''` — the empty-string fallback silently merges *not loaded yet* with *real user, no name*, and the dropdown pops in when the fetch resolves.
- `profile.rip` carries a `hydrated := false` flag plus a `~>` effect just to copy `user` into `form` once it materializes.
- `index.rip` and the orders screens (`orders/index.rip`, `orders/[id].rip`) each hand-roll the same `loaded` / `error` / `try`-`catch` bookkeeping — the detail page re-fetching its order by id on every visit.
- Everything refetches on every visit, and sharing a fetched value across components means hand-parking it in `@app.data`.

And the null radiates at scale: the authed user is read by nav, profile, settings, checkout, permission checks — each gating with `if user` or threading `?.x ?? ''`, and `if user?.role is 'admin'` collapsing *exists* and *admin* into one test. The gap is one missing cell in the reactivity grid:

| Form        | Meaning                         |
| ----------- | ------------------------------- |
| `x := v`    | reactive **state**              |
| `x ~= expr` | reactive **computed**           |
| `f = ~> …`  | reactive **effect**             |
| `x <~ src`  | **render-ready** reactive state |

This isn't a routing subsystem or a cache — it's the async member of a family rip already has. Fill that cell and the costs above disappear.

**Proposal: server data lives in the stash — the same reactive store as all other app state — as `source` keys that know how to load themselves. The one new read-site primitive is a component declaring that a key must be loaded before the component renders (the `<~` binding).** That declaration does two jobs: it makes the renderer load the value before constructing the component, and the value it binds is typed non-null.

```coffee
# app/stash.rip — one store; server keys know how to load
import { source } from '@rip-lang/app'
import { api } from './api-client.rip'
import { User, Product, Order } from './types.rip'

export stash =
  cart: { items: [], total: 0 }                                       # plain client state
  user: source { fetch: -> User.parse(api.get!('user').json!()) }     # server-backed
  products: source                                                    # catalog: five minutes of freshness is plenty
    fetch: -> api.get!('products').json!().map((p) -> Product.parse(p))
    staleTime: '5 min'
  orders: source { fetch: -> api.get!('orders').json!().map((o) -> Order.parse(o)) }   # the list…
  order: source { fetch: (id) -> Order.parse(api.get!("orders/#{id}").json!()) }       # …and a keyed family: fetch takes a key → one cell per id
```

A `source` is an async reactive holder — a stash key that knows how to (re)load itself, **not a promise**: it owns the in-flight load internally, but its value is part of the stash's reactive fabric like any other key. It's lazy by default: it loads on first touch — a gated binding or a plain read — not at startup. (It's a redesign of rip's existing-but-unused `createResource`, embedded as a stash key — see *Why it's cheap to build*.)

`fetch` is deliberately the only *action* a `source` declares. The tempting addition is its mirror — a `push:` for write-back — and it's excluded for a structural reason, not just because auto-push is deferred: **reads are per-key, writes are per-action.** A key has exactly one canonical way to load (`orders` comes from `GET /orders`), but the writes that change it aren't edits of the key: placing an order is a POST that appends to `orders` *and* empties `cart` — one action, two keys, neither of them "pushed." (The seeming counter-example — `user`, with a single `PATCH /user` that could pass as a push key — is the special case where action and key happen to align one-to-one, and even it wants mutation semantics: a draft, validation errors, a pending flag. Tie the push to the key and the next requirement — say, change-email-with-confirmation — breaks the alignment.) So loading is declared on the *key* (`source`) and writing on the *action* (`createMutation` — see *The write side*), and they meet at exactly one point: a successful mutation assigns the key(s) it affects. The declaration also carries per-key read-side **policy** — `staleTime` ships in v1 (see *Freshness*), and each deferred feature lands as another option, not new architecture (the list is in *Deferred*) — so `app/stash.rip` becomes the app's data manifest: one file declaring what loads, how fresh it must be, what persists, and what gates.

```coffee
# app/routes/_layout.rip
export Layout = component
  user <~ @app.data.user               # load before render → `user` is non-null
  cart ~= @app.data.cart               # plain client state — always present, never gates
  userName ~= "#{user.firstName} #{user.lastName}"   # no `if user`, no pop-in
```

```coffee
# app/routes/profile.rip
export Profile = component
  user <~ @app.data.user               # already loaded by the layout → instant; still non-null
  form := { ...user }                  # synchronous: the hydrated flag and ~> effect are gone
  # the submit (a write) is handled with the mutation primitive — see "The write side"
```

What this means in practice:

- **One store.** Client and server state live in the same stash — no second world of module-level holders to gather from. Sharing needs no imports at all: the key is the handle, and `@app.data` is already threaded (and typed) into every component.
- **Reading is reading.** A gated binding (`user <~ @app.data.user`) is loaded and non-null. An ungated read (`@app.data.user`) is honest — `User | null` — and still kicks off the source's load without blocking render: the null branch is the skeleton branch (see *Why an explicit gate?*).
- **Writing is assigning.** `@app.data.user = u` writes through to the source's value; every consumer re-renders. This is exactly what the cart does today, on a value that's also gated. A write also bumps the cell's generation and aborts any in-flight load — an older fetch resolving late can never clobber a newer write (the mutation write-back depends on this; see *The live-binding invariant*).
- **Refetching is re-running the key** — it writes the same reactive value, so consumers update in place, no remount.
- **Signing out is one reset, not N writes.** `@app.data.reset()` — a reserved stash method — restores plain keys to their declared defaults (the stash literal *is* the default-state declaration), unloads every source (aborting in-flight loads, clearing keyed caches), and purges persisted snapshots — the next gates refetch as the new principal. Assignment can't do this job: `@app.data.user = null` invalidates one cell (see *The live-binding invariant*) but leaves in-flight fetches, persisted copies, and every other key untouched. One call is possible only because all state lives in one store; *when* to call it is the app's signout flow — auth stays app-level. Screens still mounted when reset runs keep their last-good gated values until they unmount (the invariant again) — signout navigates, and nothing flashes on the way out.
- **Sources stay fresh by default.** A loaded cell serves every later gate instantly — and revalidates in the background when it's past its `staleTime`, which defaults to `0`: every navigation onto a gated key serves the cached value and refetches, updating in place. Session-stable keys opt out per declaration (`staleTime: '5 min'`, or `'forever'` for load-once) — see *Freshness*.
- **Serialization is one projection over one store** — fully or partially, the app's call (its own section below).

### Why an explicit gate?

The natural first objection: the stash already knows `user` is a `source` — why must the author mark the gate at all? Why not infer it from the read (`user ~= @app.data.user`) and have no operator?

**Gating is a per-component decision, not a property of the data.** Whether to block render on a key isn't knowable from the key — the same key legitimately gates in one component and not in another. A dashboard makes it concrete:

```coffee
export Dashboard = component
  user   <~ @app.data.user           # identity — gated: the page is wrong without it
  orders ~= @app.data.orders         # ungated: render now, fill in when loaded
  stats  ~= @app.data.stats          # ungated: same — three loads, none blocking another

  render
    h1 "Welcome back, #{user.firstName}"
    if orders then OrderList orders else OrderSkeleton
    if stats  then StatsPanel stats  else StatsSkeleton
```

Ungated reads are a *feature*, not a failure mode: an ungated read of a `source` kicks off its load without blocking anything, types as `T | null`, and the null branch *is* the skeleton branch — progressive rendering with no extra machinery. (And it typechecks as written: render conditionals are real guards in the shadow TS, so `if orders` narrows `orders` to non-null in the branch — no `?.` laundering.) The gated binding then marks exactly the subset of reads the author declares render-critical: *this screen is wrong without it*. Automatic gating cannot express this page — any read of a source key would gate, so the whole route waits on stats nobody has scrolled to.

To be honest about the distribution: most screens gate everything — a profile, a settings page, a simple list — and that's the right default posture. The mixed case matters because of **latency skew**: the gate is a *union*, so the slowest source sets time-to-first-paint for the entire screen. Identity and config endpoints are fast; aggregation endpoints (stats, recommendations, analytics) are routinely 10–100× slower. Every app eventually ships a slow endpoint, and that's the day its authors reach for "render now, fill in later" — on exactly the large, high-traffic screens (dashboards, detail pages) where blocking hurts most. A primitive that can't express the distinction forces the worst outcome precisely where the stakes are highest.

In short: *which keys are server-backed* is a fact the framework knows; *which reads should block render* is a decision only the author can make. The gate mark is the one token that carries it.

**Inference doesn't remove the marker — it flips its default.** To be clear: inferring the gate is buildable. `app/stash.rip` is a fixed convention (`launch()` auto-loads it in every app, typed or untyped; the checker already builds `__RipStash` from it), extracting the source-key set is a small build step, and the idiomatic read is a top-of-body `user ~= @app.data.user` — as statically visible as any binding. The argument against inference isn't mechanical. It's that the dashboard above forces *every* design to have a read-site marker: under inference, progressive rendering needs an inverted one ("read without gating"). So the two designs differ only in **which side is unmarked** — and unmarked code should do the harmless thing. With the explicit gate, an unmarked read fails soft: the screen renders, the value is `T | null`, and treating it as loaded is a compile error. Under inference, an unmarked read silently joins the route's **gate union** — and since the slowest source sets time-to-first-paint, every new source read anywhere in the chain adds latency to the whole screen without anyone having decided that. Render-blocking is the global, consequential behavior; it should be the opt-in, visible, greppable one. `<~` makes a component's gate budget readable off the page, and one binding per render-critical key is the whole price.

### The mechanics

The non-obvious parts: making `user` present *synchronously* at init (so `form := { ...user }` works), making the gate knowable before construction, and making the types true. Tracing each:

**The chicken-and-egg.** The renderer constructs a component by running its body. So it *cannot* learn what a component needs by running the body — the body already consumes the value (`form := { ...user }` would read a not-yet-loaded value). The thing to load has to be known *before* construction.

**The resolution: compile-time hoisting of the path.** rip is compiled, and the `component` macro already statically analyzes each body (it extracts state, computed, and `offer`/`accept` vars). So `user <~ @app.data.user` is hoisted at compile time into a static gate-set on the component — the hoisted thing is the **path string** (`'user'`), not a module identifier. Then at runtime:

1. The compiler emits e.g. `Profile.__gates = ['user']` (static, readable without constructing).
2. Before constructing the matched route + layout chain, the renderer takes the **union** of their gate-sets and resolves each path against the stash: a `source` cell gets awaited via **`ensure`** (serve if loaded — revalidating in the background when past its `staleTime` — await if in-flight, else fetch); a path that doesn't resolve to a `source` is a dev-time error (see *`<~` requires a source*, below). Overlapping gates dedupe — one in-flight load per source.
3. *Then* it constructs top-down. By init time every needed key is present, so the `<~` binding resolves synchronously and non-null, and `form := { ...user }` is valid.

Because the gate-set is **path strings resolved at runtime**, the `component` macro needs no cross-module knowledge — it never has to know whether `user` is a `source` or a plain key. It's local, single-file analysis, the same kind of pass the macro already does. (This is the detail that lets one store and a cheap gate coexist; the alternatives below each lose one or the other.)

Three properties fall out of this:

- **No ancestry coupling.** Each component self-declares (via its own `<~` bindings) what it requires, so a key is loaded before that component whether you land on it directly or arrive through a parent. A key needed by both layout and page is simply loaded once.
- **Gates live in routes and layouts.** Not a mechanical limit — child gate-sets are static too, and a transitive union over statically-referenced children is buildable. It's an ownership rule: gating is a *screen-level* latency decision, and a reusable child that declared its own gate would impose render-blocking on every screen that renders it, invisibly from the route — the same silently-growing gate union that rules out inferred gating above. Routes and layouts own the first-paint budget; children take gated values as props (the dashboard above hands `orders` to `OrderList`) or read ungated with skeletons. A child declaring `<~` is a dev-time error at construction — and that rule is permanent, not provisional: a gate is always liftable to the screen, so child-blocking adds no capability, only hides the cost. The same rule pins the dual-role case: a file under `routes/` can also be imported and embedded as a child of another route, and its gates are honored **only via route matching** — embedded, it hits the same dev-time error (deterministic per use-site: every embed hits it in development). Silently ignoring an embedded gate would hand the component a `T`-typed binding nobody loaded — the exact silent null this design exists to eliminate.
- **The one constraint:** the binding's right-hand side must be a statically-known path (a literal `@app.data.…` access) for the compiler to hoist it — and the binding form enforces this by grammar: a top-of-body declaration can't be conditional or embedded in an expression. Two extensions stay within the rule. *Keyed gates*: `order <~ @app.data.order(params.id)` hoists as the pair (path, key expression), where the key expression is restricted to `params`/`query` — values the renderer already has before construction (see *Keyed sources*). *Subpaths*: a path that lands under a source (`theme <~ @app.data.settings.theme` where `settings` is the source) resolves to the **nearest source ancestor** on the path — the gate loads `settings`, the binding binds the subpath.

And reactivity: `user <~ @app.data.user` binds `user` as a reactive read of the key, so a later write (`@app.data.user = u`, or a refetch) flows to every consumer in place — no remount.

### Keyed sources

A `source` whose `fetch` takes a parameter is a **keyed family of cells** — `order: source { fetch: (id) -> … }` is one declaration, one cell per id, each with the full cell machinery (in-flight load, abort/generation, freshness). This isn't an add-on to the design; it's the same primitive under a memoized factory, and it has to exist for the gate to be useful at all on the most common screen shape there is: list → detail. `order <~ @app.data.order(params.id)` gates the detail route on exactly its order; the cart's `/orders/:id` page — today a hand-rolled fetch + `loadError` ladder — collapses the same way the singleton screens do.

The keyed cell, not the route, is the primitive — which matters because by-id data shows up *without* parameterized routes too: medlabs today has zero `/:id` routes, but its orders screen opens a **modal** that fetches by id on click. That's an ungated keyed read (`@app.data.order(id)` — `T | null`, kicks the load, skeleton until present), the same cell a future `/orders/:id` route would gate on. Reads, writes, refetches, and the handle all address keyed cells the same way they address singletons.

One deliberate non-feature: a keyed cell and a list key that happens to contain the same entity (`order(42)` and `orders`) are **independent caches — there is no normalization layer**. Consistency comes from the same two mechanisms as everywhere else: `staleTime` revalidation keeps each key honest on its own schedule, and writes are per-action — a mutation that changes an order assigns *both* keys it affects, exactly as place-order already assigns `orders` and `cart`. Entity normalization (one canonical row, every view derived) is real machinery with real costs, and it's the kind of thing the local-first decision (below) would bring wholesale — not something to half-build here.

The cache is the cell map, and v1 fixes its policy rather than exposing it: entries are kept (a fetch-per-navigation variant would build the same map to own the in-flight load and receive preloads, then throw it away), bounded by a simple LRU cap, revalidated under the same `staleTime` rule as singletons, and cleared by `reset()`. The knobs (`maxEntries:`, per-entry overrides) are deferred. What keyed sources are *not* for is per-instance derived async — a search box's results keyed by keystrokes are component state, not app data; that's standalone `createResource` finished to Solid parity (a reactive source argument driving refetch), and it stays deferred.

### Freshness

A cell that loads once and serves a whole session will eventually serve something false. Today's hand-rolled screens never face this: they refetch on every mount — the very waste the problem statement complains about doubles as an accidental freshness guarantee. The gate removes the refetch *and* every cue that data was ever fetched (no loading state, no fetch in the body, no null branch — that's the point), so under load-once caching, converting a screen to a source would silently trade the status quo's visible failure (flicker) for an invisible one it newly introduced (staleness). The design must not regress freshness relative to the pattern it replaces — so freshness is part of v1, and it's one option, not an enum of behaviors: **`staleTime`** — how long a loaded value is trustworthy.

- **Default `0`**: the value is stale the moment it lands, so every gate revalidates — serve the cached value instantly, refetch in the background, update in place (stale-while-revalidate). This is the domain's bias, *fresh or visibly loading*, with one amendment: a screen with a cached value is never blocked by staleness, only refreshed through it.
- **A duration** (`staleTime: '5 min'` — duration strings per the server `cache()` helper's vocabulary, or ms): gates within the window serve without refetching. For catalogs, config, anything where seconds of staleness are fine and re-fetching per navigation is pure waste.
- **`'forever'`**: load once per session — the old default, now the opt-in. Still refreshable explicitly via the handle's `refetch()`. (Originally specified as the `:forever` symbol; implementation settled on the string — it's exactly typed as a literal, where `symbol` admits every symbol, and its type errors read cleanly.)

The axis composes with *triggers* rather than encoding them: a trigger is an event that consults the window (v1's only trigger is the gate itself — being navigated onto), and later triggers — revalidate-on-focus, `subscribe:` for genuinely-live keys — land orthogonally in *Deferred* without touching `staleTime`. Gate semantics stated precisely: **a gate blocks only on unloaded cells**; loaded-but-stale serves instantly and revalidates behind the screen.

### The live-binding invariant

The soundness sections below lean on one runtime rule, stated here once. Three things can change a cell under a live screen — a failed refetch, a write (including `= null`), and `reset()` — and none of them may yank a mounted gate:

1. **A gate only ever serves a non-null value.** Pre-construction, `ensure` treats a null-valued cell — never loaded *or* explicitly assigned null — as unloaded and fetches. So `@app.data.user = null` means *invalidate*: ungated readers see the null immediately (their honest `T | null` branch), and the next gate refetches rather than serving it.
2. **A mounted `<~` binding holds its last-good value until unmount.** A failed refetch keeps last-good (and records the error on the handle); a null write or `reset()` invalidates the *cell* without yanking live bindings. Signout is reset-then-navigate, and this rule is why the order of those two doesn't matter on screen.
3. **A write wins over an in-flight load.** Write-through assignment bumps the cell's generation and aborts any in-flight fetch, so an older load resolving late can never clobber a newer write — the mutation write-back (`onSuccess` assigning the key) is only sound because of this.

### The types are honest — and already plumbed

Two existing pieces carry the whole story:

*The stash is already statically typed.* The project's `app/stash.rip` declares (or infers) its shape, and the type checker threads it everywhere with no ceremony: it appends `export type __RipStash = typeof stash` to the stash module, then rewrites each component's `app` stub to `declare app: { data: __RipStash; … }`. `@app.data.user` resolves to its declared type in every component — today, no new plumbing.

*`source` rides that pipeline.* Declare `source<T>(opts:: { fetch: () => Promise<T> }):: T | null` — the runtime returns a tagged cell (the stash proxy unwraps reads to its current value; writes route into it), but the type says `T | null`. Then `typeof stash` infers `{ cart: …, user: User | null }` with **no annotation at all**, and the pipeline carries it to every read site. A keyed source rides the same inference one arrow deeper: `fetch: (id) -> Order` types its key as `(id) => Order | null`, so `@app.data.order(42)` is an honest nullable read and `order <~ @app.data.order(params.id)` narrows it. The `<~` binding is the generic narrow — `(value:: T | null) => T` at the bind site — with soundness supplied by the runtime gate rather than by the type system proving the load ran.

```typescript
// user: source { fetch: -> User.parse(…) }
user: User | null            // ungated read — forces the null/skeleton branch
// user <~ @app.data.user
user: User                   // gated binding — non-null, soundness from the gate
```

*And none of it requires a typed project.* `launch()` auto-loads `app/stash.rip` in every app (untyped ones can even skip the file and seed via `data-state`), and the gate, hoist, source loading, and mount-time source check are all runtime mechanisms that never consult the checker. An untyped app gives up only the diagnostics tier — a forgotten gate is a runtime null instead of a `T | null` compile error, the same tradeoff untyped code makes everywhere else: *still correct, less guarded*, not broken.

*Method typing.* The new stash methods (`reset`, `source`) land typed: the `declare app` rewrite intersects the data shape — `data: __RipStash & StashMethods` — so they carry signatures and completion in typed projects from day one.

### Forgetting the gate can't cause a silent null

Omitting the gate isn't a runtime surprise. An ungated read is `User | null`, which the checker forces you to handle — exactly today's situation, no worse, and the handling is ordinary branching: render conditionals are real guards in the shadow, so `if user` narrows. The gated binding is the only thing typed `T`, and it's precisely the read the gate guarantees. And rip has **no non-null assertion** — `x!` is call syntax — so typed code can't even assert the null away: the only paths to reading a `T` are a gate or an honest null branch, which is a stronger guarantee than TypeScript itself makes. Because each component hoists its *own* gates, "loaded" and "read as loaded" can't drift apart — and *The live-binding invariant* (above) keeps "loaded" true for as long as the screen is up.

### `<~` requires a source — binding a plain key is an error

The mirror question: what if a component writes `cart <~ @app.data.cart` on a plain client key? Two cases, and the second decides the rule. On a non-nullable key (`cart: Cart`) the gate would be a harmless no-op — but it dilutes the mark: every `<~` should mean "this render waits on a load," or the dashboard stops being readable as a time-to-first-paint budget. On a *nullable* plain key (`selectedItem: Item | null`) it would be unsound: the narrow claims `Item`, but there is no load for the gate to await — nothing ever makes the key non-null — so the binding would manufacture exactly the silent null this design exists to eliminate. So the binding requires a `source`: the renderer rejects a non-source path at mount with a dev-time error (deterministic — every mount of that component hits it, so it can't slip past development), and the type layer can front-run the diagnostic by branding `source`'s return type so `<~` only accepts source-typed keys (best-effort: nothing load-bearing depends on it; the brand must be an *optional unique-symbol* property so it never leaks into ungated read types — `User | null`, not `User & __Brand | null` — and never breaks assigning a plain `User` into the key).

The rule also makes key migrations self-guiding: plain → `source` flips every ungated reader to a `T | null` type error (each component then chooses gate or skeleton); `source` → plain surfaces every stale `<~` as the mount error. Neither direction can silently change behavior.

*Implementation note:* the compile-time diagnostic shipped as static analysis rather than the brand — `rip check` and the LSP validate each hoisted gate path against the stash literal's source keys (chasing module-level bindings, walking subpaths), so gating a plain, nullable, or missing key errors at the call site. The analysis is deliberately conservative: values whose source-ness isn't statically visible (imported cells, factory calls, spreads) stay silent and fall back to the mount check.

### Loading and error states, scenario by scenario

The gate splits loading/error handling into two regimes *by construction*: a gated component never renders a loading or error state for its own gates — if the value isn't there, the component doesn't exist yet. That leaves a small, complete matrix:

| Scenario                           | Loading UI                                        | Error UI                                           |
| ---------------------------------- | ------------------------------------------------- | -------------------------------------------------- |
| **Gated key** (layout or route)    | none — previous screen stays; `router.navigating` | navigation error → nearest constructible `onError` |
| **Ungated, value-only**            | skeleton (the null branch)                        | none — stays on skeleton                           |
| **Ungated, full handling**         | skeleton (`source(…).loading`)                    | in place: `source(…).error` + `refetch()`          |
| **Failed refetch of a loaded key** | none — last-good value stays                      | on the handle; surfacing is the screen's choice    |

For the common case — a screen that gates all its data, which is most screens — the matrix collapses to its first row: zero per-component state code, no skeletons, no handle; loading is the router's navigating indicator and failure lands at the `onError` boundary. The handle serves the mixed-mode minority that chooses to render *through* loading and error.

What gated loading *looks* like is app policy; the good defaults, per case:

- **Navigating** — keep the previous screen (the design already does) and indicate only when the gate is slow: a flashed spinner is more jarring than a fast cut, so the indicator wants a delay threshold. rip ships that: `router.navigating` is a `delay 100`-wrapped signal (truthy waits 100 ms, falsy immediate), so fast gates never flip it. A minimum display time once shown is app polish; preloading (below) often resolves gates before the threshold is ever crossed.
- **First load** — no previous screen: the served document shell (`index.html`) covers bundle + first gate, and it should *indicate*, not just brand. A CSS-animated spinner is the default (static HTML animates fine); a shell skeleton is the upgrade — the chrome's data-free silhouette (a gray circle where the avatar will be), swapped for fully-hydrated chrome in one step when the gate resolves. No threshold here: first load is never that fast.

The handle rows use `@app.data.source(path)` — a reserved stash method returning `{ value, loading, error, refetch(), reset() }`, all reactive, with a dev-time error on non-source paths (keyed cells take the key as a second argument: `source('order', id)`). The path is typed `keyof __RipStash` constrained to source keys, so the handle's `value` carries the key's own type — `source('stats')` is a typo-checked, `Stats | null`-valued handle, not a stringly-typed escape. `value` is the same reactive read as the plain key (kicks the lazy load on first touch), so a full-handling component binds the handle once instead of binding the key and the handle separately. One reserved name keeps the flags on the handle (rather than reserving collision-prone names like `loading`) and gives per-key `refetch`/`reset` an addressable home.

Gate failures route like throwing renders already do — the renderer walks the layout chain to the nearest `onError` definer — applied pre-construction. The union **settles rather than failing fast**: one rejection doesn't abort its siblings' loads (their cells finish and cache normally — they're not wasted on the retry). Then the chain constructs top-down as far as its gates succeeded, and the error (`{ status, message, error, path }`, status from the fetch error when present) renders at the boundary. A layout whose own gate failed reaches the app-level `onError`; a route gate failing under a healthy layout constructs the layout, whose `onError` renders in place of the route. Global-state failure is an app-level event; screen-state failure is a layout-level event.

```coffee
# app/routes/_layout.rip — gated GLOBAL state
export Layout = component
  user <~ @app.data.user        # this gate failing → Layout never constructs; app-level onError handles it
  onError: (err) ->             # catches DESCENDANT gate failures (e.g. a route's orders)
    # render an error shell in place of the route — err.status / err.message from the failed fetch

# app/routes/dashboard.rip — every state on one screen
export Dashboard = component
  user   <~ @app.data.user                 # gated: no loading/error UI — present, or this never renders
  orders ~= @app.data.orders               # ungated, value-only: skeleton until value, no error UI
  stats  = @app.data.source('stats')       # ungated, full handling — { value, loading, error, refetch() }

  render
    h1 "Welcome back, #{user.firstName}"
    if orders then OrderList orders else OrderSkeleton
    if stats.error
      ErrorPanel message: "Couldn't load stats", retry: stats.refetch
    else if stats.value
      StatsPanel stats.value
    else
      StatsSkeleton                        # stats.loading is true here
```

### Why a gate, not pausing mid-render

rip can't pause a render partway through and resume it. But it *can* finish loading before a screen is constructed — `mountRoute` is already async (it awaits compile + import before constructing a component). The gate rides that existing seam: read the static gate-set, await it, then construct. So rip reaches "non-null at first render" through a mechanism it already has, rather than a render-pausing one it doesn't.

### Why it's cheap to build

| Need                                               | Already in rip                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A pre-mount async seam to run the gate in          | `mountRoute` already awaits `compileAndImport!` before `new Component`, with `gen`/`generation` stale-mount guards                              |
| Static analysis of component bodies                | the `component` macro already extracts state / computed / `offer` / `accept` — hoisting `<~` paths is the same kind of pass                     |
| One shared reactive store                          | the stash already is this — fine-grained per-key signals on a deep proxy, write-through assignment                                              |
| Typed reads in every component                     | the `__RipStash` pipeline already threads `typeof stash` into `@app.data`                                                                       |
| The source cell's core (value + race/abort + lazy) | reuse `createResource`'s reactive `data` / `loading` / `error`, its `generation` counter + `AbortController` race handling, and its `lazy` mode |

The runtime is mostly assembly. The one piece of genuinely new (but modest, and precedented) compiler work is the **hoisting pass** — statically lifting each `<~` path into the component's gate-set, the same kind of body analysis the `component` macro already does.

On the runtime side, `source` is a **redesign** of the existing-but-unused `createResource`, embedded as a stash key: keep its proven race/abort core; shape the surface the gate wants — **`ensure`** (serve if loaded and fresh, revalidate in the background if past `staleTime`, await if in-flight, else fetch; today's `refetch` always aborts and restarts), write-through assignment (a mutation result updates the value with no refetch, bumping the generation and aborting any in-flight load per *The live-binding invariant*), **`reset`** (back to *unloaded*: clear the value, abort any in-flight fetch, purge the persisted snapshot — distinct from assigning null, which invalidates for gates but serves ungated readers immediately), and lazy-by-default. Errors are never cached: a failed *initial* load records the error on the cell and returns it to *unloaded*, so the next gate retries; a failed *refetch* of an already-loaded cell keeps the last-good value — the invariant's mounted-gate rule — and records the error on the handle. A gated load that rejects aborts the navigation into the router's existing error path (see *Loading and error states*), while a preload failure doesn't surface (the cell records it; the navigation's own gate retries). The stash proxy learns one trick: a read of a source cell unwraps to its current value, a write routes into it. The same cell also ships standalone as `createResource`, for *instance-local* async (a search box's results are component state, not app data — see *Breaking change impact*). Nothing depends on the old export, so the redesign is free and there's no migration.

Preloading falls out for free, too: gate-sets are static and route matching is pure, so on link intent (hover / focus / viewport) the router can match the target URL, union its chain's gate-sets, and trigger those loads — navigation then awaits cells already loaded or in-flight (one in-flight load per source, no double fetch). The only new surface is the intent trigger on anchors the router already enumerates. The same static-ness covers the one load intent preloading can't touch — the cold first load, which is otherwise strictly serial (shell → bundle → compile → import → gate fetch → render): the bundler can emit a route→gate-set manifest so the entry route's gate union fires in parallel with module evaluation, and the served shell can carry prefetch hints that start those fetches before the bundle even evaluates. Together they make `eager:` mostly unnecessary.

### The write side: a mutation primitive

The gate handles reads; writes have the mirror problem. The cart's profile submit and place-order hand-roll a `status` flag + `try`/`catch` + manual application of the result — the write-side twin of the `loaded`/error bookkeeping reads suffer. A small **mutation** primitive (`createMutation`) removes it:

```coffee
# app/routes/profile.rip
export Profile = component
  user <~ @app.data.user                 # non-null, loaded before render
  form := { ...user }                    # editable draft — no hydrated flag, no effect
  errors:: ApiErrors := {}

  updateUser = createMutation (data) -> User.parse(api.patch!('user', { json: data }).json!())
    onSuccess: (u) => @app.data.user = u         # write-back into the stash key — nav updates, no refetch
    onError:   (e) => errors = parseApiError(e)  # => — callbacks are plain options on a runtime call; nothing binds their `this`

  submit: (e) -> e.preventDefault(); errors = {}; updateUser(form)   # invoke directly — pending/succeeded/error are reactive
  # render: inputs bind to `form`; the submit Button reads updateUser.pending; banners read succeeded/errors
```

You invoke it directly with the payload — it *is* the action, so there's no `.mutate` method to call on it — and it exposes `pending` / `succeeded` / `error` reactively while running `onSuccess` / `onError`. (Note the `=>` on the callbacks: `createMutation` is a plain runtime function receiving an options object, so it makes no promise about `this` — capture the component lexically. The same applies to any `@`-using code in a source's `fetch:`.) Those are bare flags, matching the source's `loading` / `error` rather than `is`-prefixing them — and a write is `pending`, not `loading` (the read/write distinction other frameworks make too). Read and write meet at exactly one point: a mutation's `onSuccess` assigns the stash key, so a successful write updates every reader in place — no refetch. (Optimistic updates, deferred, layer in here too: assign eagerly, roll back in `onError`.)

The shape keeps exactly what the real form needs: a **draft** (edit `form`, not the live shared `user`, so the nav doesn't change mid-edit), a **discardable** edit (navigate away and the stash is untouched), and an **explicit commit** that can surface a validation `422` without rolling anything back. Place-order is the same shape — `createMutation` wrapping the POST — because it's an action, not a field write, and there's no `@app.data.X` whose assignment means "place order."

### Serialization: one store, one projection

The goal behind a single store is that app state can be **fully or partially serialized, however makes sense for the app** — the cart should survive a reload; the user should be refetched. Because client *and* server state live in the one stash, that's a *projection over one store* rather than a gathering exercise — but it needs one piece of design rather than inheritance: the raw stash holds source *cells* (fetch + signal machinery), not values, so a naive `JSON.stringify(unwrapStash(app.data))` — exactly what today's `persistStash` does — would serialize the wrappers. Restore is worse: `persistStash` merges saved JSON back over `app.data`, which would replace a source cell with its dead snapshot — the key silently stops being a `source`, and every gate on it then fails the mount check. Both halves need the projection.

Saving therefore walks the stash and either snapshots or skips each source key. Skipping is the simplest correct default — server keys are refetchable, so **persist plain keys, let the gate refetch source keys** on restore (persisting snapshots for instant paint is the deferred `persist:` opt-in). And the walk itself must not be a read: an unwrapping read of a source key kicks its lazy load, so the stash exposes a non-triggering **peek** for meta-consumers — the serializer tests cell-ness and reads current values through it, and devtools / generic iteration should do the same. (Plain value reads keep load-on-touch; peek is for code *about* the stash, not code using it.) Partial serialization needs nothing special: every stash subtree unwraps to a clean plain object, so the app picks the paths and projects those.

### Alternatives considered

Each of these was traced seriously against the same cart problems. Each fails on an axis the recommended shape doesn't.

**1. The status quo: fetch inside components.** Today's cart, fully traced in the problem section. It ships, but the costs are per-screen and permanent: every new fetching route re-pays the bookkeeping tax, and the nulls keep radiating.

**2. Module resources + explicit `need` (the previous draft of this proposal).** Server values live as module singletons (`export currentUser = createResource …`); components gate with `need currentUser`. Mechanically clean — the hoisted thing is an imported identifier, everything is local — and its mechanics survive wholesale in the recommended shape (the gate, the hoist, `ensure`, the mutation write-back). What kills it is *where the state lives*:

- **Two state worlds.** Client state in the stash, server state scattered across modules — the client/server split returns as code layout, and every cross-cutting concern (serialization, reset-on-auth, future sync) must span both worlds.
- **Serialization gathers.** "Save the app state" means collecting from N modules instead of projecting one store — directly against the serialization goal.
- **Not the on-ramp.** Whatever the freshness story grows into (see *The domain and the local-first question*), it grows on one store; module singletons would have to migrate into the stash anyway.

**3. The fully-automatic stash: plain reads as gates.** The most seductive surface — `user ~= @app.data.user`, no operator at all; the framework infers the gate from the read of a `source` key. It's buildable; *Why an explicit gate?* (above) traces why it's still the wrong default: progressive rendering forces an inverted "don't gate" marker anyway, so the designs differ only in which side is unmarked — and inference puts render-blocking, the consequential behavior, on the unmarked side, where every new source read silently joins the gate union. The explicit binding makes blocking opt-in and readable off the page, and a forgotten gate is a `T | null` compile error instead of invisible added latency.

**4. Auto-push / local-first now.** The seductive next step past reads: bind a form input straight to the live server key (`input value <=> @app.data.user.firstName`) and let the stash push on change. Traced against the real profile form: the nav also reads `@app.data.user`, so the username **changes on every keystroke** (no draft); navigating away can't **discard** (you've already mutated and pushed the shared value); and a validation `422` means **rolling the stash back** — optimistic + rollback stops being opt-in and becomes mandatory. Actions break it entirely: placing an order is a POST that returns a new order — there's no field whose assignment means "place order." And auto-push is only sound atop a durable mutation queue, delta sync, and automatic revert — sync machinery this proposal defers (see *The domain and the local-first question*). Auto-push remains a plausible later **opt-in** for the autosave niche — low-stakes keys (a toggle, "mark read") with no draft or validation — layered on once a freshness/rollback policy is designed.

### The domain and the local-first question

rip's primary domain is medical apps like medlabs. The serious challenger to this proposal's request/response model is **local-first** — replicate the org's data client-side, render from the replica, sync deltas (Linear is the best-known proof). It's a genuine option here, not a strawman: org-scoped data is bounded, IndexedDB holds gigabytes, and offline resilience has real value in clinical settings. This proposal doesn't rule it out — it argues local-first is a *separate, later* decision, for two reasons:

- **It's a standalone commitment with its own risk profile, deserving its own RFC.** Beyond the build (client replica, durable mutation queue, server change feeds with per-row permission filtering), it's an ownership commitment — stateful sync infra, distributed-bug debugging, replica schema migrations — and it puts PHI on every device that logs in: browser storage is plaintext on disk, clinics run shared workstations, breach safe-harbor turns on encryption at rest the browser doesn't provide, and replicating an org's whole panel to each staffer's profile strains *minimum necessary*. None of that is prohibitive; all of it is a different design space than render-ready.
- **This proposal is the common prefix of both futures.** Gate + refetch is correct today and survives a later local-first verdict either way: the stash is the store a replica would hydrate, `source` cells are where sync would attach, the gate becomes the hydration wait (even Linear gates lazily — heavy tables hydrate on demand), and `createMutation` is the slot a durable queue would fill. Deciding local-first now would delay fixing the actual problems — null-flicker and bookkeeping — without changing what gets built first.

Near-term, the growth path is **liveness**: gate + `staleTime`-governed revalidation ships in v1 (the default `0` keeps every screen fresh-on-navigate); revalidate-on-focus is the next trigger; `subscribe:` on genuinely-live keys (incoming results) after that — server-resident data, a session-scoped working set, nothing persisted unless a key opts in. The domain's bias throughout: *fresh or visibly loading*, which the gate plus the freshness default now actually delivers.

### Why `<~` and not a keyword

The gate is spelled **`x <~ <stash-path>`** — a binding operator, sibling of `:=` and `~=` — rather than a keyword:

- *Completes the reactivity grid* — the fourth creation form (`:=` state, `~=` computed, `~>` effect, `<~` render-ready), not a consumption operator bolted on.
- *Reads where rip readers already look* — the state-vs-computed distinction already lives in two characters at the bind site, and `<=>` established arrow-sigils in the family.
- *Makes hoistability grammatical* — a keyword is an expression, so "top-of-body only, literal path only" becomes a rule the compiler must enforce with its own errors; a binding form *is* that restriction — there's nowhere else it can appear.

Every keyword candidate mis-describes the semantics (`need` — ungated reads are needed too; `ready` scans as a predicate; `wait` collides with `!` await; `load` implies refetch; `gate` is jargon), and a word that almost-fits invites confident misreading where a sigil's opacity invites lookup. Nothing self-documents "blocks render until loaded" — that's a docs job either way. (A `@app.data.` shorthand for gate paths is a possible later ergonomic.)

### Testing gated components

The test story falls out of *writing is assigning*: a write marks a cell loaded, so a test seeds the stash and mounts — `app.data.user = fixtureUser` (keyed cells through the handle), then construct; the gate finds the value present and resolves synchronously. No network, no mocking of the gate machinery, no test-only mode. A test that wants the loading or error paths drives the cell instead: `source(path).reset()` to force the unloaded branch, or a source declared with a failing `fetch` stub to exercise the `onError` boundary.

### Breaking change impact

- **`createResource`**: repositioned, not removed. It was modeled on Solid's, whose two load-bearing features — the reactive `source` argument (derived async: refetch when an input changes) and Suspense integration — the port respectively didn't wire and rip's render model doesn't have, which is why it has no consumers today (docs mentions plus one bundle-test exercise; zero apps). Under this RFC it becomes the **standalone packaging of the same cell**, scoped to *instance-local* async — a search box's per-instance results are component state, not app data, and its race/abort core is exactly what hand-rolled search gets wrong (out-of-order responses). Zero consumers means the redesign is free to align its surface with the cell's. Loading states land in the gate and the null-branch skeleton; the missing `source` argument lands with the deferred per-instance derived-async work (finishing the port to Solid parity).
- **`persistStash`**: zero in-repo consumers (its one historical consumer, `apps/websites/fyve`, ships no `.rip` sources) — and the projection changes nothing for plain-key stashes regardless. Zero behavioral change for existing apps.
- **The cart example** converts as the reference implementation: `_layout` / `profile` / `index` / the orders screens lose the `hydrated` flag, the `loaded`/`loading` ladders, and the `if user` fallbacks; `app/stash.rip` gains `user` / `products` / `orders` sources plus the keyed `order` — the `/orders/:id` detail page (built status-quo style as the "before") trades its `mounted` fetch and `loadError` plumbing for one gated binding.
- **No existing syntax changes meaning.** `<~` is currently unused; `:=` / `~=` / `~>` / `<=>` are untouched.

### Deferred

(Keyed sources and the freshness policy were originally deferred; both moved into v1 after review — see *Keyed sources* and *Freshness*. What remains:)

- **Per-instance derived async** — search-as-you-type, autocomplete: per-keystroke results are component state, not app data. This is `createResource` finished to Solid parity (a reactive `source` argument driving refetch), not a stash key.
- **Optimistic updates + rollback** — additive on top of write-back.
- **Per-key `source` options** — where later features land on the declaration: `initial:` (pre-load value), `eager:` (launch-time load — mostly unnecessary once the build-time gate manifest ships), keyed-cache knobs (`maxEntries:`, per-entry `staleTime` overrides), `persist:` (the snapshot opt-in from *Serialization* — rare in this domain), revalidate-on-focus (a new *trigger*, orthogonal to `staleTime`), eventually `subscribe:` (live updates for genuinely-live keys).
- **Route-level error views** — a gate failure today routes the structured `{ status, message, error, path }` to the nearest `onError` boundary (layout or app-level), which can already differentiate copy by `err.path` / `err.status`. A route that *owns* its failure UI — a route-specific error rendered in the failing slot with a retry/back affordance (TanStack's `errorComponent`, Remix error boundaries) — would localize it. The rip shape is a sibling `error` render block to `render`: because gates load *before* construct, the failing component is never built, so unlike a component-swap it's a separate render path the renderer mounts at the already-computed failing chain index, falling back to the nearest `onError` when a route declares none. The foundation is in place (the renderer localizes the failure); it's a focused macro + renderer addition, not a re-architecture.

### Relationship to other RFCs

- **Builds on RFC 3/4** (typed ambient globals / `this` shape) for the diagnostics tier — but does not require a typed project; gate, hoist, and mount check are runtime mechanisms.
- **Reshapes rather than removes `createResource`** — it stays as the instance-local packaging of the cell; with zero consumers, the surface alignment is free (no RFC 6-style migration).
- **Independent of RFC 5** (typed routes), though keyed gates want its per-route `@params` typing for the key expression.
- **Converges with TanStack Router + Query** — loader-gated routes, one keyed store with `staleTime` freshness, mutations writing back. Arrived at here from rip's own reactivity grid rather than imported, which is a good sign for the shape.

---

## RFC 12: Unified emitter

> **Status: In progress.** The change moved straight from evidence-gathering into the phased, output-preserving migration below (gated on byte-identical runtime output). Phases 0–1 have shipped; phase 2 is underway.
>
> **Implemented so far:**
> - **Phase 0** — shared param-rendering policy (`emitTsParam`, `src/params.js`), ending the `formatParam`/`collectParams` drift (the `asOf?` bug).
> - **Phase 1** — the marker bridge (`MarkerRecorder`/`stripMarkers`, `src/sourcemaps.js`): exact generated positions captured without rewriting `emitProgram`; the repeated-identifier source-map gap is closed and enforced by `test/types/sourcemap-corpus.js`. (The heuristic `recordSubMappings` + the LSP `findUnusedOccurrence` spill search are *not yet removed* — that awaits broader per-handler marker coverage.)
> - **Phase 2 (partial)** — the **diagnostic-equivalence gate** (`test/types/diagnostic-corpus.js`, in `test:all`); inline emission of **function return types** and **typed destructuring** on the check path; the **param-copy**, **typed-local hoist**, and **arrow-param transfer** reconciliation passes deleted; **TS1064 / TS2393 / TS2394 recovered** (`SKIP_CODES` down 7 → 4 structural-only codes — 2389/2391/2567/2842). Runtime output byte-identical throughout.
>
> **Remaining:** the bulk of the `compileForCheck` reconciliation (load-bearing until its construct is inlined — top-level declarations, arrow return types, overload/class machinery); deleting the heuristic map + LSP spill (the fault-B insurance, Track B); and schema field symbols (Track C / fault C). Net production line count stays ~flat by design — see *Surface-area collapse*.

Rip's type system was bolted onto a runtime-first compiler. It works, but a family of recurring failures is not a long tail — it's the predictable output of *how* types were retrofitted. The everyday cost is editor intelligence landing in the wrong place: completion, hover, go-to-def, and diagnostic squiggles mis-position on ordinary typed code — the bug class that's recurred roughly biweekly (seven fixes across six weeks) without ever closing. Rarer but sharper, the same retrofit can also *drop* real type errors: to hide its own structural noise it mutes whole `tsc` error codes *globally*, so a mis-annotated async return or a duplicate definition can pass `rip check` clean while plain `tsc` flags them. The first is the broad daily tax; the second is a narrower correctness gap — and a second, independent sign the mechanism is wrong. This RFC replaces the retrofit's mechanism while keeping its strategy.

### Problem — the shadow-TypeScript retrofit

Type checking is a *shadow `.ts`* model: the compiler emits two artifacts from one source — `result.code` (runtime JS) and `result.dts` (a `.d.ts` of the typed surface) — and `compileForCheck` (src/typecheck.js) splices them into one virtual `.ts` that `tsc` will accept, then maps tsc's verdicts back to Rip positions. The strategy (delegate type work to `tsc`) is correct and should stay. Two *mechanism* choices are the problem:

1. **Types live in a separate artifact, stitched back by ~1,300 lines of regex/line reconciliation passes** (overload interleaving, typed-local hoist, class-field injection, schema-overload bridging, …), each obligated to preserve line counts so the source map survives.
2. **The source map is reconstructed *after* codegen by a regex+distance identifier search** (`recordSubMappings`). It anchors only identifiers; non-identifier and *contentless* positions — a blank object slot, an empty string mid-typing — are unrepresentable and fall back to the statement start.

These yield three fault lines, unequal in weight — **B is the class** (it mis-resolves *everyday* typed code and is where the recurring fixes land); **A** and **C** are the same separate-artifact choice biting in two narrower ways:

- **A — reconciliation fragility.** The merge passes are combinatorial and brittle to codegen format changes.
- **B — source-map imprecision.** Hover / definition / diagnostics / completion mis-resolve at non-identifier, contentless, and repeated-identifier positions.
- **C — no-symbol DSL targets.** Schema fields compile to string-literal *data* (`{name:"id", modifiers:["!"], …}`), so there is no symbol for `tsc` to hover or jump to.

### Evidence

Gathered from the typed Rip code that exists today — the cart example, the type audit, and `medlabs` (the first production app being built on Rip) — plus the commit history.

- **Concentration.** The load-bearing number: **7 source-map / reconciliation / diagnostic-position fixes recurring ~biweekly across six weeks**, every one a point-patch to the same machinery, none closing the class. (The shadow layer is also 33% of `src/` commits over 90 days, but that figure is atmospheric — the youngest subsystem dominates commit share regardless of design quality, as the construction-vs-fixes split itself shows. The recurrence is the signal, not the share.)
- **Dual-emitter tax.** ~12 substantive commits/90d touched the runtime emitter *and* the type emitter together — every type-bearing feature pays it. Sharper still, the *type surface itself* is rendered twice: the check path (`formatParam`, src/compiler.js) emits params inline for the shadow `.ts`, while the `.d.ts` path (`collectParams`, src/dts.js) re-derives the same params by walking the raw lexer **token stream** — a *second parser* for parameter names, optionality, default-ness, and types. They drift in exactly the predicted way: an untyped optional param (`(dob, asOf?) ->`) dropped its `?` and was treated as required in *both*, and the fix (`asOf?: any`) had to be applied to each independently (surfaced by `513230871` in `medlabs`). One construct, already parsed once, parsed again to emit its type — the dual-emitter tax in its purest form, and the concrete seed of fault A's *cause* (not just its reconciliation symptom).
- **Surface-area collapse (not a line count).** The *total* line drop is modest — type *derivation* (`dts.js` / `schema/dts.js`, ~1,750) **relocates** into the emitter and the map *data structure* (`sourcemaps.js`) **stays**. The win is that the **brittle, line-arithmetic surface that's been the actual bug source goes away**: the `compileForCheck` reconciliation passes (~1,300), the heuristic source map (`recordSubMappings` / `collectSubExprs` / `buildMappings`, ~290), and ~half the `patchTypes` hacks (~100) — ~1,700 lines, exactly the machinery the *concentration* figure flags as the recurring fix site. Conservatively so: a *second* occurrence-guess layer retires too — the editor providers carry their own word-boundary search and spill (`findUnusedOccurrence`, several hundred LSP lines) that exists only to survive the imprecise map, so the bug class doesn't fully close until consumers stop occurrence-guessing either (an exact map with a stale spill-search still drops tokens). Net, not gross: against the ~1,700 deleted, the additions are modest and one-time — a position-tracking builder (a few hundred lines, largely *replacing* the ~290 deleted map-builders), one `builder.mark()` per position-bearing handler (≈1 line each), and the bounded parser loc-attach; the two new corpora are test assets, not production surface. So this is not a raw line win — production code lands roughly flat. What changes is the *kind*: brittle line-arithmetic glue (the recurring fix site) becomes local, gate-checked marks.
- **Suppressed-diagnostic recovery.** The type audit drove `SKIP_CODES` to its irreducible minimum — that floor is the header/body split made measurable. All seven existed only because the header and body are two views of one symbol; unified emission removes their cause, so the diagnostic-equivalence gate retires them code-by-code as each construct goes inline. (1064 turned out to be exactly this rather than a separate "latent emission gap": emitting the async return type *on the implementation* surfaces it directly.) The correctness payoff is narrower than the line count suggests: the mute is *global*, so on the codes a user can actually trip it swallowed real mistakes — three (1064, 2393, 2394) that raw `tsc` flags but `rip check` reported clean. **All three have since been recovered** and removed from `SKIP_CODES`; `bun run test:diagnostic-corpus` now asserts each fires on its genuine-mistake probe. The remaining mutes (2389/2391/2567/2842) fire only on structural artifacts in testing, so suppressing *those* is correct — the recovered coverage was the user-reachable subset, not a blanket win.
- **Reproductions.** Concretely:
  - a blank line under `use serve` offers global identifiers instead of the config object's properties (**B**, a contentless position);
  - `stash.rip`'s `totalPrice` type-member maps to the `export type Cart` header instead of the member (**B**, repeated identifier);
  - in `medlabs`, `auth.rip` declares two sibling `createMutation`s, `signUp` and `devLogin`. At `loading: signUp.pending`, `signUp` loses its `property` semantic token; at the identical `loading: devLogin.pending`, `devLogin` keeps it. The sole difference: `signUp` is *also* referenced inside an inline `@submit` handler (`(e) -> …; signUp()`), and that extra occurrence shifts the spill-search so the `loading:` token finds no free slot. `tsc` classifies both identically — a pure position-map drop, with a clean same-file A/B control (**B**, repeated identifier);
  - a schema's `firstName` maps correctly onto the string literal `"firstName"`, which has no symbol (**C**).
  - an async `def` whose return is mis-annotated `:: string` instead of `Promise<string>` compiles to `async function f(): string`; raw `tsc` on the shadow flags **TS1064** ("Did you mean `Promise<string>`?"), but `SKIP_CODES` mutes 1064 *globally*, so `rip check` passes — and the bogus `: string` then types every call site wrong, with no error anywhere. Defining a function twice likewise swallows **TS2393** ("Duplicate function implementation"). Both verified by diffing raw `tsc` on the shadow against `rip check` (**A**, global-suppression leak). *(Both — plus TS2394 — have since been recovered; see "Suppressed-diagnostic recovery" above.)*
  This is fault A's user-visible edge — narrower than B (rarer, and often caught at runtime) but silent when it bites. Enough to retire any claim that A is purely internal: the global mute that hides A's structural noise also hides these, and phase 2 removes the header/body duplication that forces it.
- **Feasibility.** The mechanism already exists in miniature: under `inlineTypes` the emitter emits parameter types *in position* today (`function(a: number)`, src/compiler.js) — extending that to return types, hoisted locals, and declarations is more of the same, not a new technique. Position-preserving output builders that keep mappings stable across reindent/reflow are a solved pattern (e.g. `magic-string`). Byte-identical runtime output is enforced as a migration gate (see *Constraints*), not assumed.
- **Timing.** Typed Rip is just leaving the demo stage: the cart example and the type audit, plus `medlabs` — the first production app being built on Rip — now exercising the typed, schema-heavy path for real. `medlabs` is already surfacing fresh fault-B instances (the `signUp`/`devLogin` case above came straight from it), which both validates the timing and means the cost curve has *started* to rise. Migration cost is ~zero now and only climbs as typed code accumulates — the cheapest this change will ever be.

### Why it was built this way (and why change now)

The retrofit was the right call when made. Rip began runtime-first with a proven JS emitter; types arrived later as an additive convenience, and bolting them on as a *separate* `.d.ts` reconciled after the fact had the smallest blast radius — runtime codegen untouched, a type-layer bug couldn't corrupt runtime output (literally different strings), and the common case (hovering a named identifier) was served fine by the regex map. The growing reconciliation stack isn't evidence the approach was wrong — it's evidence it worked up to a structural ceiling that typed, schema-heavy apps now push against. The one cost of unifying: both modes share one traversal, so emission changes must keep the JS token stream identical with annotations on or off — bounded by the byte-equivalence gate below, and the price for never reconciling two mismatched artifacts again.

### Proposal

Replace the dual-artifact + reconcile + heuristic-map mechanism with **a single position-aware emitter** that:

1. **Emits type annotations inline, in position, on the check path** — extend the existing `inlineTypes` path from params to return types, hoisted locals (`let x: T = …`), and declarations, so the separate `.d.ts` header and the reconciliation passes that stitch it back become unnecessary.
2. **Records exact source↔generated positions at write time** — thread a position-tracking output builder through the emit handlers (`builder.mark(node.loc); builder.write(text)`), retiring the regex+distance search. Applies to *all* emission, typed or not — and includes the **parser loc-attach for leaf atoms** (see *Constraints*), which is in-scope, not optional: several fault-B cases bottom out in bare-atom values carrying no `.loc`.
3. **Keeps runtime emission JavaScript-first** — the same single tree-walk emits plain JS in runtime mode and the same JS *plus* inline annotations in check mode. Annotations are additive: runtime mode omits them, so runtime output is unchanged and is never routed through a TypeScript representation.
4. **Points the editor providers at the exact map** — retire the consumer-side occurrence-guess/spill search (`findUnusedOccurrence` et al.) so semantic tokens / hover / definition read true positions instead of re-deriving them. Without this step an exact map still drops tokens at the consumer.

Across all four, one **scope invariant** holds as the end state: *any syntax already parsed into the AST must not be re-derived from the token stream for type or check emission.* Token walking may survive for trivia (comments, delimiter-skipping), but never as the authority for a construct's meaning — names, optionality, defaults, types. This is what names `collectParams` (src/dts.js) explicitly in scope: it is not "just a `.d.ts` formatter," it is a second parser. The honest sequencing matters, though: today `emitTypes(tokens, sexpr, source)` *receives* the AST but uses it only for the component/schema paths — the general function-declaration walker is purely token-driven and has no per-construct correspondence to the tree. So fully retiring the token walk is the *unified-emitter* end state (phase 2, when the `.d.ts` is emitted from the same AST walk as the runtime JS), **not** something to bolt on standalone: doing that in isolation would force an AST↔token correspondence layer (a source-order index matching functions to token positions) — exactly the positional guessing this RFC exists to remove. The interim, low-risk step (phase 0) is narrower and safe: unify the shared *rendering policy* — the optionality/default/type → TS-string rules where the `asOf?` drift actually lived — into one formatter both emitters call, each still extracting fields from its own input. The corollary scope boundary either way: this retires the token-derived *semantics*, not the `.d.ts` artifact itself — `result.dts` stays a public surface (`-d`, package publishing); its derivation moves to the AST.

The TS-delegation strategy is unchanged; only the mechanism that feeds and maps `tsc` changes.

### Why it dissolves the fault lines

- **A** — no header/body to reconcile; types are emitted in place. The ~1,300 reconciliation lines are deleted, not hardened.
- **B** — positions are recorded where they're written, so *every* position is exact (identifier, value, blank slot, string interior). Both the core heuristic *and* the consumer-side spill search it spawned are retired.
- **C** — inline emission gives schema fields a real type property to anchor, so hover/definition resolve at all. (The *rich* schema hover — `required · unique · min 18`, read from the descriptor — is a complementary synthetic provider, out of scope here. This RFC closes the no-symbol gap; that enhances it.)
- **`patchTypes`** (the undocumented-TS-internals hack for `let x; x = expr` → `any`) shrinks — annotated hoisted locals emit `let x: T` directly — but does not vanish, since inferred locals still need it.

### Plan

**A phase 0 signature-unification beachhead lands first — semantic de-duplication only, no map change — then phase 1 and phase 2 as two separately-gated commit series, phase 1 first.** The order is fixed (phase 2 needs phase 1's builder), not the atomicity. Phase 1 is runtime-output-preserving and closes the user-facing fault (B) — with two honest contingencies: its map-correctness corpus must be complete enough to catch mis-marks (byte-equivalence cannot), and because the consumer-side spill search lives in a *separate package* (`packages/vscode/src/lsp.js`), B closes for users only once that retirement ships in a rebuilt extension. It also sharpens go-to-def/hover for *untyped* Rip (see *What this does not change*). Phase 2 is the type-shape change, gated separately on diagnostic-equivalence, closing fault A (and the global-suppression leak it forces) and giving schema fields real symbols (C). They can land together, or phase 1 can bake in `main` first — worth staging **only if** phase-2 diagnostic-equivalence on complex generics/overloads proves a long tail, since bisection and review clarity already come from the per-phase commits, not the merge boundary. Each phase is validated against the gates in *Constraints & risks*.

- **Phase 0 — signature policy unification (beachhead). ✅ Shipped.** Collapse the duplicated param *rendering policy* before any map work — the layer where the `asOf?` drift actually lived. One shared formatter `emitTsParam(field, mode)` takes a normalized `{name, tsType, optional, hasDefault}` and owns the rules in one place: the untyped-optional `name?: any` fallback, and the `'declaration'` vs `'implementation'` mode split (in a `.d.ts` an explicit-optional *and* a defaulted param both print `name?: T`; on the check path a defaulted param stays optional via its initializer, so no `?`). Both sites call it — `formatParam` (src/compiler.js, building the field from the AST `String`-wrapper) and `collectParams` (src/dts.js, building it from the token's `.data`). Each still reads its own input; only the policy is shared, so there is no new AST↔token correspondence layer (that, and the full token-walk retirement, is deferred to the unified emitter in phase 2 — see the *scope invariant* above). Pure de-duplication of the drift-prone rules: no source-map change, runtime byte-identical, `.d.ts`/check output diff-gated. It is the smallest slice that proves the dual-emitter thesis (fault A, for signatures) on the freshest pain — the `asOf?` bug — with a clean *same-construct* A/B, and it lands independent of and before the builder. It deliberately does **not** validate the position map; that is phase 1's job, and the two prove different things (params = the dual-emitter tax; builder = source-map precision).
- **Phase 1 — position-tracking emitter. ✅ Shipped (marker bridge); heuristic-map + LSP-spill removal still pending.** Thread the output builder through the ~61 position-bearing emit handlers (of ~95 `emit*` methods in `compiler.js`; the remainder are structural helpers that emit no source-mapped text); land the parser loc-attach for leaf atoms; retire the heuristic core map *and* the consumer-side spill search. Records exact positions for *every* construct, including the contentless ones the heuristic cannot represent (closes fault B). Runtime-output-preserving — the map, not the JS, is the deliverable *and* the risk surface (see *Constraints*). **Mechanism — marker bridge, not a builder rewrite.** An `EmitBuilder` + `emitTo` seam was tried first (a position-tracking output accumulator threaded through the handlers) but the *marker bridge* superseded it: it captures exact generated positions without converting `emitProgram`, so the builder seam was unused and **removed** (don't carry dead scaffolding). The builder *concept* may return for one residual case markers can't express — **contentless positions** (a blank object slot, an empty mid-typing string) have no text to wrap a sentinel around — but that capability isn't built yet, so it's not a live dependency. Still pending: per-handler marker coverage (calls, member access, object keys, params, …) until exact marks cover enough to retire `recordSubMappings` + the LSP `findUnusedOccurrence` spill search.

  **Execution plan — marker bridge (the tractable route to exact *generated* positions).** Converting `emitProgram` byte-identically is the highest-risk piece, so it is deliberately *not* the first builder PR. Exact generated positions are captured *without* rewriting the string emitter: selected handlers wrap just the identifier text in unique zero-width Private-Use-Area sentinels (`MarkerRecorder.wrap` in `src/sourcemaps.js`); the legacy string concatenation carries them through untouched; one final `stripMarkers` pass removes them and reads exact generated spans off the clean stream (failing hard on unbalanced markers). This sidesteps `emitProgram` entirely and handles statement reordering for free. *Why not a "measuring wrapper" at the `emit()` dispatcher?* — a child returns its string before the parent decides its prefix / `return`-wrap / indent / semicolons, so you can measure a child's length but never its absolute offset without re-searching (the heuristic being deleted). Markers carry identity *through* concatenation, which a length-measuring wrapper cannot. Staged: **(A)** marker primitive + unit tests proving distinct generated offsets for repeated identical text; **(B+C)** restore gated `subLocs` + a `childLoc` reader and mark the param (via the shared `emitTsParam`) and the body identifier reference (a narrow `emitChild` using `childLoc`, starting with `return`'s operand) — no `emitProgram`, no marking every string; **(D)** an exact-map overlay in `buildMappings` where exact marks win and `recordSubMappings` stays the fallback, flipping the corpus gap (repeated-identifier body vs signature) to an *enforced* pass. **The discipline that keeps the half-state from getting messy:** one unified mark *consumer* format `{ kind, loc, sourceStart/End, generatedStart/End }` — producers may vary over time (string markers now, real `builder.span()` later), but the consumer (`buildMappings`) is single. Everything is gated to the check/exact path (0% runtime, 0% normal-compile cost; `subLocs` gated behind a parser option), so nothing lands as always-on or unconsumed. The full per-handler builder conversion remains the end state, but the converted-construct list is driven by real corpus/editor failures rather than a 61-handler march.
- **Phase 2 — inline type unification. 🚧 In progress.** Emit return types / locals / declarations inline on the check path; retire the reconciliation passes. Runtime mode emits the same walk with annotations omitted (no separate transform). Closes fault A and the no-symbol half of fault C. *Shipped so far:* the diagnostic-equivalence gate; inline **return types** and **typed destructuring**; deletion of the **param-copy**, **typed-local hoist**, and **arrow-param transfer** passes; recovery of **1064/2393/2394** (`SKIP_CODES` 7 → 4). *Remaining:* top-level declarations, arrow return types, the overload/class injection passes, and the schema-symbol half of fault C.
- **Optional pre-fix — only if the full change is deferred.** A standalone patch to the *existing* heuristic (anchor object `:` pairs in `collectSubExprs`; resolve repeated identifiers by traversal order in `recordSubMappings`) would relieve object-key completion and the repeated-identifier mis-maps sooner — but it polishes code phase 1 deletes, so it's a stopgap only, never a step toward the unified emitter.

### Constraints & risks

The migration is protected by three gates; the first exists today, the other two are net-new and are first-class deliverables of this work.

- **Runtime byte-equivalence (existing).** Runtime mode is the current emit path with annotations switched off, so equivalence is the default rather than a transformation to verify; every stage diffs generated runtime output against the current emitter across all tests + the example apps, and a change that alters runtime text fails the gate. This same gate keeps the two modes from drifting — the JS token stream must be identical with annotations on or off — and it preserves the "a type bug can't reach runtime" safety of the two-artifact design: runtime output is held byte-identical and the runtime path migrates last, so there is never a window where a type-layer change alters running code.
- **Map-correctness gate (new).** Byte-equivalence protects runtime output but *not* the map — the map isn't in the JS, so a handler that marks the wrong node fails silently. The migration introduces the project's first map-correctness corpus: assert `srcToOffset(line, col)` lands on the expected token and that hover/definition/semantic-token-classification there resolve to the expected symbol, across the test + example sources. Today *no* test asserts map correctness at all, so this is net-new safety the heuristic never had. **Seeded** (phase 1, step 1): `test/types/sourcemap-corpus.js` (`bun run test:sourcemap-corpus`, in `test:all`) asserts `srcToOffset` round-trips for a curated token set against the *current* heuristic — an **enforced** `pass` bucket (regressions fail) plus a `gap` bucket of documented fault-B targets (a known repeated-identifier collision today; the suite stays green while a gap persists and flags when one resolves, the signal to promote it). This is the gate every subsequent builder slice is checked against; it grows as cases are added and as gaps close.
- **Diagnostic-equivalence gate (new).** Inline emission changes the *shape* types reach `tsc` in (inline `let x: T` / adjacent signatures vs a `declare` header), not the type facts — no checker verdict may silently shift. The gate runs **two populations**, because the after-set is deliberately *not* uniformly identical: phase 2 enlarges it exactly where suppressed codes recover. (a) **Passing corpus** (test + example apps, type-clean today) — assert an identical diagnostic set across *all* codes, the seven `SKIP_CODES` included; post-unification they no longer fire on clean code, so any that does is a real regression, not an artifact to mute, and a changed or vanished diagnostic fails the gate (emission shape tuned to match). (b) **Negative corpus** (`test/types/diagnostic-corpus.js` + the audit's negative tests) — assert each recovered code now fires where a genuine mistake exists, the inverse of today's swallow. The split *is* the safety: a global code-level carve-out ("identical *modulo* the recovered codes") would make a resolution-changed regression indistinguishable from a recovery — so equivalence stays strict where a code should be silent, and recovery is asserted positively where it should fire.
- **Reindent/reflow must route through the builder.** The emitter post-processes some fragments — reindenting and line-by-line reassembly of comprehensions/loops — and raw-string surgery would invalidate marks placed inside the moved text. These operations move to builder ops that shift their marks with the text (the `magic-string` pattern): a known technique, but real porting work in phase 1.
- **Leaf-atom positions.** Object / array / call / pair nodes carry `.loc`; bare atoms (identifier / string / number primitives) do not, because the parser attaches loc only to array reductions (`rv.$.loc = rv._$ if Array.isArray rv.$` in `solar.rip`). Object keys are covered by the pair node's loc; bare-atom *values* and call args need loc carried at the parser loc-attach site (a bounded grammar/parser change). As noted in the *Proposal*, this is load-bearing rather than optional polish — several confirmed fault-B reproductions resolve to nothing else. **Span length now carried (done):** the same reduction dropped the length `n` (`rv._$ = { r, c }`), and since `RipError.fromSExpr` reads `length: loc.n ?? 1`, *every codegen-phase error caret was one character wide* — the array-only loc design degraded user-facing error reporting, not just the editor map. `solar.rip` now records `n` as the span to the end of the last RHS symbol on the same line (regression: `test/error-span.test.js`), so carets cover the real construct and array-node marks have real width. The remaining leaf-atom work (giving non-array atoms their own position) is the higher-risk follow-up. **Two routes were prototyped (neither landed yet):** *(1) Boxing* bare identifiers into `String` wrappers so they carry `.loc` — **rejected**: a `String` is `typeof "object"` and `!== "literal"`, breaking the ~100 `typeof x === "string"` / `=== "literal"` node checks across `compiler.js`/`components.js` (the first attempt silently dropped destructuring vars from `collectProgramVariables`, `let a, b, o` → `let o`). *(2) Parent-held child locs* — a non-enumerable, element-aligned `subLocs` array on each array node, emitted by `solar`'s action compiler (~55 lines; flat + spread templates; atoms stay primitive). This **works**: byte-identical output, distinct positions for repeated identifiers (`(asOf) -> asOf` resolves cols 12 vs 39). It's the chosen mechanism — equivalent to a parent-keyed side table (green-tree style; the mainstream "loc on every node" assumes *object* nodes, which Rip's primitive-leaf s-exprs are not). Cost ~+2.4% compile (0% runtime, additive metadata), so it should land **with** its consumer, not as unused infrastructure. **Critical finding — exact leaf *source* positions are necessary but NOT sufficient:** feeding `subLocs` into the heuristic still mis-maps, because `recordSubMappings` chooses the *generated* position by regex+distance and picks the nearer generated *line* — the body `asOf` reference resolves to the signature `asOf: T`'s generated offset, not `return asOf`. The generated position must be recorded at write time by the builder; the heuristic cannot be patched into correctness here. Direct confirmation of fault B's thesis — and the reason the leaf-loc work must land together with builder handler conversion (phase 1), not as a standalone heuristic patch.
- **Breadth, not depth.** Phase 1 touches many handlers; the work is mechanical and diff-gated, not conceptually hard. But two failure modes get *asymmetric* protection. A handler that drifts the **JS output** is caught by the byte-diff gate, and the heuristic stays a fallback for any *unmarked* handler — so no interim regression there. A handler that emits correct JS with a **wrong mark** is invisible to byte-equivalence (the map isn't in the JS) and the fallback doesn't help (the handler *is* marked, just wrong); it's caught only by the new map-correctness corpus. That mis-mark case — not the missed handler — is phase 1's real risk surface, and it is only as covered as that corpus is complete. This also fixes the migration *shape*: handlers convert incrementally behind the fallback, in reviewable slices, not one cut. (Person-time isn't bounded at this stage; that's for the proposal, once the builder API is fixed.)

### Objections, and what survives them

The honest case isn't "this is free" — it's that each apparent cost, examined, turns out to be largely a status-quo problem in disguise, leaving a real but narrow residual. Those residuals, named so the trade stays explicit:

- **Mark upkeep on codegen changes.** The heuristic re-derives positions by searching output, so it survives emitter changes untouched; a baked-in `builder.mark(node.loc)` must instead stay correct when a handler's codegen changes. History says this is frequent but cheap: of the ~12 substantive dual-emitter commits/90d, ≈40% changed **token-stream shape** (would touch marks), ≈60% only **added a type fact** (would not) — and a mark sits on the same line as the `write()` it annotates, so fixing it is part of a shape change you're authoring anyway. It's **gated**, too: the map-correctness gate turns a botched mark into a localized build failure at the change site — the change→gate→fix loop a human or agent handles mechanically — where the heuristic's "zero upkeep" instead ships *silent* mis-maps (fault B is exactly that). Residual: marks inside text that reflow/reindent moves (non-local, mitigated by routing reflow through the builder), the gate being only as good as its corpus, and synthesized output with no source counterpart (a mapping judgment).
- **Verdict-equivalence for complex types.** Phase 2 emits types inline, gated on diagnostic-equivalence with today's verdicts — the one objection that doesn't fully dissolve, though its baseline is wrong. Today isn't inline types checking "identically" to a `declare` header: `compileForCheck` runs *both at once*, then reconciles by hand — interleaving overload signatures, deduping doubled diagnostics, and **globally muting seven TS codes** (`SKIP_CODES`; 2389/2391/2393/2394 are overload artifacts) that fire only because header and body are two views of one symbol. So even common cases don't check identically — disagreements are suppressed. The un-dissolving work is *reproducing* those verdicts through one inline emission on complex generics/overloads, where declaration shape drives TS resolution and the gate — unlike the allowlist — can't be satisfied by muting. Upside riding along: removing the header/body split also removes the *cause* of six of the seven `SKIP_CODES`, recovering globally-suppressed diagnostics — see *Suppressed-diagnostic recovery* in Evidence.
- **Reduced source-level separability.** Type derivation lives in its own files today (`dts.js` / `schema/dts.js`); afterward it co-locates in the emitter behind the mode flag, so reading the runtime emitter means passing flag-guarded type branches instead of skipping a file. Two things bound this. The removability that matters — *output*-level — is preserved: runtime mode emits no types. And the file separation is partly illusory: `dts.js` can't be lifted out wholesale, because the reconciliation passes (`compileForCheck` / `recordSubMappings` / `patchTypes`) are load-bearing glue that exists *only* to stitch the separate type pass back onto runtime output — fault A, the drift seam this RFC closes. So the trade is file-level separability (some of it fictional) for concern-level coherence, mitigated by keeping type emission in clearly flag-guarded branches.

### Alternatives considered

- **Keep patching.** The maintenance data shows the same fault class recurring ~biweekly on near-empty typed code; the cost curve rises with adoption. Rejected.
- **Marker/sentinel-probe completion only.** Already partly shipped and effective for *completion* — but it is a completion-only technique (you cannot inject a sentinel to hover an existing token), so it leaves hover / definition / diagnostics on the broken map. A point fix, not the foundation.
- **The post-pass map fix alone.** Anchoring object pairs and resolving repeated identifiers in the existing heuristic helps those positions, but the post-pass fundamentally cannot represent contentless positions, and it polishes code phase 1 deletes. Kept only as the optional deferral stopgap above, not a destination.

### Effect on existing code

No language-surface change; runtime output byte-identical (migration gate). Regression metric: `test` / `test:types` stay green, the two new gates (map-correctness, diagnostic-equivalence) pass, and the `rip check --sourcemap` gap count drops — especially fault B.

### What this does *not* change — Rip stays JavaScript-first

This is not a move toward "a language that emits TypeScript." Precisely:

- **Nothing Rip ships or runs becomes TypeScript.** Every executed artifact — browser bundle, `bin/rip` output — stays byte-identical JS. The only TypeScript is the type-check shadow, which is *already* TS today: `compileForCheck` builds a virtual `.ts` solely for `tsc`'s language service — never written, bundled, or run; thrown away after the check. This RFC changes *how that throwaway shadow is assembled* (one in-position walk vs. two artifacts + glue), not whether it exists.
- **Types remain additive and ignorable.** A developer who never opts in (no `::`, no `schema`) gets a `// @ts-nocheck` shadow and pays nothing; their JS is emitted directly, exactly as now.
- **A win lands even for untyped Rip.** Position tracking (phase 1) fixes the source map for *plain, untyped* programs too — go-to-definition and hover on ordinary identifiers get more accurate whether or not anyone writes a single type. The map fix is a codegen-accuracy feature that the checker also happens to consume, not a types feature.

### Relationship to other RFCs

The type-system RFCs (1–5, 11) all *ride on* the source map and reconciliation this RFC replaces; none change in surface, all become more reliable. Independent of the reactivity and packaging RFCs. The complementary schema-aware hover provider — rich field semantics from the descriptor — is a natural follow-on once phase 2 gives schema fields real symbols.

### Field ledger — fault-coping inventory & migration cleanup

A running inventory of coping code that exists today *because of* faults A/B/C — one row per mechanism (commits that re-patched a guard share its row). It serves twice: as empirical evidence (each row names the machinery and the commits spent on it) and as a migration checklist (**On landing** says what becomes of the code, and in which phase). Disposition *is* the resolution verdict — **Remove**: fault resolved entirely, code dies; **Keep**: resolved only partially, an orthogonal ownership concern survives; **Partial**: code shrinks but stays.

This substantiates the *Concentration* figure (Evidence) from the other side: the seven six-week fixes (`2e1eca39`, `c922b998`, `8c4d92de`, `cfe91e17`, `13097e54`, `831ddedf`, `2d415756`) appear as **Origin** entries, fault B dominates, and origins reaching back to March (`9ce50baf`, `c88d8d2e`, `ab5e9c54`, …) show the pattern predates the window. Append rows as faults surface, don't prune; comments on each guard stay self-contained, so this ledger is the one-directional index.

| Fault | Coping mechanism — location · what it copes with                                                                                                          | Origin                             | On landing                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------- |
| B     | `findUnusedOccurrence` spill search — `lsp.js` · re-derives a token's position when the map collides                                                      | `b71bcf56`, `831ddedf`             | Remove (P1)                               |
| B     | `mapToSourcePos` ±10-line word-search fallback — `typecheck.js` · guesses a diagnostic's position by nearby word match                                    | `2e1eca39`, `9ce50baf`             | Remove (P1)                               |
| B     | `srcToOffset` gen-column hint + contentless reach — `typecheck.js`/`lsp.js` · positions completions at blank / comma / collapsed-block spots              | `c922b998`, `13097e54`, `2d415756` | Remove (P1)                               |
| B     | `isInsideStringOrComment` redirect — `lsp.js` · drops tokens/diagnostics the map lands inside a string or comment                                         | `b71bcf56`, `c88d8d2e`             | Remove (P1)                               |
| B     | beyond-source-length drop — `lsp.js` · discards diagnostics mapped past EOF                                                                               | `06ca7c6a`                         | Remove (P1)                               |
| B     | diagnostic-span snap/clamp — `typecheck.js`/`lsp.js` · snaps a diagnostic onto the real token (incl. route `href`/`push`)                                 | `9ce50baf`, `aab397f8`, `0bfca14c` | Remove (P1)                               |
| B     | token-output duplicate-position dedup — `lsp.js` · drops a second token at an already-taken position                                                      | `b71bcf56`                         | Remove (P1)                               |
| B     | `isRenderConstructionVar` 6133 skip — `typecheck.js`/`lsp.js` · mutes unused-var hints on synthetic `_0/_1` render vars                                   | `5427b315`, `6cc3154a`             | Remove (P1)                               |
| B     | header-region 6133/6196 drop — `lsp.js` · mutes unused-decl hints on injected ambient globals (e.g. `declare const schema` colliding with the keyword)    | —                                  | Remove (P1)                               |
| B     | render-block tag/attribute + tag-shorthand skips — `lsp.js` · lets the TextMate grammar own tags/attrs in render context                                  | `ca4961bf`, `831ddedf`             | Keep                                      |
| B     | `schemaHeadPositions` skip — `lsp.js` · lets the grammar own the `schema` keyword                                                                         | —                                  | Keep                                      |
| B/C   | `schemaBodyLines` token suppression — `lsp.js` · lets the grammar own schema field names/types/`@directives` (fields are string-literal data, no symbols) | —                                  | Keep                                      |
| A     | `isInjectedOverload` diagnostic skip — `typecheck.js`/`lsp.js` · drops diagnostics on injected overload signatures                                        | `7373f1b2`, `8c4d92de`             | Remove (P2)                               |
| A     | synthetic-line token skips — `lsp.js` · drops tokens from injected non-source lines (declare-globals, framework defs, ARIA block, stubs, overload sigs)   | `d74e04da`, `7373f1b2`             | Remove (P2)                               |
| A     | `dedupDiagnostics` — `typecheck.js` · collapses header↔body duplicate diagnostics                                                                         | `3232a060`, `8c4d92de`             | Remove (P2)                               |
| A     | "don't interpolate into DTS header" gap-fill guard — `typecheck.js` · stops the interpolation pass fabricating header maps                                | `cfe91e17`                         | Remove (P1)                               |
| A     | `SKIP_CODES` global mutes (2389/2391/2567/2842 — *was* also 2393/2394/1064) — `typecheck.js` · silences overload / header-body structural codes              | type audit                         | Partial (done P2) — 1064/2393/2394 recovered; 2389/2391/2567/2842 structural-only (Keep) |
| A     | `patchTypes` internals hack — `typecheck.js` · forces `let x; x = e` locals to `any`                                                                      | —                                  | Partial (P2) — inferred locals remain     |
| A     | `collectParams` token-walk — `dts.js` · second param parser; re-derives name/optionality/default/type from tokens and drifts from `formatParam` (the `asOf?` bug). The dual-emitter *cause*, not a coping guard | —                                  | Partial (P0) — shared rendering policy; full token-walk retires at P2 |
