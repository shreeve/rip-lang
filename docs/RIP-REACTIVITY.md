<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Reactivity

Rip implements a **fine-grained reactive system** built on three primitives.

Everything else — timing, resources, stores, bindings — composes from them.

The runtime is ~200 lines. The model is complete.

---

## The Reactive Triad

| Primitive | Read As           | Role       | Purpose               |
| --------- | ----------------- | ---------- | --------------------- |
| `:=`      | **gets state**    | Source     | Mutable signal        |
| `~=`      | **always equals** | Derivation | Lazy computed value   |
| `~>`      | **always calls**  | Reaction   | Side effect on change |

These three operators form a **minimal complete reactive system**.

---

## The Model

Every reactive framework reduces to three concepts:

| Concept | Rip  | Vue             | Solid            | Svelte 5   | React         |
| ------- | ---- | --------------- | ---------------- | ---------- | ------------- |
| Source  | `:=` | `ref()`         | `createSignal()` | `$state`   | `useState()`  |
| Derived | `~=` | `computed()`    | `createMemo()`   | `$derived` | `useMemo()`   |
| Effect  | `~>` | `watchEffect()` | `createEffect()` | `$effect`  | `useEffect()` |

React needs 10+ hooks to approximate what Rip expresses with 3 operators.

---

## Quick Example

```coffee
count := 0                      # count gets state 0
doubled ~= count * 2            # doubled always equals count * 2
~> console.log count            # always calls when count changes
```

Compiles to:

```js
const count = __state(0);
const doubled = __computed(() => count.value * 2);
__effect(() => console.log(count.value));
```

---

## How It Works

### State (`:=`) — "gets state"

State creates a **reactive container** that tracks its readers and notifies them on change.

```coffee
count := 0        # count gets state 0
count += 1        # update triggers dependents
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

Computed creates a **derived value** that automatically updates when dependencies change.

```coffee
count := 0
doubled ~= count * 2    # doubled always equals count * 2
```

**Key features:**
- **Lazy** — only computes when read
- **Cached** — won't recompute unless dependencies change
- **Chainable** — computeds can depend on other computeds

### Effect (`~>`) — "always calls"

The effect operator runs **side effects** when dependencies change. Dependencies are auto-tracked from reactive values read in the body.

```coffee
~> document.title = "Count: #{count}"
```

**Key features:**
- **Auto-tracking** — dependencies detected automatically from body
- **Immediate** — runs once immediately to establish dependencies
- **Cleanup** — return a function to run before re-execution

---

## Effect Cleanup

Effects may return a cleanup function:

```coffee
~>
  id = setInterval tick, 1000
  -> clearInterval id
```

The returned function runs before re-execution and on disposal.

This enables higher-level reactive utilities like timing primitives — without adding anything to the language.

---

## Composition: Timing Without Framework Hooks

Unlike React's `useTransition` or Vue's flush modes, Rip does not add timing primitives to the framework.

They are composed from the triad.

### Delay

```coffee
showLoading := delay 200 -> loading
```

Read as: "delay 200ms, loading." Once `loading` is true for 200ms, `showLoading` becomes true. When `loading` goes false, `showLoading` goes false immediately. Handles rapid bouncing — only fires when the source is stable.

### Debounce

```coffee
debouncedQuery := debounce 300 -> query
```

Waits until the value stops changing for 300ms, then propagates. Classic search input pattern.

### Throttle

```coffee
smoothScroll := throttle 100 -> scrollY
```

Propagates at most once per 100ms. For scroll, resize, mousemove.

### Hold

```coffee
showSaved := hold 2000 -> saved
```

Once true, stays true for at least 2000ms. The "flash of success" pattern — no flickering badges.

### How They Work

All four are implemented using:

- `:=` — the output signal
- `~>` — watches the source, manages timers
- Effect cleanup — cancels pending timers on re-execution

No new compiler features. No new reactive operators. No scheduler.

This proves the triad is sufficient.

---

## Writable Timing Signals

Timing utilities can also wrap a source signal directly:

```coffee
navigating = delay 100, __state(false)
```

The returned object behaves like a signal:

- **Reads** return the delayed value
- **Writes** update the source immediately

One signal. Asymmetric behavior. No extra plumbing. Swap `__state(false)` for `delay 100, __state(false)` and nothing else changes — a drop-in replacement.

---

## What's Intentionally Not Built In

Rip does not include:

- Scheduler phases (pre/post DOM)
- Transition primitives
- Manual dependency arrays
- Explicit dependency lists

Because they are unnecessary when:

- Dependencies are auto-tracked
- Effects support cleanup
- Derived signals compose

### The One Gap: Untracked Reads in Effects

Most reactive frameworks (Solid, Vue, Angular, Preact) provide an `untrack()` function — read a signal without creating a dependency. Rip supports untracked reads via `.read()` on individual signals, but does not yet have a general `untrack()` wrapper for expressions. This matters for:

- Avoiding circular dependencies in complex effects
- Performance — reading without subscribing
- Explicit control: "re-run when A changes, but also read B without tracking it"

This is the one capability gap relative to Solid and Vue. Everything else composes from the triad.

---

## Fine-Grained Reactivity

Rip uses fine-grained dependency tracking (like Vue/Solid), not Virtual DOM diffing (like React).

| Approach | How it works | Pros | Cons |
|----------|--------------|------|------|
| **VDOM** (React) | Re-render tree, diff, patch | Simple mental model | Overhead, requires optimization |
| **Fine-grained** (Rip) | Track dependencies, update directly | Surgical updates, fast | More complex internally |

When `count` changes:

- Only subscribers to `count` re-run
- No component re-render
- No tree diff
- No virtual DOM

Changes propagate directly through the dependency graph.

---

## Advanced Utilities

### Untracked Read

```coffee
count.read()
```

Reads without creating a dependency.

### Batch

```coffee
__batch ->
  count.value = 1
  name.value = "Alice"
```

Groups updates into a single flush.

### Lock

```coffee
count.lock()
```

Freezes value (SSR / immutability).

### Kill

```coffee
count.kill()
```

Disposes signal and returns final value.

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

## Summary

Rip's reactivity system:

- **Three operators** — state (`:=`), computed (`~=`), effect (`~>`)
- **Natural reading** — "gets state", "always equals", "always calls"
- **Minimal complete set** — same model as Vue, Solid, Svelte, MobX
- **Timing composes** — `delay`, `debounce`, `throttle`, `hold` from the triad
- **Effect cleanup** — return a function to cancel timers, subscriptions, intervals
- **Fine-grained** — surgical updates to subscribers, no VDOM
- **Tiny runtime** — ~200 lines, ~4 KB

React adds APIs. Vue adds modes. Solid adds helpers.

Rip adds nothing. And still expresses all of it.

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
