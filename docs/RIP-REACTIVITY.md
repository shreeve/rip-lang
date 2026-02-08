# Rip Reactivity System

Rip implements a **fine-grained reactive system** that rivals and often exceeds the capabilities of major frameworks like Vue, Svelte, Solid, and React — in just ~200 lines of runtime code.

## The Reactive Triad

Rip's entire reactivity model is built on three foundational concepts:

| Primitive | Description | Read As | Role | Purpose |
|-----------|-------------|---------|------|---------|
| `:=` | state | "has state" | **Source** | Where reactive data originates |
| `~=` | computed | "always equals" | **Derivation** | Computed values (lazy, cached) |
| `~>` | effect | "reacts to" | **Reaction** | Side effects when data changes |

These three primitives are the **minimal complete set** for reactive programming — everything React, Vue, Svelte, and Solid can do with state management, Rip can do too.

---

## Why These Three Are Complete

Every reactive system reduces to these three concepts:

| Framework | Source | Derivation | Reaction |
|-----------|--------|------------|----------|
| **Rip** | `:=` | `~=` | `~>` |
| Angular | `signal()` | `computed()` | `effect()` |
| Imba | `@property` | implicit | implicit |
| MobX | `observable` | `computed` | `autorun` |
| Next.js | `useState` | `useMemo` | `useEffect` |
| React | `useState` | `useMemo` | `useEffect` |
| Solid | `createSignal` | `createMemo` | `createEffect` |
| Svelte 4 | `let x` | `$: x` | `$: {}` |
| Svelte 5 | `$state` | `$derived` | `$effect` |
| Vue | `ref()` | `computed()` | `watch()` |

### What You Can Build From These Three

- **Stores** → objects with state properties
- **Two-way binding** → state + effect that syncs
- **Async resources** → state + effect that fetches
- **Event handling** → update state → triggers reactions
- **Derived stores** → computed from other state

### What's Missing Without Any One

- **Without `:=`** → No source of truth
- **Without `~=`** → Manual tracking or inefficient effects
- **Without `~>`** → Can't react to changes (no side effects)

---

## Quick Example

```coffee
count := 0                      # count has state 0
doubled ~= count * 2            # doubled always equals count * 2
logger ~> console.log count     # reacts to count changes
~> console.log count            # same thing, but the "fire and forget" version

increment: -> count += 1

increment()  # Logs: 1
increment()  # Logs: 2
```

---

## How It Works

### State (`:=`) — "has state"

State creates a **reactive container** that tracks its readers and notifies them on change.

```coffee
count := 0        # count has state 0
count += 1        # Update triggers dependents
```

**Compiles to:**
```javascript
const count = __state(0);
count.value += 1;
```

**What happens internally:**
1. Reading `count.value` inside an effect/computed **tracks** the dependency
2. Writing to `count.value` **notifies** all subscribers
3. Effects re-run, computeds mark dirty

### Computed (`~=`) — "always equals"

Computed creates a **computed value** that automatically updates when dependencies change.

```coffee
count := 0
doubled ~= count * 2    # doubled always equals count * 2
```

**Key features:**
- **Lazy** — only computes when read
- **Cached** — won't recompute unless dependencies change
- **Chainable** — computeds can depend on other computeds

### Effect (`~>`) — "reacts to"

The effect operator runs **side effects** when dependencies change. Dependencies are auto-tracked from reactive values read in the body.

```coffee
~> document.title = "Count: #{count}"
```

**Key features:**
- **Auto-tracking** — dependencies detected automatically from body
- **Immediate** — runs once immediately to establish dependencies
- **Controllable** — optionally assign to a variable to control the effect

**Syntax:**
```coffee
# Fire and forget (no assignment)
~> console.log count

# Controllable (assign to variable)
logger ~> console.log count
logger.stop!     # Pause reactions
logger.run!      # Resume reactions
logger.cancel!   # Permanent disposal
```

---

## Comparison with Major Frameworks

### State

| Feature | Rip | Vue | Solid | React |
|---------|:---:|:---:|:-----:|:-----:|
| Auto-tracking on read | ✅ | ✅ | ✅ | ❌ |
| Same-value skip | ✅ | ✅ | ✅ | ✅ |
| Re-entry protection | ✅ | ❌ | ❌ | ❌ |
| Lock for SSR | ✅ | ❌ | ❌ | ❌ |
| Cleanup/disposal | ✅ | ✅ | ✅ | ❌ |
| Raw read (untracked) | ✅ | ✅ | ✅ | ❌ |
| Primitive coercion | ✅ | ❌ | ❌ | N/A |

**Rip advantage:** `.lock()`, `.kill()`, `.read()` utilities that others lack.

### Computed

| Feature | Rip | Vue | Solid | MobX |
|---------|:---:|:---:|:-----:|:----:|
| Lazy evaluation | ✅ | ✅ | ✅ | ✅ |
| Cached until deps change | ✅ | ✅ | ✅ | ✅ |
| Dirty propagation | ✅ | ✅ | ✅ | ✅ |
| Auto dependency cleanup | ✅ | ✅ | ✅ | ✅ |
| Chainable | ✅ | ✅ | ✅ | ✅ |
| Read without tracking | ✅ | ❌ | ❌ | ❌ |
| Lock (freeze value) | ✅ | ❌ | ❌ | ❌ |

**Rip advantage:** `.read()` for untracked access, `.lock()` to freeze.

### Effect (`~>`)

| Feature | Rip | Vue | Svelte | React |
|---------|:---:|:---:|:------:|:-----:|
| Auto-tracking | ✅ | ✅ | ✅ | ❌ |
| No manual deps array | ✅ | ✅ | ✅ | ❌ |
| Runs immediately | ✅ | ✅ | ✅ | ✅ |
| Controllable (stop/run) | ✅ | ✅ | ✅ | ❌ |
| Re-runs on change | ✅ | ✅ | ✅ | ✅ |

**Rip advantage over React:** No manual dependency arrays!

```javascript
// React - manual, error-prone
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);  // 😩 Must list deps manually

// Rip - automatic
~> document.title = "Count: #{count}"  // 🎉 Deps tracked automatically
```

### Bundle Size

| Framework | Runtime Size |
|-----------|-------------|
| React | ~40 KB (minified) |
| Vue | ~34 KB |
| Svelte | ~2 KB (but grows with app size) |
| **Rip** | **~4 KB** (full runtime) |

---

## Advanced Features

### Batching

Group multiple updates into a single flush:

```javascript
__batch(() => {
  count.value = 1;
  name.value = "Alice";
  // Effects run once at the end, not twice
});
```

### Untracked Reads

Read a value without creating a dependency:

```javascript
const currentValue = count.read();  // No tracking
```

### Locking (SSR/Hydration)

Prevent writes during server-side rendering or freeze values:

```javascript
count.lock();  // Now immutable
```

### Cleanup

Dispose of reactive values:

```javascript
const finalValue = count.kill();  // Returns value, clears subscribers
```

---

## The Architecture

```
┌─────────────┐     reads     ┌─────────────┐
│   STATE     │◄──────────────│   EFFECT    │
│   count     │               │   (side fx) │
└──────┬──────┘               └─────────────┘
       │                             ▲
       │ notifies                    │ triggers
       ▼                             │
┌─────────────┐     reads     ┌──────┴──────┐
│  COMPUTED   │◄──────────────│   EFFECT    │
│  doubled    │               │   (logger)  │
└─────────────┘               └─────────────┘
```

1. **State** is the source of truth
2. **Computed** derives from state (lazy, cached)
3. **Effects** react to state/computed changes
4. **Changes propagate** through the dependency graph

---

## Why Fine-Grained Reactivity?

Rip uses **fine-grained reactivity** (like Vue/Solid), not Virtual DOM diffing (like React).

| Approach | How it works | Pros | Cons |
|----------|--------------|------|------|
| **VDOM** (React) | Re-render tree, diff, patch | Simple mental model | Overhead, requires optimization |
| **Fine-grained** (Rip) | Track dependencies, update directly | Surgical updates, fast | More complex internally |

### Result

- **No VDOM overhead** — changes propagate directly to subscribers
- **Surgical updates** — only the exact things that changed update
- **No `useMemo`/`useCallback` dance** — caching is automatic
- **Smaller bundles** — no diffing algorithm needed

---

## Summary

Rip's reactivity system:

✅ **The Reactive Triad** — state (`:=`), computed (`~=`), effect (`~>`) <br>
✅ **Natural reading** — "has state", "always equals", "reacts to" <br>
✅ **Minimal complete set** — same model as Vue, Solid, MobX <br>
✅ **Lazy computed** — only calculates when needed <br>
✅ **Fine-grained** — surgical updates to subscribers <br>
✅ **Controllable effects** — `.stop!`, `.run!`, `.cancel!` when needed <br>
✅ **Tiny runtime** — ~200 lines, ~4 KB <br>
✅ **Extra utilities** — `.lock()`, `.read()`, `.kill()` that others lack <br>

**On par with Vue/Solid. Better than React. A fraction of the size.**

---

## Types and Reactivity

Reactive operators work with Rip's optional type system:

```coffee
count:: number := 0               # Typed state
doubled:: number ~= count * 2     # Typed computed
```

Type annotations are erased from `.js` output. In `.d.ts` output, reactive
state emits `Signal<T>` and computed values emit `Computed<T>`:

```ts
declare const count: Signal<number>;
declare const doubled: Computed<number>;
```

See [RIP-TYPES.md](RIP-TYPES.md) for the complete type system specification.
