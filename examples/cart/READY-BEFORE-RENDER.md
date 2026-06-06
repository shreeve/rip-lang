# Ready-before-render: async reactive state for rip

> Status: pre-RFC sketch. Frames the gap in rip's own reactivity model and the one primitive that fills it. About the *approach* and its mechanics, not a final API.

## The problem, in rip's own terms

rip makes state reactive — `:=` (state), `~=` (computed), `~>` (effect). But it has no reactive form for **server data that's guaranteed present before its screen renders.** So every fetched value is typed `T | null`, and that null radiates to every consumer. Two spots in the cart make it concrete:

1. **`app/routes/_layout.rip`** — `userName ~= if user then "#{user.firstName} #{user.lastName}" else ''`. The empty-string fallback silently merges *"not loaded yet"* with *"real user, no name,"* and the nav dropdown renders empty until the `/api/user` fetch resolves, then fills in.
2. **`app/routes/profile.rip`** — a `hydrated := false` flag plus a `~>` effect that copies `user` into `form` once it materializes — pure bookkeeping bridging the "not here, then it is" gap.

Those two are just the visible tip. Fetching inside components — what we do today — carries the same costs wherever it's used: every fetching route re-implements the same `loaded` / error / `try`-`catch` bookkeeping (`index.rip` and `orders.rip` both do), data refetches on every visit, and sharing a value across components means hand-parking it in `@app.data`.

And the null radiates: at scale the authed user is read by nav, profile, settings, checkout, permission checks — each gating with `if user` or threading `?.x ?? ''`, and `if user?.role is 'admin'` collapsing *"exists"* and *"admin"* into one test.

## The gap is one missing cell in the reactivity grid

| Form        | Meaning                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `x := v`    | reactive **state**                                                            |
| `x ~= expr` | reactive **computed**                                                         |
| `f = ~> …`  | reactive **effect**                                                           |
| *(missing)* | reactive state that is **async-sourced and guaranteed present before render** |

This isn't a routing subsystem or a cache — it's the async member of a family rip already has. Fill that cell and the two cart problems disappear.

## The approach

**Server data is ordinary rip reactive state, living in shared modules — the same fabric as the stash — and the one new primitive is a component declaring that a piece of it must be loaded before the component renders.** That declaration does two jobs: it makes the renderer load the value before the component renders, and the value it hands back is typed non-null.

Everything else — sharing, reading, writing, refetching — falls out of reactivity rip already has. Because server data lives in the same reactive fabric as everything else, there's no separate cache to subscribe to, no handle to address it, and no bridge to pull it into render: those exist elsewhere only to compensate for render models that aren't reactive.

```coffee
# app/data.rip — server state, built on rip's existing createResource
import { createResource } from '@rip-lang/app'
import { api } from './api-client.rip'
import { User } from './types.rip'

export currentUser = createResource -> User.parse(api.get!('user').json!())   # loads on first need, not at import (lazy by default)
```

`createResource` is an async reactive holder — a `:=` cell that knows how to (re)load itself, **not a promise**: it owns the in-flight load internally, but its value is a signal. The gate awaits that load once, then reads the now-present value. (It's a redesign of rip's existing-but-unused `createResource`, shaped for the gate — see *Why it's cheap*.)

```coffee
# app/routes/_layout.rip
import { currentUser } from '../data.rip'

export Layout = component
  user = need currentUser              # load before render → `user` is non-null
  cart ~= @app.data.cart               # client-only state stays in the stash, untouched
  userName ~= "#{user.firstName} #{user.lastName}"   # no `if user`, no pop-in
```

```coffee
# app/routes/profile.rip
import { currentUser } from '../data.rip'

export Profile = component
  user = need currentUser              # already loaded by the layout → instant; still non-null
  form := { ...user }                  # synchronous: the hydrated flag and ~> effect are gone
  # the submit (a write) is handled with the mutation primitive — see “The write side”
```

*(Syntax is illustrative — `need` is a placeholder name; `.set` is part of the redesigned `createResource`, covered below. The approach is what matters.)*

What this means in practice:

- **Sharing is just module imports.** Producer and every consumer share one imported reactive value (`currentUser`) — no ancestry, no prop-drilling, no registry, and a child route never imports the layout. The value *is* the handle.
- **Reading is reading.** `need currentUser` returns the resource's value, reactive and non-null; you use it like any other reactive value.
- **Writing is assigning.** `currentUser.set(...)` updates the shared value; every consumer re-renders. This is exactly what the cart does today with `@app.data.user = …`, just on a value that's also gated.
- **Refetching is re-running the value** (`currentUser.refetch()`) — it writes the same reactive cell, so consumers update in place, no remount.
- **Singletons cache themselves.** A module-level resource loads once per session and every later `need` reuses it, so revisiting a route built on singletons doesn't re-fetch. (Flip side: a singleton can go stale until something calls `.refetch()` — a freshness policy is the deferred part, below.)

## Does the syntax actually work? The mechanics

The non-obvious part is making `user` present *synchronously* at init (so `form := { ...user }` works) — without a magic static export. Tracing it:

**The chicken-and-egg.** The renderer constructs a component by running its body. So it *cannot* learn what a component needs by running the body — the body already consumes the value (`form := { ...user }` would read a not-yet-loaded value). The thing to load has to be known *before* construction.

**The resolution: compile-time hoisting.** rip is compiled, and the `component` macro already statically analyzes each body (it extracts state, computed, and `offer`/`accept` vars). So `need currentUser` is hoisted at compile time into a static need-set on the component — the author writes it inline, the compiler lifts it. Then at runtime:

1. The compiler emits e.g. `Profile.__needs = [currentUser]` (static, readable without constructing).
2. Before constructing the matched route + layout chain, the renderer awaits the **union** of their need-sets. Each resource is a module singleton, so it loads once and concurrent needs dedupe.
3. *Then* it constructs top-down. By init time every needed resource is present, so `need currentUser` returns it synchronously and non-null, and `form := { ...user }` is valid.

Two properties fall out of this:

- **No ancestry coupling.** Each component self-declares (via its own `need`) what it requires, so a value is loaded before that component whether you land on it directly or arrive through a parent. A shared resource needed by both layout and page is simply loaded once.
- **The one constraint:** `need`'s argument must be a statically-known resource (a literal imported identifier) for the compiler to hoist it. Parameterized resources (`need order(params.id)`) need the key derived from route params the renderer already has — feasible, but more involved, and deferred with the dynamic-keyspace work below.

And reactivity: `user = need currentUser` binds `user` as a reactive read of the resource's value, so a later `currentUser.set(...)` (or `.refetch()`) flows to every consumer in place — no remount.

### Forgetting a `need` can't cause a silent null

A nice consequence of static needs: omitting the gate is a **compile-time error**, not a runtime surprise. `need currentUser` is what introduces the `user` binding, so leaving it out makes any use of `user` an unknown identifier — caught at compile time. Reaching for the raw resource instead yields a `T | null` value that forces a null check. The only path to a runtime null is an explicit `!` assertion. Because each component hoists its *own* `need`, "loaded" and "read as loaded" can't drift apart.

## Why a gate, not pausing mid-render

rip can't pause a render partway through and resume it. But it *can* finish loading before a screen is constructed — `mountRoute` is already async (it awaits compile + import before constructing a component). The gate rides that existing seam: read the static need-set, await it, then construct. So rip reaches "non-null at first render" through a mechanism it already has, rather than a render-pausing one it doesn't.

## Why it's cheap to build

| Need                                                 | Already in rip                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A pre-mount async seam to run the gate in            | `mountRoute` already awaits `compileAndImport!` before `new Component`, with `gen`/`generation` stale-mount guards                              |
| Static analysis of component bodies                  | the `component` macro already extracts state / computed / `offer` / `accept` — hoisting `need` is the same kind of pass                         |
| Shared reactive values                               | the stash / module-level signals already are this                                                                                               |
| The read resource's core (value + race/abort + lazy) | reuse `createResource`'s reactive `data` / `loading` / `error`, its `generation` counter + `AbortController` race handling, and its `lazy` mode |

The runtime is mostly assembly, and the typing is cheap: `need` is a generic unwrap — `need<T>(Resource<T>): T` — so the non-null type falls out of ordinary inference, with soundness supplied by the runtime gate rather than by the type system proving the load ran. The one piece of genuinely new (but modest, and precedented) compiler work is the **hoisting pass** — statically lifting each `need` into the component's need-set, the same kind of body analysis the `component` macro already does for state / computed / `offer` / `accept`.

On the runtime side, the read resource is a **redesign** of `createResource`, not a retrofit: it exists today but is unused and was built speculatively, so we're free to shape it for the gate. Keep its proven race/abort core; design the surface the gate wants — a write-through **`.set`** (a mutation result updates the value with no refetch), a load-once **`ensure`** (serve if loaded, await if in-flight, else load — today's `refetch` always aborts and restarts), and lazy-by-default for module-level use. Nothing depends on the old export, so there's no migration.

## Preloading falls out for free

Because need-sets are static (hoisted at compile time) and route matching is pure, a route's data requirements are knowable *without rendering it*. So preloading is: on intent (hover / focus / viewport over a link), match the target URL, read the static need-sets of its route + layout chain, and trigger those resources' loads. On navigation the gate awaits those same module-singleton resources — already loaded or in-flight — so it's instant and dedupes against the preload (one in-flight load per resource, no double fetch). The only new surface is the intent trigger on anchors the router already enumerates (`onClick` / `shouldIgnoreAnchor`), with `debounce` / `throttle` from Timing.

## The write side: a mutation primitive

The gate handles reads; writes have the mirror problem. The cart's profile submit and place-order hand-roll a `status` flag + `try`/`catch` + manual application of the result — the write-side twin of the `loaded`/error bookkeeping reads suffer. A small **mutation** primitive (`createMutation`, the write-side sibling of `createResource`) removes it:

```coffee
# app/routes/profile.rip
import { createMutation } from '@rip-lang/app'
import { currentUser } from '../data.rip'
import { User } from '../types.rip'
import { api, parseApiError, ApiErrors } from '../api-client.rip'

export Profile = component
  user = need currentUser                # non-null, loaded before render
  form := { ...user }                    # editable copy — no hydrated flag, no effect
  errors:: ApiErrors := {}

  # created: wraps the PATCH; tracks its own pending/error; applies the result on success
  updateUser = createMutation (data) -> User.parse(api.patch!('user', { json: data }).json!())
    onSuccess: (u) -> currentUser.set(u)         # write-back to the read resource — nav updates, no refetch
    onError:   (e) -> errors = parseApiError(e)

  submit: (e) ->
    e.preventDefault()
    errors = {}
    updateUser(form)                             # used: invoke the mutation directly; pending/succeeded are reactive

  render
    form @submit: submit
      # …first name / last name / email / phone inputs bound to form…
      Button type: "submit", loading: updateUser.pending, "Update Profile"
      if errors.form then p.error errors.form
      if updateUser.succeeded then p.success "Profile updated!"
```

You invoke it directly with the payload — it *is* the action, so there's no `.mutate` method to call on it — and it exposes `pending` / `succeeded` / `error` reactively while running `onSuccess` / `onError`. Those are bare flags, matching `createResource`'s `.loading` / `.error` rather than `is`-prefixing them — and a write is `pending`, not `loading` (the read/write distinction other frameworks make too). Read and write meet at exactly one point: a mutation's `onSuccess` calls the read resource's `.set`, so a successful write updates every reader in place — no refetch. (Optimistic updates, deferred, layer in here too: `.set` eagerly, roll back in `onError`.)

Designing the two together is the point — `createResource` went unused precisely because it was built with no use case in mind. Here both primitives are shaped against the cart's real reads (user / products / orders) and writes (update user, place order).

## Deferred

- **By-id (keyed) caching and a freshness policy** — caching many entries fetched by id (`order(42)`) and keeping singletons from going stale. Since singletons already load once per session, this is a narrow, performance-only addition, not a correctness gap — and `createResource` is a clean seam for it (keyed caching is a memoized factory of them; freshness is a tweak to the gate; stale-while-revalidate is nearly free since the value is already reactive). None of it changes how components read or write data.
- **Reset on auth change** — server resources are disposable (`createResource` already has `.dispose()`) and separate from the stash; the only undecided part is the policy for *when* to reset, which waits on rip having an auth model.
- **Optimistic updates + rollback** — additive on top of write-back.

## Open for the RFC

- **The surface (a language-design call).** Two pieces, and they're not symmetric. The async *value* is a redesign of the existing-but-unused `createResource` (gate-shaped: `.set`, `ensure`, lazy-by-default; proven race/abort core kept), so the value side is essentially settled — and with no consumers today, no migration. The *gate* that reads it is the open question, and the reactivity grid doesn't decide it: the grid is all *creation* forms with no consumption operators (you read a `:=` / `~=` value just by naming it), whereas the gate is a new *consume-with-load-guarantee* operator the grid has no precedent for. So it's free to be a keyword or a sigil. The hard constraint either way: it must be **statically hoistable** — the compiler sees the dependency without running the body — which rules out overloading `!` (it's already the await operator) and any purely-dynamic form. The two live options:
  - **`need` keyword** — its call site announces that it gates render; clearest intent, keeps the sigil grid small.
  - **a dedicated sigil, e.g. `<~`** — terser, fits rip's reactive-operator family; risk is it reads like a plain unwrap and hides the gate.

  We lean `need` for intent-clarity, but it's a genuine values tradeoff (self-announcing vs. terse/grid-fit), not a right/wrong — the call is Steve's.
- **Parameterized gating** — `need order(params.id)`: deriving the key from route params before construction. Tied to the deferred keyed-cache work.
