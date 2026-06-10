# Ready-before-render: async reactive state for rip

> Status: pre-RFC. Recommends an approach — server data lives in the stash as `source` keys, gated by an explicit `<~` binding at the read site — and traces why the alternatives considered fall short. Spellings are working names; the architecture is the proposal.

## The problem, in rip's own terms

rip makes state reactive — `:=` (state), `~=` (computed), `~>` (effect). But it has no reactive form for **server data that's guaranteed present before its screen renders.** So every fetched value is typed `T | null`, and that null radiates to every consumer. Two spots in the cart make it concrete:

1. **`app/routes/_layout.rip`** — `userName ~= if user then "#{user.firstName} #{user.lastName}" else ''`. The empty-string fallback silently merges *"not loaded yet"* with *"real user, no name,"* and the nav dropdown renders empty until the `/api/user` fetch resolves, then fills in.
2. **`app/routes/profile.rip`** — a `hydrated := false` flag plus a `~>` effect that copies `user` into `form` once it materializes — pure bookkeeping bridging the "not here, then it is" gap.

Those two are just the visible tip. Fetching inside components — what we do today — carries the same costs wherever it's used: every fetching route re-implements the same `loaded` / error / `try`-`catch` bookkeeping (`index.rip` and `orders.rip` both do), data refetches on every visit, and sharing a value across components means hand-parking it in `@app.data`.

And the null radiates: at scale the authed user is read by nav, profile, settings, checkout, permission checks — each gating with `if user` or threading `?.x ?? ''`, and `if user?.role is 'admin'` collapsing *"exists"* and *"admin"* into one test.

## The gap is one missing cell in the reactivity grid

| Form        | Meaning                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------ |
| `x := v`    | reactive **state**                                                                         |
| `x ~= expr` | reactive **computed**                                                                      |
| `f = ~> …`  | reactive **effect**                                                                        |
| `x <~ src`  | reactive state that is **async-sourced and guaranteed present before render** *(proposed)* |

This isn't a routing subsystem or a cache — it's the async member of a family rip already has. Fill that cell and the two cart problems disappear.

## The approach

**Server data lives in the stash — the same reactive store as all other app state — as `source` keys that know how to load themselves. The one new read-site primitive is a component declaring that a key must be loaded before the component renders (the `<~` binding).** That declaration does two jobs: it makes the renderer load the value before constructing the component, and the value it binds is typed non-null.

```coffee
# app/stash.rip — one store; server keys know how to load
import { source } from '@rip-lang/app'
import { api } from './api-client.rip'
import { User } from './types.rip'

export stash =
  cart: { items: [], total: 0 }                                     # plain client state
  user: source { fetch: -> User.parse(api.get!('user').json!()) }   # server-backed
```

A `source` is an async reactive holder — a stash key that knows how to (re)load itself, **not a promise**: it owns the in-flight load internally, but its value is part of the stash's reactive fabric like any other key. It's lazy by default: it loads on first touch — a gated binding or a plain read — not at startup. (It's a redesign of rip's existing-but-unused `createResource`, embedded as a stash key — see *Why it's cheap*.)

`fetch` is deliberately the only *action* a `source` declares. The tempting addition is its mirror — a `push:` for write-back — and it's excluded for a structural reason, not just because auto-push is deferred: **reads are per-key, writes are per-action.** A key has exactly one canonical way to load (`orders` comes from `GET /orders`), but the writes that change it aren't edits of the key: placing an order is a POST that appends to `orders` *and* empties `cart` — one action, two keys, neither of them "pushed." (The seeming counter-example — `user`, with a single `PATCH /user` that could pass as a push key — is the special case where action and key happen to align one-to-one, and even it wants mutation semantics: a draft, validation errors, a pending flag. Tie the push to the key and the next requirement — say, change-email-with-confirmation — breaks the alignment.) So loading is declared on the *key* (`source`) and writing on the *action* (`createMutation` — see *The write side*), and they meet at exactly one point: a successful mutation assigns the key(s) it affects. What the declaration *will* grow is per-key read-side **policy** — each deferred feature lands here as an option, not new architecture (the list is in *Deferred*) — and with those, `app/stash.rip` becomes the app's data manifest: one file declaring what loads, what persists, and what gates.

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
- **Writing is assigning.** `@app.data.user = u` writes through to the source's value; every consumer re-renders. This is exactly what the cart does today, on a value that's also gated.
- **Refetching is re-running the key** — it writes the same reactive value, so consumers update in place, no remount.
- **Signing out is one reset, not N writes.** `app.reset()` restores plain keys to their declared defaults (the stash literal *is* the default-state declaration), unloads every source (aborting in-flight loads), and purges persisted snapshots — the next gates refetch as the new principal. Assignment can't do this job: `@app.data.user = null` writes a *loaded* null that a gate would happily serve, and leaves in-flight fetches, persisted copies, and every other key untouched. One call is possible only because all state lives in one store; *when* to call it is the app's signout flow — auth stays app-level.
- **Sources cache themselves.** A source loads once per session and every later gate reuses it, so revisiting a route doesn't re-fetch. (Flip side: it can go stale until something refetches — the freshness policy is deferred, below.)
- **Serialization is one projection over one store** — fully or partially, the app's call (its own section below).

## Why an explicit gate?

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

Ungated reads are a *feature*, not a failure mode: an ungated read of a `source` kicks off its load without blocking anything, types as `T | null`, and the null branch *is* the skeleton branch — progressive rendering with no extra machinery. The gated binding then marks exactly the subset of reads the author declares render-critical: *this screen is wrong without it*. Automatic gating cannot express this page — any read of a source key would gate, so the whole route waits on stats nobody has scrolled to.

In short: *which keys are server-backed* is a fact the framework knows; *which reads should block render* is a decision only the author can make. The gate mark is the one token that carries it.

**Inference doesn't remove the marker — it flips its default.** To be clear: inferring the gate is buildable. `app/stash.rip` is a fixed convention (`launch()` auto-loads it in every app, typed or untyped; the checker already builds `__RipStash` from it), extracting the source-key set is a small build step, and the idiomatic read is a top-of-body `user ~= @app.data.user` — as statically visible as any binding. The argument against inference isn't mechanical. It's that the dashboard above forces *every* design to have a read-site marker: under inference, progressive rendering needs an inverted one ("read without gating"). So the two designs differ only in **which side is unmarked** — and unmarked code should do the harmless thing. With the explicit gate, an unmarked read fails soft: the screen renders, the value is `T | null`, and treating it as loaded is a compile error. Under inference, an unmarked read silently joins the route's **gate union** — and since the slowest source sets time-to-first-paint, every new source read anywhere in the chain adds latency to the whole screen without anyone having decided that. Render-blocking is the global, consequential behavior; it should be the opt-in, visible, greppable one. `<~` makes a component's gate budget readable off the page, and one binding per render-critical key is the whole price.

## Does it actually work? The mechanics

The non-obvious parts: making `user` present *synchronously* at init (so `form := { ...user }` works), making the gate knowable before construction, and making the types true. Tracing each:

**The chicken-and-egg.** The renderer constructs a component by running its body. So it *cannot* learn what a component needs by running the body — the body already consumes the value (`form := { ...user }` would read a not-yet-loaded value). The thing to load has to be known *before* construction.

**The resolution: compile-time hoisting of the path.** rip is compiled, and the `component` macro already statically analyzes each body (it extracts state, computed, and `offer`/`accept` vars). So `user <~ @app.data.user` is hoisted at compile time into a static need-set on the component — the hoisted thing is the **path string** (`'user'`), not a module identifier. Then at runtime:

1. The compiler emits e.g. `Profile.__needs = ['user']` (static, readable without constructing).
2. Before constructing the matched route + layout chain, the renderer takes the **union** of their need-sets and resolves each path against the stash: a `source` cell gets awaited via load-once **`ensure`** (serve if loaded, await if in-flight, else fetch); a path that doesn't resolve to a `source` is a dev-time error (see *`<~` requires a source*, below). Concurrent needs dedupe — one in-flight load per source.
3. *Then* it constructs top-down. By init time every needed key is present, so the `<~` binding resolves synchronously and non-null, and `form := { ...user }` is valid.

Because the need-set is **path strings resolved at runtime**, the `component` macro needs no cross-module knowledge — it never has to know whether `user` is a `source` or a plain key. It's local, single-file analysis, the same kind of pass the macro already does. (This is the detail that lets one store and a cheap gate coexist; the alternatives below each lose one or the other.)

Two properties fall out of this:

- **No ancestry coupling.** Each component self-declares (via its own `<~` bindings) what it requires, so a key is loaded before that component whether you land on it directly or arrive through a parent. A key needed by both layout and page is simply loaded once.
- **The one constraint:** the binding's right-hand side must be a statically-known path (a literal `@app.data.…` access) for the compiler to hoist it — and the binding form enforces this by grammar: a top-of-body declaration can't be conditional or embedded in an expression. Parameterized sources (an order looked up by `params.id`) need keys derived from route params the renderer already has — feasible, but more involved, and deferred with the keyed-cache work below.

And reactivity: `user <~ @app.data.user` binds `user` as a reactive read of the key, so a later write (`@app.data.user = u`, or a refetch) flows to every consumer in place — no remount.

### The types are honest — and already plumbed

Two existing pieces carry the whole story:

*The stash is already statically typed.* The project's `app/stash.rip` declares (or infers) its shape, and the type checker threads it everywhere with no ceremony: it appends `export type __RipStash = typeof stash` to the stash module, then rewrites each component's `app` stub to `declare app: { data: __RipStash; … }`. `@app.data.user` resolves to its declared type in every component — today, no new plumbing.

*`source` rides that pipeline.* Declare `source<T>(opts:: { fetch: () => Promise<T> }):: T | null` — the runtime returns a tagged cell (the stash proxy unwraps reads to its current value; writes route into it), but the type says `T | null`. Then `typeof stash` infers `{ cart: …, user: User | null }` with **no annotation at all**, and the pipeline carries it to every read site. The `<~` binding is the generic narrow — `(value:: T | null) => T` at the bind site — with soundness supplied by the runtime gate rather than by the type system proving the load ran.

*And none of it requires a typed project.* `launch()` auto-loads `app/stash.rip` in every app (untyped ones can even skip the file and seed via `data-state`), and the gate, hoist, source loading, and mount-time source check are all runtime mechanisms that never consult the checker. An untyped app gives up only the diagnostics tier — a forgotten gate is a runtime null instead of a `T | null` compile error, the same tradeoff untyped code makes everywhere else: *still correct, less guarded*, not broken.

### Forgetting the gate can't cause a silent null

Omitting the gate isn't a runtime surprise. An ungated read is `User | null`, which the checker forces you to null-check — exactly today's situation, no worse. The gated binding is the only thing typed `T`, and it's precisely the read the gate guarantees. The only path to a runtime null is an explicit `!` assertion. Because each component hoists its *own* gates, "loaded" and "read as loaded" can't drift apart.

### `<~` requires a source — binding a plain key is an error

The mirror question: what if a component writes `cart <~ @app.data.cart` on a plain client key? Two cases, and the second decides the rule. On a non-nullable key (`cart: Cart`) the gate would be a harmless no-op — but it dilutes the mark: every `<~` should mean "this render waits on a load," or the dashboard stops being readable as a time-to-first-paint budget. On a *nullable* plain key (`selectedItem: Item | null`) it would be unsound: the narrow claims `Item`, but there is no load for the gate to await — nothing ever makes the key non-null — so the binding would manufacture exactly the silent null this design exists to eliminate. So the binding requires a `source`: the renderer rejects a non-source path at mount with a dev-time error (deterministic — every mount of that component hits it, so it can't slip past development), and the type layer can front-run the diagnostic by branding `source`'s return type so `<~` only accepts source-typed keys (best-effort: unlike inferred gating's read detection, nothing load-bearing depends on it).

The rule also makes key migrations self-guiding: plain → `source` flips every ungated reader to a `T | null` type error (each component then chooses gate or skeleton); `source` → plain surfaces every stale `<~` as the mount error. Neither direction can silently change behavior.

## Why a gate, not pausing mid-render

rip can't pause a render partway through and resume it. But it *can* finish loading before a screen is constructed — `mountRoute` is already async (it awaits compile + import before constructing a component). The gate rides that existing seam: read the static need-set, await it, then construct. So rip reaches "non-null at first render" through a mechanism it already has, rather than a render-pausing one it doesn't.

## Why it's cheap to build

| Need                                               | Already in rip                                                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A pre-mount async seam to run the gate in          | `mountRoute` already awaits `compileAndImport!` before `new Component`, with `gen`/`generation` stale-mount guards                              |
| Static analysis of component bodies                | the `component` macro already extracts state / computed / `offer` / `accept` — hoisting `<~` paths is the same kind of pass                     |
| One shared reactive store                          | the stash already is this — fine-grained per-key signals on a deep proxy, write-through assignment                                              |
| Typed reads in every component                     | the `__RipStash` pipeline already threads `typeof stash` into `@app.data`                                                                       |
| The source cell's core (value + race/abort + lazy) | reuse `createResource`'s reactive `data` / `loading` / `error`, its `generation` counter + `AbortController` race handling, and its `lazy` mode |

The runtime is mostly assembly. The one piece of genuinely new (but modest, and precedented) compiler work is the **hoisting pass** — statically lifting each `<~` path into the component's need-set, the same kind of body analysis the `component` macro already does.

On the runtime side, `source` is a **redesign** of the existing-but-unused `createResource`, embedded as a stash key: keep its proven race/abort core; shape the surface the gate wants — load-once **`ensure`** (today's `refetch` always aborts and restarts), write-through assignment (a mutation result updates the value with no refetch), **`reset`** (back to *unloaded*: clear the value, abort any in-flight fetch, purge the persisted snapshot — distinct from assigning null, which writes a loaded value), and lazy-by-default. The stash proxy learns one trick: a read of a source cell unwraps to its current value, a write routes into it. Nothing depends on the old `createResource` export, so there's no migration.

Preloading falls out for free, too: need-sets are static and route matching is pure, so on link intent (hover / focus / viewport) the router can match the target URL, union its chain's need-sets, and trigger those loads — navigation then awaits cells already loaded or in-flight (one in-flight load per source, no double fetch). The only new surface is the intent trigger on anchors the router already enumerates.

## The write side: a mutation primitive

The gate handles reads; writes have the mirror problem. The cart's profile submit and place-order hand-roll a `status` flag + `try`/`catch` + manual application of the result — the write-side twin of the `loaded`/error bookkeeping reads suffer. A small **mutation** primitive (`createMutation`) removes it:

```coffee
# app/routes/profile.rip
export Profile = component
  user <~ @app.data.user                 # non-null, loaded before render
  form := { ...user }                    # editable draft — no hydrated flag, no effect
  errors:: ApiErrors := {}

  updateUser = createMutation (data) -> User.parse(api.patch!('user', { json: data }).json!())
    onSuccess: (u) -> @app.data.user = u         # write-back into the stash key — nav updates, no refetch
    onError:   (e) -> errors = parseApiError(e)

  submit: (e) -> e.preventDefault(); errors = {}; updateUser(form)   # invoke directly — pending/succeeded/error are reactive
  # render: inputs bind to `form`; the submit Button reads updateUser.pending; banners read succeeded/errors
```

You invoke it directly with the payload — it *is* the action, so there's no `.mutate` method to call on it — and it exposes `pending` / `succeeded` / `error` reactively while running `onSuccess` / `onError`. Those are bare flags, matching the source's `loading` / `error` rather than `is`-prefixing them — and a write is `pending`, not `loading` (the read/write distinction other frameworks make too). Read and write meet at exactly one point: a mutation's `onSuccess` assigns the stash key, so a successful write updates every reader in place — no refetch. (Optimistic updates, deferred, layer in here too: assign eagerly, roll back in `onError`.)

The shape keeps exactly what the real form needs: a **draft** (edit `form`, not the live shared `user`, so the nav doesn't change mid-edit), a **discardable** edit (navigate away and the stash is untouched), and an **explicit commit** that can surface a validation `422` without rolling anything back. Place-order is the same shape — `createMutation` wrapping the POST — because it's an action, not a field write, and there's no `@app.data.X` whose assignment means "place order."

## Serialization: one store, one projection

The goal behind a single store is that app state can be **fully or partially serialized, however makes sense for the app** — the cart should survive a reload; the user should be refetched. Because client *and* server state live in the one stash, that's a *projection over one store* rather than a gathering exercise — but it needs one piece of design rather than inheritance: the raw stash holds source *cells* (fetch + signal machinery), not values, so a naive `JSON.stringify(unwrapStash(app.data))` — exactly what today's `persistStash` does — would serialize the wrappers. Restore is worse: `persistStash` merges saved JSON back over `app.data`, which would replace a source cell with its dead snapshot — the key silently stops being a `source`, and every gate on it then fails the mount check. Both halves need the projection.

Saving therefore walks the stash and either snapshots or skips each source key. Skipping is the simplest correct default — server keys are refetchable, so **persist plain keys, let the gate refetch source keys** on restore (persisting snapshots for instant paint is an upgrade that lands with the deferred freshness policy). Partial serialization needs nothing special: every stash subtree unwraps to a clean plain object, so the app picks the paths and projects those.

## Alternatives considered

Each of these was traced seriously against the same cart problems. Each fails on an axis the recommended shape doesn't.

**1. The status quo: fetch inside components.** Today's cart, fully traced in the opening section. It ships, but the costs are per-screen and permanent: every new fetching route re-pays the bookkeeping tax, and the nulls keep radiating.

**2. Module resources + explicit `need` (the previous draft of this proposal).** Server values live as module singletons (`export currentUser = createResource …`); components gate with `need currentUser`. Mechanically clean — the hoisted thing is an imported identifier, everything is local — and its mechanics survive wholesale in the recommended shape (the gate, the hoist, `ensure`, the mutation write-back). What kills it is *where the state lives*:

- **Two state worlds.** Client state in the stash, server state scattered across modules — the client/server split returns as code layout, and every cross-cutting concern (serialization, reset-on-auth, future sync) must span both worlds.
- **Serialization gathers.** "Save the app state" means collecting from N modules instead of projecting one store — directly against the serialization goal.
- **Not the on-ramp.** Whatever the freshness story grows into (see *The domain and the local-first question*), it grows on one store; module singletons would have to migrate into the stash anyway.

**3. The fully-automatic stash: plain reads as gates.** The most seductive surface — `user ~= @app.data.user`, no operator at all; the framework infers the gate from the read of a `source` key. It's buildable; *Why an explicit gate?* (above) traces why it's still the wrong default: progressive rendering forces an inverted "don't gate" marker anyway, so the designs differ only in which side is unmarked — and inference puts render-blocking, the consequential behavior, on the unmarked side, where every new source read silently joins the gate union. The explicit binding makes blocking opt-in and readable off the page, and a forgotten gate is a `T | null` compile error instead of invisible added latency.

**4. Auto-push / local-first now.** The seductive next step past reads: bind a form input straight to the live server key (`input value <=> @app.data.user.firstName`) and let the stash push on change. Traced against the real profile form: the nav also reads `@app.data.user`, so the username **changes on every keystroke** (no draft); navigating away can't **discard** (you've already mutated and pushed the shared value); and a validation `422` means **rolling the stash back** — optimistic + rollback stops being opt-in and becomes mandatory. Actions break it entirely: placing an order is a POST that returns a new order — there's no field whose assignment means "place order." And auto-push is only sound atop a durable mutation queue, delta sync, and automatic revert — sync machinery this proposal defers (see *The domain and the local-first question*). Auto-push remains a plausible later **opt-in** for the autosave niche — low-stakes keys (a toggle, "mark read") with no draft or validation — layered on once a freshness/rollback policy is designed.

## The domain and the local-first question

rip's primary domain is medical apps like medlabs. The serious challenger to this proposal's request/response model is **local-first** — replicate the org's data client-side, render from the replica, sync deltas (Linear is the best-known proof). It's a genuine option here, not a strawman: org-scoped data is bounded, IndexedDB holds gigabytes, and offline resilience has real value in clinical settings. This proposal doesn't rule it out — it argues local-first is a *separate, later* decision, for two reasons:

- **It's a standalone commitment with its own risk profile, deserving its own RFC.** Beyond the build (client replica, durable mutation queue, server change feeds with per-row permission filtering), it's an ownership commitment — stateful sync infra, distributed-bug debugging, replica schema migrations — and it puts PHI on every device that logs in: browser storage is plaintext on disk, clinics run shared workstations, breach safe-harbor turns on encryption at rest the browser doesn't provide, and replicating an org's whole panel to each staffer's profile strains *minimum necessary*. None of that is prohibitive; all of it is a different design space than ready-before-render.
- **This proposal is the common prefix of both futures.** Gate + refetch is correct today and survives a later local-first verdict either way: the stash is the store a replica would hydrate, `source` cells are where sync would attach, the gate becomes the hydration wait (even Linear gates lazily — heavy tables hydrate on demand), and `createMutation` is the slot a durable queue would fill. Deciding local-first now would delay fixing the actual problems — null-flicker and bookkeeping — without changing what gets built first.

Near-term, the growth path is **liveness**: gate + refetch today; per-key freshness (refetch on focus / navigate) next; `subscribe:` on genuinely-live keys (incoming results) after that — server-resident data, a session-scoped working set, nothing persisted unless a key opts in. The domain's bias throughout: *fresh or visibly loading*, which is what the gate already gives.

## Deferred

- **By-id (keyed) caching and a freshness policy** — caching entries fetched by id (`order(42)`) and keeping sources from going stale. Sources already load once per session, so this is performance work, not a correctness gap — and the `source` cell is its seam (keyed caching is a memoized factory of cells; the growth path — liveness first — is in *The domain and the local-first question*). None of it changes how components read or write data.
- **Optimistic updates + rollback** — additive on top of write-back.
- **Per-key `source` options** — where the above land on the declaration: `initial:` (pre-load value), `eager:` (launch-time load for truly-global keys), freshness knobs (`ttl:`, stale-while-revalidate), `persist:` (the snapshot opt-in from *Serialization* — rare in this domain), eventually `subscribe:` (live updates for genuinely-live keys).

## Open for the RFC

These are surface questions *within* the recommended architecture:

- **The gate's spelling (a language-design call).** We lean **`x <~ <stash-path>`** — a binding operator, sibling of `:=` and `~=` — over a keyword:
  - *Completes the reactivity grid* — the fourth creation form (`:=` state, `~=` computed, `~>` effect, `<~` async-sourced-and-present), not a consumption operator bolted on.
  - *Reads where rip readers already look* — the state-vs-computed distinction already lives in two characters at the bind site, and `<=>` established arrow-sigils in the family.
  - *Makes hoistability grammatical* — a keyword is an expression, so "top-of-body only, literal path only" becomes a rule the compiler must enforce with its own errors; a binding form *is* that restriction — there's nowhere else it can appear.

  Every keyword candidate mis-describes the semantics (`need` — ungated reads are needed too; `ready` scans as a predicate; `wait` collides with `!` await; `load` implies refetch; `gate` is jargon), and a word that almost-fits invites confident misreading where a sigil's opacity invites lookup. Nothing self-documents "blocks render until loaded" — that's a docs job either way. A keyword stays the fallback; a `@app.data.` shorthand is worth considering.
- **Surfacing a source's `loading` / `error` through the stash.** The cell carries both (inherited from `createResource`), but the skeleton pattern only consumes the null/value distinction — `if orders then list else skeleton` can't tell *still loading* from *failed*. Components need an addressable form of a source's error (and possibly loading) state — a meta-accessor on the read path, a companion key, or a stash method — and the choice interacts with both the proxy design and the typing. (The gate's own failure mode is the same question at the route level: what renders when a `<~` load *rejects*.)
