# Rip — An Introduction

> A deep dive into the Rip language, its schema system, and the MedLabs reference application — plus an honest assessment of what's strong, what's risky, and what's worth watching.

---

## Table of Contents

1. [Rip — the big idea in one sentence](#1-rip--the-big-idea-in-one-sentence)
2. [Operators — the coherent sigil system](#2-operators--the-coherent-sigil-system)
3. [Reactivity — the `~` always family](#3-reactivity--the--always-family)
4. [Rip Schema — one keyword, three libraries](#4-rip-schema--one-keyword-three-libraries)
5. [MedLabs — architecture tour](#5-medlabs--architecture-tour)
6. [Risks and open questions](#6-risks-and-open-questions)
7. [Verdict](#7-verdict)

---

## 1. Rip — the big idea in one sentence

Rip is CoffeeScript's ergonomic syntax retargeted at ES2022, with **reactivity as language primitives** (`:=`, `~=`, `~>`, `<=>`) and **schemas as language primitives** (`schema :model`, `:shape`, `:enum`, `:mixin`, `:input`), delivered as a **zero-dependency, self-hosting compiler**.

The three commitments that make it distinctive:

| Commitment | What it buys | What it costs |
|---|---|---|
| Modern output (ES2022) | Native `class`, `?.`, `??`, modules — smaller codegen, no polyfill baggage | Bun-only runtime (WebCrypto, `Bun.spawn`, import-rewriting loader) |
| Reactivity in syntax | `count := 0`, `doubled ~= count * 2`, `~> log count` compile to `__state / __computed / __effect` runtime primitives the UI framework hooks for fine-grained DOM updates | Dependency tracking is compiler-recognized, not data-flow inferred — users must follow discipline (e.g. `theme = @app.data.theme` to get a reactive root) |
| Zero deps, self-hosting | `{ "dependencies": {} }`, `bun run parser` rebuilds the parser from source | Everything bespoke: JWT, source maps, parser generator (Solar), test runner, even the browser bundle |

**Pipeline** (deliberately small):

```
Source → Lexer → emitTypes → Parser → S-expressions → CodeEmitter → JavaScript
                 (types.js)          (arrays + .loc)                + source map
```

S-expressions are plain arrays with `.loc` metadata (`["=", "x", 42]`), not AST classes. That one choice is the main reason the compiler is so small — and it is a deliberate **maintainability tradeoff**: fewer static guarantees, harder to evolve, but compact and readable.

---

## 2. Operators — the coherent sigil system

Rip extends CoffeeScript with about a dozen new operators. The easy mistake is to look at them in isolation and call the accumulation "cognitive debt." The better frame is to see them as **a small set of orthogonal axes**.

### Assignment and function arrows — one grid, two axes

|          | value form | function form     |
|----------|-----------|-------------------|
| regular  | `x = 5`   | `f ->`            |
| bound    | —         | `f =>`            |
| state    | `x := 5`  | —                 |
| reactive | `x ~= …`  | `f ~>`            |

Two axes: **"value vs function"** (`=` vs `>`) × **"what modifier"** (none / bound / state / reactive).

The symbols compose:

- `=` — ordinary value binding
- `->` — ordinary function (call-site `this`)
- `=>` — bound function (lexical `this`) — the `=` inside the arrow is the "equals this" mnemonic
- `:=` — state binding (the `:` is the "gets state" marker)
- `~=` — reactive value: **always equals** the expression
- `~>` — reactive function: **always calls** on dependency change
- `<=>` — two-way bind (bidirectional data flow — a separate axis)
- `=!` — readonly const: "equals, dammit!"

Read as families, not atoms:

- `= / := / ~=` — "is 5" / "gets state 5" / "always gets computed"
- `-> / => / ~>` — "calls" / "this-bound calls" / "always calls"

`~` is consistently **"always"**. `~=` is the reactive variant of `=`; `~>` is the reactive variant of `->`. Once you see the grid, `~>` is not opaque — it is the most naturally named arrow in the family.

### Other operator families

| Family | Members | Theme |
|---|---|---|
| Existence / safety | `x?` · `x ?? y` · `a?.b` · `a?.[0]` · `a?.()` · `a?[0]` · `a?(x)` · `el?.prop = v` · `?!` (presence / Houdini) · `?? throw` | Nothing-safe access and guards |
| Dammit / await | `fetch! url` · `user.save!` · `User.find! 1` | One glyph: "call it and await" |
| Void / required | `def process!` (suppresses implicit return) · `name! string` (required field) · `email!#` (required + unique) | Same `!` glyph, context-disambiguated |
| Math | `//` floor div · `%%` true mod · `1 < x < 10` chained compare · `arr[-1]` negative index · `"-" * 40` string repeat | Math you can read |
| Regex | `str =~ /re/` with `_[1]` captures · `str[/re/, 1]` · `///...///` heregex | Pattern matching as an expression |
| Assignment sugar | `.=` method-assign (`x .= trim()`) · `?.=` optional-chain assign · `*>obj = {a:1}` merge-assign | "Mutate this thing" |
| Data literals | `:name` interned Symbol · `*{...}` real Map · `%w[foo bar]` word array · `{a.b: 1}` dotted keys · `$"..."` tagged template | Real runtime values, not just syntax |
| Flow | `or return err` · `?? throw err` · `loop` · `loop 5` · `for x as iter` · `for x as! async` · postfix `a if x else b` · `x ? a : b` | Guards and iteration |

A few pieces of language behavior bear calling out:

- **Dammit (`!`) is the idiomatic async marker.** `fetch! url` compiles to `await fetch(url)`; `user.save!` to `await user.save()`. Raw `await` is reserved for JS interop.
- **Binary existential `x ? y` was intentionally removed.** Forces `x ?? y` (nullish coalescing). The full ternary `x ? a : b` still works.
- **Implicit commas before trailing arrows.** `get '/x' ->` becomes `get('/x', ->)`. A classic "rescue what would be a syntax error" trick — elegant for DSL-style call sites like route handlers.
- **Implicit `it` parameter.** `users.filter -> it.active` — no need to name a throwaway variable.

### Honest tradeoffs

- **Density is real.** `!` means four different things depending on position; `:symbol` does double duty as symbol literal and as schema-kind selector. Individually fine; aggregated, the surface is non-trivial.
- **Denser is not automatically clearer** for newcomers. It *is* clearer for fluent users — the grid above is a teaching tool precisely because once you see it, you stop memorizing.
- **"Implicit commas" is parser magic.** It works well for the narrow DSL case it targets; it would be dangerous as a general pattern.

---

## 3. Reactivity — the `~` always family

Reactivity is the piece of Rip most often compared to React/Vue/Solid. The comparison is fair, but the framing should be:

| Concept | React | Vue | Solid | Rip |
|---|---|---|---|---|
| State | `useState()` | `ref()` | `createSignal()` | `x := 0` |
| Computed | `useMemo()` | `computed()` | `createMemo()` | `x ~= y * 2` |
| Effect | `useEffect()` | `watch()` | `createEffect()` | `~> body` |

Rip's forms are **not shorthand for a library API** — they are compiler-recognized syntax targeting a specific reactive runtime contract (`__state / __computed / __effect`). That distinction matters:

- The `~` "always" mnemonic is visible at the call site.
- Computed and effect are recognizable as the **reactive variants of `=` and `->`**, so users learn the family, not three unrelated names.
- Fine-grained DOM updates fall out of the runtime hooks; no diffing, no hook order, no dependency arrays.

### What's strong

- `:=` is immediately legible as "state."
- `~=` / `~>` **name the contract**: "this value is always up to date" / "this function always runs when dependencies change." That's better than `createMemo` / `createEffect`, which name the API verb but not the guarantee.
- The family relationship is teachable in one sentence: *"`~` means always — `~=` is always-equal, `~>` is always-call."*

### What still needs attention

The operator *names the contract* beautifully. The remaining work is making the *scope* of "always" obvious:

- **Which reads inside a `~>` / `~=` body are tracked?**
  Per the component framework rule: inside `render`, only expressions rooted at `this` (`@app.data...`, component members) are tracked. Shared-scope variables render once and never update.
- **Aliasing boundaries.** The canonical pattern is to write `theme = @app.data.theme` inside a component to create a reactive root; bare references to shared-scope state are static.
- **Debuggability.** Answering *"why didn't this always-call fire?"* needs tooling — a lint, a devtool panel, or at minimum very explicit docs.

The operator design is well-chosen. The gap is runtime-semantics documentation and tooling, not syntax.

---

## 4. Rip Schema — one keyword, three libraries

One `schema` keyword covers what usually takes three libraries: a validator (Zod-style), an ORM (Prisma/ActiveRecord-style), and a migration tool. Five kinds, selected by a `:symbol`:

| Kind | Role |
|---|---|
| `:input` (default) | Field validator |
| `:shape` | Validator + methods + computed getters (e.g. `Money`, `Address`) |
| `:enum` | Closed symbol set; `.parse()` accepts name or value |
| `:mixin` | Reusable field bundle with diamond-dedup and cycle detection |
| `:model` | DB-backed — async ORM (`find/where/create/save/destroy`), DDL emission (`toSQL`), 10 Rails lifecycle hooks, `@belongs_to / @has_many / @has_one` relations |

### Body is a declarative sub-DSL

Six line forms, all declarative:

1. **Fields** — `name! type, min..max` (type optional, defaults to `string`)
2. **Inline field transforms** — `name!, -> fn(it)` (comma-terminal; runs on `.parse()` only)
3. **Directives** — `@timestamps`, `@mixin Name`, `@belongs_to User?`
4. **Methods** — `name: -> body`
5. **Computed getters** — `name: ~> body` (lazy; re-runs on every access)
6. **Eager-derived fields** — `name: !> body` (materialized once at parse/hydrate, stored as own property)

Plus the cross-field refinement directive:

- **`@ensure "msg", (u) -> predicate`** — schema-level invariants, one per line or grouped as `@ensure [...]` with `msg, fn` pairs

Field modifiers: `!` required, `#` unique, `?` optional. Type slot is optional; omitting it means `string`. Constraints self-identify: `n..m` for ranges, `[value]` for defaults, `/regex/` for patterns, `{key: val}` for attrs. String-literal unions (`"M" | "F" | "U"`) substitute for small enum sets in the type slot.

```coffee
# Validator with a cross-field refinement
SignupInput = schema
  email!     email
  password!  8..100
  password2! 8..100

  @ensure "passwords must match", (u) -> u.password is u.password2

# Shape — validator with behavior
Address = schema :shape
  street! string
  city!   string
  full: ~> "#{@street}, #{@city}"

# Enumeration
Status = schema
  :pending 0
  :active  1
  :done    2

# DB-backed model
User = schema :model
  name!   string
  email!# email
  role?   "admin" | "user"
  @timestamps
  @has_many Order
  beforeValidation: -> @email = @email.toLowerCase()
```

### The three-method runtime API

Every instantiable schema exposes the same trio, with async `!` variants:

- `.parse(data)` — returns cleaned value; throws `SchemaError` with structured `.issues`
- `.safe(data)` — returns `{ok, value, errors}`; never throws
- `.ok(data)` — boolean fast path; allocates no error arrays

### Where `:model` converges

A single declaration gives you:

- A validator (the `.parse/.safe/.ok` trio)
- A class: fields as enumerable own properties, methods/getters on the prototype
- A chainable async query builder: `User.where(active: true).order("last_name").all!`
- Migration DDL: `User.toSQL()` — works standalone, never touches the DB
- `@belongs_to` / `@has_many` accessors that resolve cross-module through a process-global registry
- Full shadow TypeScript with `ModelSchema<Instance, Data>` typing that propagates through schema algebra

Hydrated instances carry **both snake_case and camelCase aliases** on DB-derived columns (`order.user_id === order.userId`), so raw-SQL helpers and ORM access coexist cleanly.

### Architecture highlights

- **Single-function adapter.** `adapter.query(sql, params)` is the entire DB interface. Tests use in-memory mocks; production uses `rip-db`; the ORM doesn't care.
- **Schema algebra** — `.pick`, `.omit`, `.partial`, `.required`, `.extend` — always returns a `:shape` and **drops behavior**. `User.omit "password"` won't have `.find()` or the `beforeSave` hook. Enforced at runtime *and* at the TypeScript level.
- **Four-layer lazy runtime**: raw descriptor → normalized metadata → validator plan → ORM/DDL plan. Migration scripts never build the ORM plan; validator-only consumers never build the class machinery.
- **~54% sidecar** (`packages/schema/src/schema.js`), with **<100 lines of core compiler wiring**.

### Where it wins — and where it doesn't

Wins (genuinely):

- One source of truth — validator, domain class, DDL all derive from the same declaration.
- No drift between Zod input type and Prisma model type.
- Consistent `parse / safe / ok` contract across every shape, input, and model in your app.
- Lifecycle hooks and relations are tied to the same metadata model as validation.

Loses (honestly):

- **Couples domains that often evolve independently.** API input shape is not always a DB row; domain aggregate is not always a table. The `:input` / `:shape` / `:model` split mitigates this, but users will still try to push edge cases into it.
- **Schema algebra dropping to `:shape` is correct but surprising** — users will expect model-ness to survive. Very documentation-sensitive.
- **Process-global relation registry is a real architectural smell.** It creates real issues for test isolation, hot reload, multi-tenant runtimes in one process, plugin load order, circular init, and leak on re-registration. Needs to at minimum be namespace-scoped, idempotent, and resettable.
- **Single-function adapter is too thin once you need transactions.** `query(sql, params)` can't express `begin / commit / rollback`, savepoints, streaming results, connection-scoped settings, advisory locks, or capability introspection. MedLabs already wants transactions, so this interface will grow.

**Frame:** Rip Schema is a strong *coherence* play. It wins when validation and persistence models are intentionally close; it loses when you need backend-specific features or independent evolution of API / domain / storage schemas. *More Rails than Lego.*

---

## 5. MedLabs — architecture tour

**MedLabs** is a clinical lab-order portal for Labcorp test ordering, multi-tenant, SPA, built on the full Rip stack.

### Layout

```
index.rip              Server entry — site resolution, middleware, SPA shell fallback
config.rip             Env-derived app / DB / OAuth / Labcorp / Postmark config
api/
  db.rip               Adapter config + raw sql / rows / row helpers
  models.rip           8 :model schemas (User, Patient, Provider, Account, Test,
                       Partner, Order, OrderItem) + 4 enums + createOrderWithItems
  lib/                 auth, labcorp, orders, email, migrate, stash, npi
  routes/              auth, user, patients, tests, orders, labcorp
  migrations/          Timestamped SQL (YYYYMMDDHHMMSS-*.sql)
  scripts/             labcorp-token refresh, smoke test (in-memory adapter)
app/
  index.html           data-state, data-mount=App, data-src="ui app"
  shell.rip            SECTIONS registry, URL sync, session, App + AppShell
  sections/            home, order-entry, orders, patients, test-catalog, settings
  components/          auth-screen, onboarding, patient-search, test-panel, ...
sites/
  common/ ola/         Per-tenant config + tailwind + public assets
```

### Nine design choices worth pointing out

1. **Multi-tenancy via hostname → site bundle with deep-merge cascade.** `EXACT_HOSTS` / `SUFFIX_HOSTS` in `index.rip` map host → site id; `loadSiteBundle` deep-merges `sites/common/config.rip` with `sites/{site}/config.rip` (same for `tailwind.rip`). Bundle cached per site. Config is serialized as `data-state` on the bootstrap script tag and becomes `@app.data` reactively in components.

2. **Stash = deep-path proxy over config.** Both `config.labcorp.api.patientUrl` and `config.get 'labcorp.api.patientUrl'` work. One `Proxy` with regex-based path detection handles both shapes.

3. **DB bootstrap is delightfully aggressive.** `setup!` pings `http://localhost:4213/sql`, spawns `rip-db <file>` detached if absent, polls 10× 200ms, runs migrations. First-run UX is `bun apps/medlabs/index.rip` and nothing else. Great for dev; operationally weird for prod (worker races on start, orphan processes, unclear readiness).

4. **Dual-auth API pattern.** `apiScope!` accepts either a Bearer partner token (validated against `partners.token` with regex `/^\d{8}-.{16}-(.+)$/`) *or* a session cookie. Returns `{mode: 'api' | 'session', partner | user}`. Partner path also updates `last_used_at`.

5. **Labcorp token refresh loop.** Tokens live in a `labcorp_tokens` table, refreshed every 11h by `api/scripts/labcorp-token.rip` (cron), cached per-worker with a refresh buffer. JWT verify for Apple + Google is hand-rolled RSA-PKCS via `crypto.subtle` with JWK caching.

6. **Order submission is a staged state machine with a `step` tracer.**
   ```
   patient → provider → account → validate → requisition → payload → submit
   ```
   Each step name lives in a `step` variable; `error!` throws `"Order failed at #{step}: …"` on trip. If the local DB insert fails *after* Labcorp accepts the order, the response returns a `dbError` field — **Labcorp is authoritative**, local DB reconciles.

7. **`createOrderWithItems` factory.** Pre-computes `totalPrice = Σ items.price` because the FK forbids inserting `order_items` before the Order exists, so this can't be a `beforeSave` hook. Called from both `/v1/orders/create` (web) and `/v1/labcorp/orders` (partner API) to enforce the invariant at both entry points.

8. **SPA chassis in `shell.rip`.** `SECTIONS` registers every screen with `{label, public?, icon?}`. `goTo(key)` is the router — pushes history, redirects unauth'd users to `/auth` while preserving intent via `pendingRedirect`. `refreshSession` on mount transitions `boot → ready | error`. Stash reactivity requires a component-local binding (`theme = @app.data.theme`) because only `this`-rooted expressions are tracked in `render`.

9. **`test-panel.rip` is the reactivity showcase.** Clipboard-aware paste of 6-digit test codes → matching tests into cart, keyboard nav (↑↓ / Enter / Shift+Enter / Esc), reactive cart sort (`sortedCart ~=` switches on `cartSort` / `cartSortReverse`) — everything using `:=` signals and `~=` computed over `@app.data.cart`. A good concrete demonstration of the `~` family in anger.

---

## 6. Risks and open questions

### MedLabs — healthcare correctness

| # | Risk | Severity | Fix direction |
|---|---|---|---|
| 1 | `orders.raw_request` / `raw_response` store upstream Labcorp payloads as TEXT — contains PHI (name, DOB, address, tests) and probably tokens in headers | **High** | Redact before persist, encrypt column, retention policy, explicit data classification |
| 2 | No idempotency key on order submission — retries will duplicate at Labcorp; local / remote state can diverge permanently with only a log-and-return-`dbError` recovery | **High** | Persist a pending submission record keyed by client-supplied idempotency token *before* the Labcorp call; unique constraint on `labcorp_order_id`; reconciliation worker |
| 3 | `upsertPatient` is where-then-save-or-create with a fallback catch — race on concurrent Labcorp submissions for the same patient | Medium | DB-native `INSERT … ON CONFLICT`; use `labcorp_id` unique constraint |
| 4 | No transactions in order creation — the 7-step flow has observable partial failures | Medium | Wrap the local write in a txn even if the Labcorp call stays outside |
| 5 | Hand-rolled JWT verify (Apple + Google) — "correct but risky" until externally reviewed (alg confusion, `nbf` / `exp` / `iat`, JWK cache invalidation, clock skew) | Medium | Write test vectors against the JOSE spec; consider a vetted micro-lib (violates zero-dep — tradeoff call) |
| 6 | Partner tokens stored plaintext for lookup (`WHERE token = $1`) | Medium | Prefix-lookup + hashed secret compare, display-once issuance |
| 7 | `x-site-override` header / `?__site` param is gated on `NODE_ENV !== 'production'` but relies on a single env var — classic footgun if staging mis-sets it | Low-Med | Whitelist hostnames that can override; deny-by-default; audit log |
| 8 | DuckDB auto-spawn pattern in a multi-worker server — worker race at boot | Low (dev-only risk) | Externalize DB process in prod; a lockfile or explicit "only worker 0 starts it" check |

### Rip / Schema — architectural

- **Process-global schema registry.** Scope it, make it resettable, define load-order guarantees.
- **Adapter interface needs transactions.** `begin / commit / rollback` or a `withTransaction(fn)` variant.
- **Reactive tracking semantics need explicit docs + a lint.** What's tracked, when aliasing breaks tracking, how to ask *"why didn't this re-run?"*
- **Shadow TS drift.** The `.d.ts` emitted from `type` / `interface` and the runtime schema shape need conformance tests; if they diverge silently, IDE reality and runtime reality split.

### SPA chassis — most likely failure mode under real traffic

Not "traffic" in the server sense. In the client, the most likely failure mode is **auth / navigation / bootstrap race causing incorrect screen state**:

- Hit private route with stale session → brief flash to target, auth, back.
- `pendingRedirect` overwritten or lost across async session-refresh completions.
- Browser back after expired session lands on an invalid intermediate state.
- `refreshSession` resolving after a route change and stomping the current section.
- Two concurrent refreshes producing inconsistent UI.

**Fix direction:** model auth / boot / route as an explicit state machine; make route transitions serial and cancellable; centralize `pendingRedirect` logic; test back / forward with slow network and expired session.

A close second is **non-reactive reads due to aliasing / stash access patterns** causing stale UI — the `theme = @app.data.theme` discipline must be lintable.

---

## 7. Verdict

**Strongest positive:** Rip Schema is the most differentiated piece of the whole stack. The four-layer lazy runtime + single-adapter contract + schema-algebra-drops-to-`:shape` design is genuinely novel. MedLabs' `models.rip` (182 lines) replaces what would be ~3 files and ~2 dependencies in a Node/TS app. The reactivity family (`:= / ~= / ~>`) isn't sigil soup — it's a teachable grid where `~` means *"always"* across value and function forms, making the contract visible at the call site in a way `createMemo` / `createEffect` can't.

**Strongest negative:** the system is **coherence-heavy and therefore fragile at integration boundaries**. When everything is designed together — compiler, runtime, schema, server, UI framework — it composes beautifully. When one boundary meets the messy world (Labcorp partial failures, DuckDB process lifecycle, hand-rolled JWT, PHI retention), the lack of battle-tested external primitives shows.

**Rip itself:** better for fluent users, and genuinely teachable once the grids are visible. The operator set *is* dense, but it isn't incoherent — `~` / `!` / `?` each mean something specific and consistent. The aggregate is a fairly opinionated language, not "small JS with better syntax."

**MedLabs specifically:** the biggest risk is **not code style or architecture — it's distributed consistency and PHI handling**. The app is productive and readable; it just needs to grow up on idempotency, transactions, and raw-payload hygiene before it carries real clinical traffic.

---

## Appendix — the teachable one-pagers

### The assignment × function grid

|          | value form | function form     | meaning of the modifier   |
|----------|-----------|-------------------|---------------------------|
| regular  | `x = 5`   | `f = -> …`        | the boring default        |
| bound    | —         | `f = => …`        | lexical `this`            |
| state    | `x := 5`  | —                 | observable state container|
| reactive | `x ~= …`  | `f = ~> …`        | `~` = **always**          |

### The `!` family

| Form | Meaning |
|---|---|
| `fetch!` | dammit — call + await |
| `def fn!` | void — suppress implicit return |
| `name! string` | required field (in `schema` body) |
| `email!#` | required + unique (in `schema :model` body) |
| `MAX =! 100` | readonly const |

### The `?` family

| Form | Meaning |
|---|---|
| `x?` | existence (`x != null`) |
| `x ?? y` | nullish coalescing |
| `a?.b` / `a?.[0]` / `a?.()` | optional chain |
| `a?[0]` / `a?(x)` | optional chain shorthand |
| `el?.prop = v` | optional chain assignment |
| `@checked?!` | presence (Houdini — truthy or `undefined`) |
| `x ?? throw err` | nullish guard |

### The schema declaration grid

| Line form | Example |
|---|---|
| Field (type implicit string) | `name! 1..50` |
| Field + modifiers | `email!# email` (required + unique) |
| Field + range | `password! 8..100` |
| Field + literal union | `sex? "M" \| "F" \| "U"` |
| Inline field transform | `email!, -> it.email.toLowerCase()` |
| Directive | `@timestamps`, `@has_many Order`, `@mixin Address` |
| Method | `toPublic: -> {id: @id, email: @email}` |
| Computed getter (lazy) | `fullName: ~> "#{@firstName} #{@lastName}"` |
| Eager-derived field | `slug: !> @name.toLowerCase()` |
| Cross-field refinement | `@ensure "passwords match", (u) -> u.password is u.password2` |

The body is data, not code — and that's what makes the whole thing compile into a validator, a class, a query builder, DDL, and TypeScript types at once.
