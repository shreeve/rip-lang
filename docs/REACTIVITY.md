<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

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
doubled ∞= count * 2     # Arithmetic
message = "Count: #{count}"  # String interpolation
console.log count        # Function arguments

# Explicit access when needed:
count.read()             # Get value without tracking dependencies
+count                   # Unary plus (same as count.value)
```

---

## Reactive Variable Methods

| Method | Purpose |
|--------|---------|
| `x.read()` | Get value without tracking (for effects that shouldn't re-run) |
| `x.value` | Direct access to the underlying value |
| `+x` | Shorthand for `x.value` (triggers tracking in effects) |
| `x.lock()` | Make value readonly (can read but can't change) |
| `x.free()` | Unsubscribe from all dependencies (signal still works) |
| `x.kill()` | Clean up everything and return final value |

---

## Dependency Tracking

Understanding when dependencies are tracked is key to effective reactive programming.

### What Tracks Dependencies?

| Expression | Tracks? | Why |
|------------|---------|-----|
| `count * 2` | ✅ Yes | Arithmetic triggers `.valueOf()` |
| `"Count: #{count}"` | ✅ Yes | Interpolation triggers `.toString()` |
| `console.log count` | ✅ Yes | Coercion triggers `.valueOf()` |
| `+count` | ✅ Yes | Unary plus triggers `.valueOf()` |
| `count.value` | ✅ Yes | Direct `.value` access |
| `count.read()` | ❌ No | Explicit non-tracking read |
| `y = count` | ❌ No | Assigns signal object, not value |

### Example: Tracking vs Non-Tracking

```coffee
count := 10

# Effect A: Subscribes to count (will re-run when count changes)
effect -> console.log "A: #{count}"

# Effect B: Does NOT subscribe (won't re-run)
effect -> console.log "B: #{count.read()}"

count = 20
# Output:
#   A: 20    ← Effect A re-ran
#            ← Effect B did NOT re-run
```

### When to Use `.read()`

Use `.read()` when you need the current value but don't want to create a dependency:

```coffee
count := 0
lastSaved := 0

effect ->
  # We want to log count changes, but compare against lastSaved
  # without re-running when lastSaved changes
  if count != lastSaved.read()
    console.log "Unsaved changes: #{count}"
```

---

## Lifecycle & Cleanup

### Locking a Signal

Make a signal readonly (subscriptions stay active):

```coffee
config := { theme: "dark" }
config.lock()

config = { theme: "light" }  # Silently ignored
config.theme                  # Still "dark"
```

### Freeing Subscriptions

Unsubscribe a computed/effect from its dependencies:

```coffee
count := 0
doubled ∞= count * 2

doubled.free()  # No longer updates when count changes
count = 10      # doubled stays at its last value
```

### Killing a Signal

Clean up completely and get the final value:

```coffee
count := 10
finalValue = count.kill()  # Returns 10, signal is now dead

count = 20  # Error or no-op (signal is dead)
```

### Effect Cleanup

Effects can return a cleanup function:

```coffee
effect ->
  interval = setInterval (-> tick()), 1000
  -> clearInterval interval  # Cleanup when effect re-runs or disposes
```

---

## Real-World Example

A complete reactive counter with persistence:

```coffee
# Reactive state
count := parseInt(localStorage.getItem("count")) or 0

# Derived values
doubled ∞= count * 2
isEven ∞= count % 2 == 0
message ∞= "Count is #{count} (#{isEven ? 'even' : 'odd'})"

# Side effect: persist to localStorage
effect ->
  localStorage.setItem "count", count

# Side effect: log changes
effect ->
  console.log message

# Usage
count = 5
# Console: "Count is 5 (odd)"
# localStorage: "5"

count = 10
# Console: "Count is 10 (even)"
# localStorage: "10"
```

---

## FAQ

### What's the difference between `+x` and just `x`?

In most contexts they're the same, but **assignment is different**:

```coffee
count := 10

y = count      # y is the SIGNAL OBJECT itself
z = +count     # z is 10 (the number)

y + 1          # Works (coerces to 11)
typeof y       # "object"
typeof z       # "number"
```

Use `+x` when you explicitly need the primitive value.

### Does string interpolation track dependencies?

**Yes!** String interpolation calls `.toString()` which tracks:

```coffee
count := 0

effect -> console.log "Count: #{count}"  # ← Subscribes to count

count = 5  # Effect re-runs, logs "Count: 5"
```

### When would I use `.read()` vs `+x`?

| Use | When |
|-----|------|
| `+x` | Normal use - you want reactivity |
| `x.read()` | Inside effects when you DON'T want to subscribe |

```coffee
effect ->
  # +count would make this effect re-run when count changes
  # count.read() gets the value without subscribing
  initialValue = count.read()
```

### What about memory management?

Reactive subscriptions are automatically cleaned up when:
- A component unmounts (in UI context)
- You call `.free()` on a computed/effect
- You call `.kill()` on a signal

For long-running apps, explicitly dispose effects you no longer need:

```coffee
stop = effect -> console.log count
# ... later ...
stop()  # Disposes the effect
```

### Can I convert a reactive variable back to normal?

Use `.kill()` to get the final value and destroy the signal:

```coffee
count := 10
plainNumber = count.kill()  # Returns 10, signal is destroyed
```

Or just read the value without killing:

```coffee
plainNumber = +count  # Get value, signal stays alive
```

### What's the difference between `.free()` and `.kill()`?

| Method | Signal Lives? | Returns | Use Case |
|--------|---------------|---------|----------|
| `.free()` | ✅ Yes | Nothing | Stop updates but keep signal |
| `.kill()` | ❌ No | Final value | Complete cleanup |

```coffee
count := 10

count.free()   # Signal works, just no subscribers
count = 20     # Works fine

# vs

value = count.kill()  # Returns 10, signal is dead
count = 20            # No-op or error
```

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