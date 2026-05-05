# Cart Demo

A minimal shopping cart built with Rip App to exercise reactive components, file-based routing, and stash-based shared state.

## Running

```bash
cd examples/cart
rip server
```

## RFC: how should Rip packages expose types to typed Rip apps that consume them?

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
