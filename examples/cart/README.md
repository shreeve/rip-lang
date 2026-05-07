# Cart Demo

A minimal shopping cart built with Rip App to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd examples/cart
rip server
```


## RFC 1: how should Rip packages expose types to typed Rip apps that consume them?

While working on this app, only the client is fully type-safe. The root `index.rip` and `api/` routes are currently excluded from `rip check` (via `rip.json`), because type-checking them would require the two server packages they depend on — `@rip-lang/server` and `@rip-lang/server/middleware` — to be typed as well. Neither is.

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


## RFC 2: how should the Rip App framework expose types for its ambient globals?

RFC 1 covers packages that consumers reach via `import` — `@rip-lang/server`, `@rip-lang/db`, etc. The Rip App framework is a different shape. Its public API — `createResource`, `createComponents`, `createRouter`, `createRenderer`, `launch`, `delay`, `debounce`, `throttle`, `hold`, `stash`, `raw`, `isStash`, `persistStash`, `setContext`, `getContext`, `hasContext` (thirteen framework-authored exports plus three context helpers re-exported from the component runtime, sixteen total) — is exposed as **ambient globals** in the browser, registered onto `globalThis` by the build script when `rip.min.js` loads. Untyped consumers just write `createResource ...` with no import line. That's a deliberate part of the framework's "no build step" promise: a `<script src="rip.min.js">` tag plus a few `<script type="text/rip">` blocks is a complete app.

The problem: today these globals have **no types**. A typed component file that calls `createResource` fails `rip check` with `TS2304: Cannot find name 'createResource'`. Useful framework helpers — and the natural touch points for typed app code — are exactly the ones the type checker can't see.

A note on terminology before the proposal: **Rip's type pipeline is virtual end-to-end.** `compileForCheck` invokes the compiler with `types: 'emit'`, which returns `result.dts` as an in-memory string. That string is prepended to the shadow TS source and handed to the TypeScript language service via `getScriptSnapshot`. **No `.d.ts` file is ever written to disk.** Nothing in `node_modules`, nothing in the package, nothing in the repo. When this RFC mentions "DTS" it means a virtual in-memory string, not a file artifact.

### Proposal — typed apps use explicit imports; the bundle still exposes globals

Three pieces, in order of how they compose:

1. **Annotate `packages/app/index.rip`.** Add `::` type annotations to the framework's public exports — `createResource`, `createComponents`, `createRouter`, `createRenderer`, `launch`, `delay`, `debounce`, `throttle`, `hold`, the stash helpers (`stash`, `raw`, `isStash`, `persistStash`), and the context helpers (`setContext`, `getContext`, `hasContext`). This is the same Option-1 mechanism from RFC 1, applied to the app framework. The framework's `.rip` source becomes the type contract.

2. **Resolve `@rip-lang/app` like any other typed Rip package.** When `typecheck.js` sees `import { createResource } from '@rip-lang/app'` in a typed `.rip` file, it reaches the package via the same path it would use for `@rip-lang/server` or `@rip-lang/db` (RFC 1's mechanism): run `compileForCheck` against the package's annotated `.rip` entry, cache the resulting DTS in memory, hand it to the TS language service through the import specifier. No new resolution path, no auto-detection, no policy list.

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
- Reuses RFC 1's machinery directly. No new resolution path, no detection heuristic, no policy list of "auto-injected packages."
- Discoverable. `import { createResource } from '@rip-lang/app'` tells the reader exactly where the API lives. Editor go-to-definition, find-references, and `grep` all work.
- Aligns the framework with every other Rip package. `@rip-lang/server`, `@rip-lang/db`, `@rip-lang/ui` are imported; `@rip-lang/app` becomes consistent with them, not the special case.
- Forward-compatible. If framework globals are ever consolidated under a single namespace (see RFC 3) or retired in favor of imports, there's nothing to undo. The rewrite target changes; the import-resolution story doesn't.
- Generalizes. Every future Rip package — ambient or not — exposes types the same way.

**Cons:**
- Typed code carries an import line that untyped code doesn't. A typed component starts with `import { createResource } from '@rip-lang/app'`; an untyped one doesn't. The two shapes differ slightly.
- Two valid surface forms exist (the global and the imported binding, both resolving to the same value). Some users will mix styles.
- Requires the browser compiler to learn a new specifier prefix (`@rip-lang/*`) in its existing rewrite pass. Roughly ten lines of pattern matching, but it is new code.

### Effect on untyped apps

**None at runtime, in either direction.**

- The bundle continues to register framework helpers on `globalThis` exactly as today. `rip.min.js`, `<script type="text/rip">`, no import line — that path is unchanged.
- The "no build step" promise is preserved. An untyped app stays one HTML file plus `<script>` tags.
- The only thing that changes is what *typed* code writes to satisfy the type checker. Untyped code never sees a difference.

A subtle bonus: once the browser compiler recognizes `import { createResource } from '@rip-lang/app'` and rewrites it to a global access, untyped users *can* write the import too if they want consistency. They're not forced to; they gain an option. Nothing breaks if they don't.

### Alternatives considered

- **Auto-inject ambient declarations into typed `.rip` files** that use the framework (detected via heuristics like `<script src="rip.min.js">` presence, a `launch` import, or a `rip.json` flag). Rejected. The detection heuristic is a new failure mode — when it guesses wrong, the failure presents as "types just don't show up" with no obvious cause. It introduces a second type-resolution path in `typecheck.js` distinct from how every other package resolves. It needs a policy list of "well-known auto-injected packages" that grows with every framework-tier package. Saves typed users one import line per file — a real cost, but smaller than the costs above.

- **Hand-written `APP_TYPE_DECLS` map in the compiler** (parallel to `STDLIB_TYPE_DECLS` in `src/stdlib.js`). Rejected: the stdlib precedent doesn't apply here. Stdlib helpers are hand-written **JavaScript** — `getStdlibCode()` returns a JS string literal — so hand-written TS is the only option for them. The app framework is real Rip with real exports the type pipeline can already analyze. Choosing hand-written TS would re-create the exact drift problem RFC 1 rejected. Doesn't generalize either: every future framework-tier package would need its own bespoke injection block.

- **Build-time DTS generation, shipped as a real `.d.ts` file** (write `packages/app/index.d.ts` during `bun run build`, ship it in the published package, let TS resolve it through `package.json` `"types"`). Same source-of-truth as the proposal — the difference is a build-time, on-disk artifact instead of check-time, in-memory generation. Rejected because it introduces a committed/published file that has to stay in sync with `index.rip`, makes `bun run build` mandatory before `rip check` works, and adds a disk artifact where none is needed. Worth revisiting only if Rip ever needs to expose types to non-Rip TypeScript consumers, which is out of scope here.

- **TS reference directives** (`/// <reference types="@rip-lang/app/globals" />` injected at the top of every shadow TS file) and **synthesized `tsconfig.types`** (have `rip check` add `@rip-lang/app` to a virtual tsconfig's `types` array). Both are alternative *delivery mechanisms* for ambient declarations — variants of the auto-inject path above, sharing all of its drawbacks.

### The principled split between this RFC and RFC 1

RFC 1 is about **how a Rip package authors and exposes its types.** Its answer: annotate the source, generate the DTS on demand.

RFC 2 is about **how the App framework's ambient-runtime model interacts with that authoring story.** Its answer: keep the runtime ambient (globals on `globalThis` for zero-ceremony untyped apps), but route typed access through explicit imports so the same DTS pipeline serves both audiences.

The two RFCs share Option 1 of RFC 1 as their type-authoring mechanism. RFC 1 says how types are produced; RFC 2 says how typed apps consume them when the package's runtime delivery is ambient.


## RFC 3: should the Rip App framework's ambient globals live under a single `Rip` namespace?

RFC 2 keeps today's runtime delivery untouched: the bundle spreads each framework export onto `globalThis` as a top-level name. That works, but the public surface is large — sixteen names total — and several (`delay`, `hold`, `raw`, `stash`, `launch`) collide naturally with user code. A typed component that writes `delay = 200` lexically shadows `globalThis.delay` for the rest of the file (compiler turns it into `let delay; delay = 200;`); a later `delay! 100` in the same scope crashes with `delay is not a function`, with the error pointing at the call site, not the shadowing line. The `AGENTS.md` "don't shadow injected globals" warning exists because this bites people.

The alternative considered here: **register one namespace global, `globalThis.Rip`, holding every framework export as a property.** Untyped scripts call `Rip.createResource ...`, `Rip.delay 100`, `Rip.launch hash: true`. Typed scripts use the imports proposed in RFC 2. The browser compiler's import-rewriting pass (also from RFC 2) targets `globalThis.Rip` instead of bare globals. Sixteen top-level names collapse to one.

### Proposal

Three pieces:

1. **Build script change.** In `scripts/build.js:78`, replace the spread loop
   ```js
   for (const [k, v] of Object.entries(__appExports)) if (typeof v === 'function') globalThis[k] = v;
   ```
   with
   ```js
   globalThis.Rip = __appExports;
   ```
   so the bundle exposes a single namespace object instead of eleven loose names.

2. **Update RFC 2's import-rewrite target.** When the browser compiler sees `import { createResource } from '@rip-lang/app'`, it rewrites to `const { createResource } = globalThis.Rip` instead of `const { createResource } = globalThis`. Same machinery, different target object.

3. **Update existing call sites.** A repo-wide grep for direct uses of any of the sixteen exports in real app code (excluding `packages/app/index.rip` itself, the `export stash::` keyword, and false positives like local variables named `delay`/`raw` and `Symbol.for("stash")`) currently returns one line:
   - [docs/example/index.html](docs/example/index.html#L29) — `launch hash: true, ...` → `Rip.launch hash: true, ...`

   The `export stash::` declaration in [examples/cart/app/stash.rip](examples/cart/app/stash.rip#L14) is the **language keyword**, not a call to the `stash()` global, and is unaffected. So the user-code migration cost in this repo today is exactly one line.

**Pros:**
- Eliminates the entire class of "silently shadowed framework helper" bugs. `Rip.delay` can't be shadowed by a local `delay`.
- Provenance is obvious at every call site. `Rip.createResource` reads as "the framework's `createResource`" with no ambient knowledge required.
- Pollutes `globalThis` with one well-known name instead of sixteen generically-named ones. Users keep `delay`, `hold`, `raw`, `stash`, `launch` as freely usable identifiers.
- Reads well alongside `@app.data...` reactivity. The two main namespaces a Rip app interacts with become `Rip` (framework) and `@app` (app instance).
- Forward-compatible with RFC 2. The import-rewrite target is the only thing that changes; the type-resolution path is unaffected.
- The migration window is now. A grep across `apps/`, `examples/`, and `docs/` finds one real call site — the cost is trivial today and grows linearly with adoption.

**Cons:**
- Untyped scripts gain one prefix token per call (`createResource` → `Rip.createResource`). The framework's tightest "no ceremony" promise loses one token of brevity.
- A breaking change for any external app that already uses bare names. The two in-repo call sites are easy; out-of-repo apps would need a one-time find-and-replace.
- The name `Rip` is now globally claimed. If a user wanted to define their own `Rip` for some reason, they can't.

### Alternatives considered

- **Status quo.** Keep eleven bare globals. Lowest ceremony, highest collision risk. Defended by the "untyped scripts shouldn't need any prefix" position; weakened by the fact that very few apps in the repo actually call these helpers, so the ceremony cost is mostly hypothetical.

- **One namespace plus auto-prepend for bare names.** Bundle exposes `Rip.*`, but the compiler also recognizes a known list of helper names in source and rewrites `createResource ...` to `Rip.createResource ...` automatically. Preserves the bare-name ergonomics on top of the namespace. Rejected because it brings back the "well-known names list" magic that RFC 2 explicitly rejected on the type-checker side — moving the same magic into the compiler isn't a real improvement.

- **Rename the worst offenders only.** Keep eleven globals but rename `delay` → `ripDelay`, `hold` → `ripHold`, `raw` → `ripRaw`, etc. Cheap fix for the collision risk. Rejected because it's an ugly half-measure that doesn't address provenance and leaves the global namespace just as crowded.

- **Imports for everyone, no globals at all.** Every Rip script — typed or untyped — uses `import { createResource } from '@rip-lang/app'`. Maximally consistent, maximally discoverable. Rejected because it kills the script-tag use case the framework exists to support: a user writing a one-HTML-file demo would have to add an import block to every `<script type="text/rip">`.

### Relationship to RFC 2

RFC 2 and RFC 3 are independent and can land in either order:

- **RFC 2 alone:** typed apps work via imports; untyped apps still see sixteen bare globals. Shadowing footgun unchanged.
- **RFC 3 alone:** sixteen bare globals collapse into `Rip.*`; typed apps still get TS2304 on `Rip.createResource` (no types).
- **Both:** typed apps import from `@rip-lang/app`; untyped apps call `Rip.*`; the import-rewrite target in step 3 of RFC 2 is `globalThis.Rip` instead of `globalThis`. Cleanest end state.

If both ship, RFC 3's only effect on RFC 2 is changing the rewrite target — a one-line difference in the import-rewriting pass.


## RFC 4: should the compiler track property accesses on `for`-loop iteration variables?

While building this cart, the quantity input on each row exhibited two related symptoms that point at the same compiler limitation:

1. **Focus loss on every keystroke.** The original `updateQuantity` did `@items = @items.map (i) -> if i.id is product.id then { ...i, quantity } else i` — a React-style immutable replace. Each keystroke produced a new array of new object identities. The list reconciler tore down the row's `<tr>` (and its `<input>`) and rebuilt it with the new `item`. Symptom: typing one digit blurred the input.

2. **Mutation in place doesn't update the row.** Switching to `item.quantity = quantity` (the idiomatic Rip pattern: mutate the leaf, let signals do the rest) preserved focus but exposed a deeper problem — the displayed quantity and the per-row subtotal stopped updating. The cart total still updated correctly. The `+`/`−` buttons that mutate via the same path also failed to move the displayed quantity.

The compiled output explains both. The per-row block emitted by [src/components.js](../../src/components.js) for `for item in cart.items` looks like this (excerpt from `create_block_4`):

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

The reason is documented in [`AGENTS.md`](../../AGENTS.md):

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

**Deferred to RFC 4b — primitive destructuring.** `for {qty} in items` where `qty` is a number is genuinely a different problem. Once the value is destructured out it's no longer a proxy reference — `qty` is just a `Number`, and `qty * 2` reads from a snapshot. Making it reactive requires either rewriting reads of `qty` back to `item.qty` (a real source-rewrite pass with scoping concerns around shadowing and reassignment), abandoning JS destructuring entirely in favor of `let qty; ... item.qty` everywhere, or some getter-binding scheme that doesn't have a clean syntax. Each of those is a design decision worth its own RFC. Day-1 covers the three reference-preserving cases; primitive destructuring stays static for now (and the workaround — drop the destructuring, write `item.qty` — is local and obvious).

**Pros:**
- Closes the gap between "what users expect from fine-grained reactivity" and what the compiler actually delivers. The cart-row case (and every list-of-reactive-objects case) just works.
- Eliminates the one workaround that exists purely for compiler reasons rather than design reasons. "Extract a child component to make per-row updates reactive" stops being a recommendation; component extraction is once again only about composition and reuse.
- Strictly more reactivity, never less. The worst case for any existing code is one extra `__effect` per templated reactive-binding read, firing only when the matching signal changes. No existing code's *behavior* changes, just its update granularity.
- Cheaper than the current "rebuild the row" workaround. N per-row effects — each firing only when its row's signal changes — beats one reconcile that destroys and recreates the whole `<tr>`.
- Simpler mental model. AGENTS.md's tracking rule changes from "rooted at `this`" to "rooted at any reactive binding" — shorter, more general, easier to teach.
- Aliases and object-shaped destructuring work day one, so the rule users learn ("reads through a reactive binding are reactive") matches what they actually write. No "don't alias the iter var" caveat in the docs.

**Cons:**
- Real compiler change in a hot path (every `for` in every render). The detection is local — one tracked-names set lookup per member-access node — but it touches `hasReactiveDeps` and the `_loopVarStack` data structure, and needs test coverage for nested loops, shadowed names, and iteration over non-reactive sources.
- The rule "iter var is reactive when source is reactive" needs to be precise about what counts as "the source is reactive." `for x in cart.items` — yes (rooted at `ctx`). `for x in [1,2,3]` — no. `for x in someLocalArray` — depends on what `someLocalArray` is, which means the analysis must already exist for arbitrary expressions (it does, via `hasReactiveDeps`, but edge cases will surface).
- Tracked-name propagation through assignments and object destructuring is a small but real scope-aware analysis. Has to handle nested scopes (loops, blocks, function expressions), reassignment (`local = somethingElse` retracts the tracking), and the difference between object-shaped destructuring (proxy-preserving) and primitive destructuring (not). Not hard, but not zero.
- Primitive destructuring stays static, silently — `for {qty} in items` then `qty * 2` does not become reactive, and there's no warning. Has to be called out in the docs and ideally surfaced as a lint or compile-time hint when the destructured field is read into a tracked context.
- Iteration over a `~=` computed that returns a fresh array each time is a real edge case — the array is technically reactive (the computed re-runs), but per-element identity churn means the existing reconciler still fires on identity change and rebuilds the row. The new per-element effects would do nothing useful in that case. Not incorrect, just redundant.
- Two paths now exist for "update DOM when item changes": the existing reconciler (handles identity / order / length) and the new per-property effects (handle in-place mutation). They're complementary, not conflicting, but the interaction has to be tested — especially the case where both fire in the same flush.

### Alternatives considered

- **Status quo + child-component workaround.** Current state. Rejected as the long-term answer because it makes every list-of-reactive-objects template require a child component for compiler reasons, not design reasons. The workaround is fine when component extraction is wanted anyway; it's a tax when it isn't.

- **Runtime-only solution: have the proxy track reads inside any effect.** It already does — that's why `cart.totalPrice()` works. The issue is that the compiler never *creates* an effect around the per-row reads in the first place, so there's no effect for the runtime tracking to attach to. This isn't a runtime gap; it's a codegen gap. Shipping a "smarter proxy" doesn't fix the missing effect wrapper.

- **Even more aggressive variant: include primitive destructuring.** Tracks `for {name, qty} in items` → `qty * 2` by source-rewriting `qty` reads back to `item.qty`, or by abandoning JS destructuring at the codegen level. Strictly more correct, materially more work, and the right answer eventually. Deferred to RFC 4b because the design space (rewrite vs. binding-scheme vs. getter-shim) deserves its own discussion, and the day-1 workaround (drop the destructuring, write `item.qty`) is local and obvious.

- **Compiler hint: `for item in! items`** (or some new sigil) that explicitly opts into tracking. Rejected because making reactivity explicit per-loop is exactly the kind of ceremony Rip's whole reactivity model is designed to avoid. If `cart.items` is reactive, `for item in cart.items` should "just work" — no extra punctuation, no opt-in.

- **Document around it.** Add a prominent "use a child component for reactive list rows" note to the AGENTS guide and call it done. Rejected because every Rip developer hits this exact bug, and a docs note is a tax paid forever to avoid a one-time codegen change.

### Relationship to other RFCs

Independent of RFCs 1, 2, and 3. Those concern the type and packaging story; this concerns the runtime reactivity story. RFC 4 lands purely in `src/components.js` (codegen) and `AGENTS.md` (the tracking-rule docs).

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
- Primitive destructuring stays static (until 4b): `for {qty} in items` then `<td>= qty` — mutating `items[i].qty` does *not* update the cell; documented behavior.
- Nested loops over reactive sources — each loop's iter var tracks independently.
- Shadowed name (`for x in items` containing `for x in subitems`) — inner `x` shadows outer; both tracked correctly.
- Cart example fixture — the `+`/`−`/typed-quantity case from this README ends up green.

