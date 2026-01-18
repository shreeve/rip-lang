# Rip Reactivity System

Rip implements a **fine-grained reactive system** that rivals and often exceeds the capabilities of major frameworks like Vue, Svelte, Solid, and React — in just ~200 lines of runtime code.

## The Three Primitives

Rip's entire reactivity model is built on three foundational concepts:

| Primitive | Syntax | Mnemonic | Purpose |
|-----------|--------|----------|---------|
| **state** | `x := 0` | "holds state" | Mutable reactive value |
| **computed** | `y ~= x * 2` | "always equals" | Computed value (auto-updates) |
| **effect** | `effect -> ...` | — | Side effect (runs on changes) |

These three primitives provide **complete reactive power** — everything React, Vue, Svelte, and Solid can do with state management, Rip can do too.

---

## Quick Example

```rip
count := 0                      # state
doubled ~= count * 2            # computed

effect ->                       # effect
  console.log "Count: #{count}, Doubled: #{doubled}"

increment: ->
  count += 1

increment()  # Logs: "Count: 1, Doubled: 2"
increment()  # Logs: "Count: 2, Doubled: 4"
```

---

## How It Works

### State (`:=`)

State creates a **reactive container** that tracks its readers and notifies them on change.

```rip
count := 0        # Create reactive state
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

### Computed (`~=`)

Computed creates a **computed value** that automatically updates when dependencies change.

```rip
count := 0
doubled ~= count * 2    # "doubled is always count * 2"
```

**Key features:**
- **Lazy** — only computes when read
- **Cached** — won't recompute unless dependencies change
- **Chainable** — computeds can depend on other computeds

### Effect

Effects run **side effects** that automatically re-run when dependencies change.

```rip
effect ->
  document.title = "Count: #{count}"
```

**Key features:**
- **Auto-tracking** — no manual dependency arrays (unlike React!)
- **Immediate** — runs once immediately to establish dependencies
- **Disposable** — returns cleanup function

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

### Effect

| Feature | Rip | Vue | Svelte | React |
|---------|:---:|:---:|:------:|:-----:|
| Auto-tracking | ✅ | ✅ | ✅ | ❌ |
| No manual deps array | ✅ | ✅ | ✅ | ❌ |
| Runs immediately | ✅ | ✅ | ✅ | ✅ |
| Returns cleanup | ✅ | ✅ | ✅ | ✅ |
| Re-runs on change | ✅ | ✅ | ✅ | ✅ |

**Rip advantage over React:** No manual dependency arrays! React's `useEffect` requires you to list dependencies — Rip tracks them automatically.

```javascript
// React - manual, error-prone
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);  // 😩 Must list deps manually

// Rip - automatic
effect ->
  document.title = "Count: #{count}"  // 🎉 Deps tracked automatically
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
┌─────────────┐     reads      ┌─────────────┐
│   STATE     │◄──────────────│   EFFECT    │
│   count     │               │   (side fx) │
└──────┬──────┘               └─────────────┘
       │                             ▲
       │ notifies                    │ triggers
       ▼                             │
┌─────────────┐     reads      ┌─────┴───────┐
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

✅ **Three simple primitives** — state, computed, effect
✅ **Auto-tracking** — no manual dependency arrays
✅ **Lazy computed** — only calculates when needed
✅ **Fine-grained** — surgical updates to subscribers
✅ **Tiny runtime** — ~200 lines, ~4 KB
✅ **Extra utilities** — `.lock()`, `.read()`, `.kill()` that others lack

**On par with Vue/Solid. Better than React. A fraction of the size.**
