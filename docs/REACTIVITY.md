# Rip Reactivity

> **The Language IS the Framework**

Rip provides reactive primitives as **language-level operators**, not library imports. Reactivity is built into the syntax itself.

---

## Reactive Operators

| Operator | Name | Purpose |
|----------|------|---------|
| `∞=` | Always equals | Reactive derived value (auto-updates when dependencies change) |
| `~=` | Always equals (ASCII) | Same as `∞=` for ASCII-only environments |
| `=!` | Readonly | Constant that cannot be reassigned |
| `∞>` | Exposed method | Public method callable by parent component |
| `~>` | Exposed method (ASCII) | Same as `∞>` for ASCII-only environments |

---

## Reactive State

Regular assignment creates reactive state:

```coffee
count = 0              # Reactive state (just assignment)
name = "world"         # Another reactive state
```

State changes automatically trigger updates in any derived values or UI that depends on them.

---

## Derived Values (`∞=` / `~=`)

The "always equals" operator creates a value that automatically recomputes when its dependencies change:

```coffee
count = 0
doubled ∞= count * 2   # Always equals count * 2

count = 5              # doubled automatically becomes 10
count = 10             # doubled automatically becomes 20
```

**ASCII alternative:** Use `~=` if your environment doesn't support Unicode:

```coffee
doubled ~= count * 2   # Same as ∞=
```

---

## Readonly Values (`=!`)

The readonly operator creates a constant that cannot be reassigned:

```coffee
API_URL =! "https://api.example.com"
MAX_RETRIES =! 3

API_URL = "other"      # Error: cannot reassign readonly value
```

---

## Exposed Methods (`∞>` / `~>`)

The exposed method operator marks a method as part of the component's public interface, callable by parent components:

```coffee
component TextField
  value = ""

  focus ∞>: ->         # Exposed to parent
    @inputRef.focus()

  clear ∞>: ->         # Exposed to parent
    value = ""

# Parent can call:
# textFieldRef.focus()
# textFieldRef.clear()
```

**ASCII alternative:** Use `~>` if your environment doesn't support Unicode:

```coffee
focus ~>: ->
  @inputRef.focus()
```

---

## Side Effects (`trigger`)

The `trigger` keyword defines a side effect block that runs when its dependencies change:

```coffee
count = 0

trigger: ->
  console.log "Count changed to:", count

count = 5   # Logs: "Count changed to: 5"
count = 10  # Logs: "Count changed to: 10"
```

Triggers are useful for:
- Logging and debugging
- Syncing with external systems
- Analytics tracking
- Local storage persistence

---

## How It Works

The Rip compiler transforms reactive operators into efficient JavaScript:

```coffee
# Rip source
count = 0
doubled ∞= count * 2
```

```javascript
// Compiled output (conceptual)
const count = signal(0);
const doubled = computed(() => count.value * 2);
```

The exact runtime implementation may vary, but the key point is: **you write simple assignments, the compiler handles the reactivity**.

---

## Comparison with Other Frameworks

| Concept | React | Vue | Svelte | Rip |
|---------|-------|-----|--------|-----|
| State | `useState()` | `ref()` | `let x = 0` | `x = 0` |
| Derived | `useMemo()` | `computed()` | `$: x * 2` | `x ∞= y * 2` |
| Effect | `useEffect()` | `watch()` | `$: { }` | `trigger: ->` |
| Constant | `const` | `const` | `const` | `x =! 0` |

Rip's approach: **No imports, no hooks, no special functions. Just operators.**

---

## Design Philosophy

1. **Syntax over API** — Reactive primitives are operators, not function calls
2. **Implicit tracking** — Dependencies are detected automatically
3. **Minimal boilerplate** — No `useState`, no `.value`, no `$:`
4. **Familiar feel** — Looks like regular assignment, behaves reactively
