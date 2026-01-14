# Rip Reactivity

> **The Language IS the Framework**

Rip provides reactive primitives as **language-level operators**, not library imports. Reactivity is built into the syntax itself.

---

## Reactive Operators

| Operator | Name | Purpose |
|----------|------|---------|
| `:=` | Signal | Reactive state variable |
| `∞=` | Derived | Computed value (auto-updates when dependencies change) |
| `~=` | Derived (ASCII) | Same as `∞=` for ASCII-only environments |
| `=!` | Readonly | Constant that cannot be reassigned |
| `effect` | Effect | Side effect that runs when dependencies change |

---

## Reactive State (`:=`)

The signal operator creates reactive state:

```coffee
count := 0              # Reactive signal
name := "world"         # Another reactive signal
```

State changes automatically trigger updates in any derived values or effects that depend on them.

---

## Derived Values (`∞=` / `~=`)

The "always equals" operator creates a value that automatically recomputes when its dependencies change:

```coffee
count := 0
doubled ∞= count * 2    # Always equals count * 2

count = 5               # doubled automatically becomes 10
count = 10              # doubled automatically becomes 20
```

**ASCII alternative:** Use `~=` if your environment doesn't support Unicode:

```coffee
doubled ~= count * 2    # Same as ∞=
```

---

## Readonly Values (`=!`)

The readonly operator creates a constant that cannot be reassigned:

```coffee
API_URL =! "https://api.example.com"
MAX_RETRIES =! 3

API_URL = "other"       # Silently ignored - value stays unchanged
```

---

## Side Effects (`effect`)

The `effect` keyword defines a side effect block that runs when its dependencies change:

```coffee
count := 0

effect -> console.log "Count changed to:", count

count = 5    # Logs: "Count changed to: 5"
count = 10   # Logs: "Count changed to: 10"
```

Effects are useful for:
- Logging and debugging
- Syncing with external systems
- Analytics tracking
- Local storage persistence

---

## Auto-Unwrapping

Reactive variables automatically unwrap in most contexts:

```coffee
count := 10

# All of these work automatically:
doubled ∞= count * 2         # Arithmetic
message = "Count: #{count}"  # String interpolation
console.log count            # Function arguments

# Explicit access when needed:
count.read()                 # Get value without tracking dependencies
+count                       # Unary plus (same as count.value)
```

---

## Reactive Variable Methods

| Method | Purpose |
|--------|---------|
| `x.read()` | Get value without tracking (for effects that shouldn't re-run) |
| `x.value` | Direct access to the underlying value |
| `+x` | Shorthand for `x.value` (triggers tracking in effects) |

---

## How It Works

The Rip compiler transforms reactive operators into efficient JavaScript:

```coffee
# Rip source
count := 0
doubled ∞= count * 2
effect -> console.log doubled
```

```javascript
// Compiled output (conceptual)
const count = __signal(0);
const doubled = __computed(() => count.value * 2);
__effect(() => console.log(doubled.value));
```

The runtime is **automatically inlined** - no external dependencies required.

---

## Zero Overhead for Non-Reactive Code

If your code doesn't use reactive features, no runtime is injected:

```coffee
# Non-reactive code
x = 10
y = x * 2
console.log y
```

```javascript
// Clean output - no reactive runtime
let x, y;
x = 10;
y = x * 2;
console.log(y);
```

---

## Comparison with Other Frameworks

| Concept | React | Vue | Solid | Rip |
|---------|-------|-----|-------|-----|
| State | `useState()` | `ref()` | `createSignal()` | `x := 0` |
| Derived | `useMemo()` | `computed()` | `createMemo()` | `x ∞= y * 2` |
| Effect | `useEffect()` | `watch()` | `createEffect()` | `effect ->` |
| Constant | `const` | `const` | `const` | `x =! 0` |

Rip's approach: **No imports, no hooks, no special functions. Just operators.**

---

## Design Philosophy

1. **Syntax over API** — Reactive primitives are operators, not function calls
2. **Implicit tracking** — Dependencies are detected automatically
3. **Minimal boilerplate** — No `useState`, no `.value` in most cases
4. **Familiar feel** — Looks like regular assignment, behaves reactively
5. **Zero dependencies** — Runtime is inlined, no external packages needed
