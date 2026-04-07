# Proposed: Explicit Prop Optionality with `?::` (RFC)

**Status:** Pending discussion — not yet implemented. Documenting the design for review.

**Problem:** Today, optionality is determined solely by whether a prop has a default value (`:=`). There is no way to declare an optional prop with no default value. The supposed workaround `@label := null` doesn't actually work in a strict project — `rip check` reports TS2322 because `null` is not assignable to the declared type. The only workaround that type-checks is `@label:: string | undefined := undefined`, but it's absurdly redundant — it spells out exactly what `@label?:: string` should mean. (`| null` is semantically wrong here; TypeScript's `?` adds `undefined` to the union, not `null`. `null` means "explicitly set to nothing," while `undefined` means "not provided" — optional props are the latter.)

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

These should be removed from the spec entirely. They were never implemented — `expandSuffixes()` in `types.js` contains the code but it's dead because the lexer strips `?` and `!` before the type system sees them. They add no value beyond syntactic sugar for things already expressible with unions (`string | undefined`, `string | null | undefined`) and built-in utility types (`NonNullable<T>`). Removing them simplifies the `?` story: `?` only ever means "optional" (on a prop name or structural type property), never "value may be undefined."

**Breaking change impact:**

- **453 typed prop lines** (`@prop:: type := val`) across the repo would need `?` added → `@prop?:: type := val`
- **114 untyped prop lines** (`@prop := val`) — completely unaffected
- Concentrated in `packages/ui/browser/components/` (~170), `docs/ui/` (~170), `packages/ui/email/` (~70)
- Mechanical fix: single regex find-and-replace across the repo

**Implementation notes:**

- The lexer's predicate handler (lexer.js:573-576) already strips `?` from identifiers and sets `data.predicate = true`
- This flag survives through the parser to s-expressions via `new String(val)` + `Object.assign` in the parser adapter
- `types.js` (`emitTypes`) and `components.js` (shadow stub) both need to check `.predicate` on the prop name to set optionality
- Remove `expandSuffixes()` from `types.js` (dead code for `T?`, `T??`, `T!`)
- Remove the Optionality Modifiers section from `docs/RIP-TYPES.md` and the corresponding sigil table entries (`?`, `??`, `!`)
- Rename `data.predicate` → `data.optional` across lexer/compiler/types — the current name is a CoffeeScript holdover for "predicate methods" (`empty?` → `isEmpty`), a convention that was never implemented in Rip; the flag is only used for existence checks and optionality
