# Proposed: Explicit Prop Optionality with `?::` (RFC)

**Status:** Pending discussion — not yet implemented. Documenting the design for review.

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

These should be removed from the spec. They are documented but effectively non-functional in the contexts users reach for. The relevant rewrite logic lives in `expandSuffixes()` in `src/dts.js` (called from 18 sites), but the lexer strips trailing `?` and `!` from identifier-position tokens before they reach DTS emission — so `x:: string? = …` declares `let x: string;` and `x:: string?? = …` produces the malformed `let y: string ??;`. Even inside parameter parens the suffixes typically parse as the `?`/`!` operators rather than type modifiers. They add no value beyond syntactic sugar for things already expressible with unions (`string | undefined`, `string | null | undefined`) and built-in utility types (`NonNullable<T>`). Removing them simplifies the `?` story: `?` only ever means "optional" (on a prop name or structural type property), never "value may be undefined."

**Breaking change impact:**

- **262 typed prop lines** (`@prop:: type := val`) across the repo would need `?` added → `@prop?:: type := val`
- **91 untyped prop lines** (`@prop := val`) — completely unaffected
- Concentrated in `packages/ui/browser/components/` (~177) and `packages/ui/email/` (~71); the rest scattered
- Mechanical fix: single regex find-and-replace across the repo

**Implementation notes:**

- The lexer's predicate handler (`src/lexer.js` lines 664-668) already strips `?` from identifiers and sets `data.predicate = true`
- This flag survives through the parser to s-expressions via `new String(val)` + `Object.assign` in the parser adapter (`src/compiler.js` lines 4072-4075; mirrored in `src/schema/schema.js` line 1643)
- `data.predicate` is already consumed in 8 places: `src/types.js` (lines 489, 494), `src/components.js` (lines 578, 580), `src/dts.js` (line 359), and `src/schema/schema.js` (lines 544, 1473, 1677). Optionality should reuse this same flag on the prop name.
- Remove the suffix branches from `expandSuffixes()` in `src/dts.js` (the `::` → `:` substitution stays — it's load-bearing); also strip the now-unused suffix expansions and update the 18 call sites accordingly
- Remove the Optionality Modifiers section from `docs/RIP-TYPES.md` and the corresponding sigil table entries (`?`, `??`, `!`)
- Rename `data.predicate` → `data.optional` across lexer/compiler/types/schema — the current name is a CoffeeScript holdover for "predicate methods" (`empty?` → `isEmpty`); the comments at `src/lexer.js` lines 27, 523, 665 still describe that convention, but no `isEmpty` rewrite exists anywhere in the compiler. The flag is only used for existence checks and optionality.
