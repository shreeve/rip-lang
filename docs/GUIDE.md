<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Rip Language Guide

> **Modern CoffeeScript with Built-in Reactivity**

This comprehensive guide covers Rip's reactive primitives, special operators, and regex enhancements. Rip provides reactivity as a **language-level construct**, not a library import—state management is built into the syntax itself.

---

## Table of Contents

1. [Reactivity](#1-reactivity)
2. [Special Operators](#2-special-operators)
3. [Regex+ Features](#3-regex-features)

---

# 1. Reactivity

Rip provides reactive primitives as **language-level operators**, not library imports.

## Reactive Operators

| Operator | Name | Mnemonic | Purpose |
|----------|------|----------|---------|
| `=` | Assign | "gets value" | Regular assignment |
| `:=` | State | "holds state" | Reactive state variable |
| `~=` | Computed | "always equals" | Computed value (auto-updates when dependencies change) |
| `=!` | Readonly | "equals, dammit!" | Constant (`const`) - not reactive, just immutable |
| `effect` | Effect | — | Side effect that runs when dependencies change |

## Reactive State (`:=`)

The state operator creates reactive state:

```coffee
count := 0              # Reactive state
name := "world"         # Another reactive state
```

State changes automatically trigger updates in any computed values or effects that depend on them.

## Computed Values (`~=`)

The "always equals" operator creates a value that automatically recomputes when its dependencies change:

```coffee
count := 0
doubled ~= count * 2    # Always equals count * 2

count = 5               # doubled automatically becomes 10
count = 10              # doubled automatically becomes 20
```

## Constant Values (`=!`) - "Equal, Dammit!"

In Rip, regular assignment (`=`) compiles to `let` for maximum flexibility. When you want an immutable constant, use the "equal, dammit!" operator (`=!`), which compiles to `const`:

```coffee
# Regular assignment → let (can reassign)
host = "localhost"
host = "example.com"    # OK - variables are flexible by default

# Equal, dammit! → const (can't reassign)
API_URL =! "https://api.example.com"
MAX_RETRIES =! 3

API_URL = "other"       # Error! const cannot be reassigned
```

This gives you opt-in immutability when you need it, while keeping the default flexible for scripting.

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

## Auto-Unwrapping

Reactive variables automatically unwrap in most contexts:

```coffee
count := 10

# All of these work automatically:
doubled ~= count * 2     # Arithmetic
message = "Count: #{count}"  # String interpolation
console.log count        # Function arguments

# Explicit access when needed:
count.read()             # Get value without tracking dependencies
+count                   # Unary plus (same as count.value)
```

## Reactive Variable Methods

| Method | Purpose |
|--------|---------|
| `x.read()` | Get value without tracking (for effects that shouldn't re-run) |
| `x.value` | Direct access to the underlying value |
| `+x` | Shorthand for `x.value` (triggers tracking in effects) |
| `x.lock()` | Make value readonly (can read but can't change) |
| `x.free()` | Unsubscribe from all dependencies (state still works) |
| `x.kill()` | Clean up everything and return final value |

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
| `y = count` | ❌ No | Assigns state object, not value |

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

## Lifecycle & Cleanup

### Locking a State

Make a state readonly (subscriptions stay active):

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
doubled ~= count * 2

doubled.free()  # No longer updates when count changes
count = 10      # doubled stays at its last value
```

### Killing a State

Clean up completely and get the final value:

```coffee
count := 10
finalValue = count.kill()  # Returns 10, state is now dead

count = 20  # Error or no-op (state is dead)
```

### Effect Cleanup

Effects can return a cleanup function:

```coffee
effect ->
  interval = setInterval (-> tick()), 1000
  -> clearInterval interval  # Cleanup when effect re-runs or disposes
```

## Real-World Example

A complete reactive counter with persistence:

```coffee
# Reactive state
count := parseInt(localStorage.getItem("count")) or 0

# Computed values
doubled ~= count * 2
isEven ~= count % 2 == 0
message ~= "Count is #{count} (#{isEven ? 'even' : 'odd'})"

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

## How It Works

The Rip compiler transforms reactive operators into efficient JavaScript:

```coffee
# Rip source
count := 0
doubled ~= count * 2
effect -> console.log doubled
```

```javascript
// Compiled output (conceptual)
const count = __state(0);
const doubled = __computed(() => count.value * 2);
__effect(() => console.log(doubled.value));
```

The runtime is **automatically inlined** - no external dependencies required.

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

## Comparison with Other Frameworks

| Concept | React | Vue | Solid | Rip |
|---------|-------|-----|-------|-----|
| State | `useState()` | `ref()` | `createSignal()` | `x := 0` |
| Computed | `useMemo()` | `computed()` | `createMemo()` | `x ~= y * 2` |
| Effect | `useEffect()` | `watch()` | `createEffect()` | `effect ->` |
| Constant | `const` | `const` | `const` | `x =! 0` |

Rip's approach: **No imports, no hooks, no special functions. Just operators.**

---

# 2. Special Operators

## Dammit Operator (`!`)

The **dammit operator (`!`)** is a trailing suffix that does TWO things:
1. **Calls the function** (even without parentheses)
2. **Awaits the result** (prepends `await`)

### Quick Examples

```coffee
# Simple call and await
result = fetchData!      # → await fetchData()

# With arguments
user = getUser!(id)      # → await getUser(id)

# Method calls
data = api.get!          # → await api.get()

# In expressions
total = 5 + getValue!    # → 5 + await getValue()
```

### Basic Usage

```coffee
# WITHOUT dammit - reference only
fn = loadConfig
typeof fn  # → 'function'

# WITH dammit - calls immediately
config = loadConfig!  # → await loadConfig()
```

### Comparison: Before & After

**Before (Explicit Await):**
```coffee
user = await db.findUser(id)
posts = await db.getPosts(user.id)
comments = await db.getComments(posts[0].id)
result = await buildResponse(comments)
```

**After (Dammit Operator):**
```coffee
user = db.findUser!(id)
posts = db.getPosts!(user.id)
comments = db.getComments!(posts[0].id)
result = buildResponse!(comments)
```

**Benefit:** ~50% shorter, same clarity, **zero performance traps**

### Usage Guidelines

**✅ When to Use `!`:**

```coffee
# Sequential async code (most common case)
user = findUser!(id)
posts = getPosts!(user.id)
render!(user, posts)

# Simple async chains
config = loadConfig!
db = connectDB!(config)
server = startServer!(db)
```

**❌ When NOT to Use `!`:**

```coffee
# DON'T (serialized - slow):
a = fetch1!
b = fetch2!
c = fetch3!

# DO (parallel - fast):
[a, b, c] = await Promise.all([fetch1(), fetch2(), fetch3()])
```

## Void Functions (`!` at Definition)

The `!` at definition suppresses implicit returns (side-effect only functions):

```coffee
def processItems!
  for item in items
    item.update()
  # ← Returns undefined, not last expression

# With explicit return (value stripped)
def validate!(x)
  return if x < 0     # → Just "return" (no value)
  console.log "valid"
  # ← Returns undefined
```

**Works with all function types:**
```coffee
c! = (x) ->              # Void thin arrow
  x * 2                  # Executes but doesn't return value

process! = (data) =>     # Void fat arrow
  data.toUpperCase()     # Executes but returns undefined
```

## Floor Division (`//`)

True floor division (not just integer division):

```coffee
7 // 3    # → 2
-7 // 3   # → -3 (floors toward negative infinity)
```

## True Modulo (`%%`)

True mathematical modulo (not remainder like `%`):

```coffee
-7 %% 3   # → 2 (always positive)
-7 % 3    # → -1 (remainder, can be negative)
```

## Ternary Operator (`?:`)

Rip supports both JavaScript-style ternary AND CoffeeScript-style:

```coffee
# JavaScript style
status = active ? 'on' : 'off'

# CoffeeScript style
status = if active then 'on' else 'off'

# Nested
level = score > 90 ? 'A' : score > 80 ? 'B' : score > 70 ? 'C' : 'F'
```

**Why possible:** By using `??` for nullish, `?` became available for ternary.

## Otherwise Operator (`!?`)

The otherwise operator handles both null/undefined AND thrown errors:

```coffee
result = riskyOperation() !? "default"
# If riskyOperation() throws or returns null/undefined, result = "default"
```

---

# 3. Regex+ Features

**Ruby-Inspired Regex Matching with Automatic Capture**

Rip extends CoffeeScript with two powerful regex features inspired by Ruby: the **`=~` match operator** and **regex indexing**. Both features automatically manage match results in a global `_` variable.

## `=~` Match Operator

### Syntax

```rip
text =~ /pattern/
```

### Behavior

- Executes: `(_ = toSearchable(text).match(/pattern/))`
- Stores match result in `_` variable (accessible immediately)
- Returns: the match result (truthy) or `null`

### Examples

**Basic matching:**
```rip
text = "hello world"
if text =~ /world/
  console.log("Found:", _[0])  # "world"
```

**Capture groups:**
```rip
email = "user@example.com"
if email =~ /(.+)@(.+)/
  username = _[1]  # "user"
  domain = _[2]    # "example.com"
```

**Phone number parsing:**
```rip
phone = "2125551234"
if phone =~ /^([2-9]\d\d)([2-9]\d\d)(\d{4})$/
  formatted = "(#{_[1]}) #{_[2]}-#{_[3]}"
  # Result: "(212) 555-1234"
```

## Regex Indexing

### Syntax

```rip
value[/pattern/]      # Returns full match (capture 0)
value[/pattern/, n]   # Returns capture group n
```

### Examples

**Simple match:**
```rip
"steve"[/eve/]           # Returns "eve"
```

**Capture group:**
```rip
"steve"[/e(v)e/, 1]      # Returns "v"
```

**Email domain:**
```rip
domain = "user@example.com"[/@(.+)$/, 1]
# Returns: "example.com"
```

## Combined Usage

The real power comes from using both features together:

```rip
# Parse, validate, and format in clean steps
email = "Admin@Company.COM"
if email =~ /^([^@]+)@([^@]+)$/i
  username = _[1].toLowerCase()   # "admin"
  domain = _[2].toLowerCase()     # "company.com"
  "#{username}@#{domain}"         # Normalized email
```

## Elegant Validator Pattern

One of the most powerful use cases is building validators:

```rip
validators =
  # Extract and validate in one expression
  id:       (v) -> v[/^([1-9]\d{0,19})$/] and parseInt(_[1])
  email:    (v) -> v[/^([^@]+)@([^@]+\.[a-z]{2,})$/i] and _[0]
  zip:      (v) -> v[/^(\d{5})/] and _[1]
  phone:    (v) -> v[/^(\d{10})$/] and formatPhone(_[1])

  # Normalize formats
  ssn:      (v) -> v[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}#{_[2]}#{_[3]}"
  zipplus4: (v) -> v[/^(\d{5})-?(\d{4})$/] and "#{_[1]}-#{_[2]}"

  # Boolean validators with =~
  truthy:   (v) -> (v =~ /^(true|t|1|yes|y|on)$/i) and true
  falsy:    (v) -> (v =~ /^(false|f|0|no|n|off)$/i) and true
```

**Each validator:**
- Validates format
- Extracts/transforms data
- Returns normalized value or falsy
- **All in one line!**

## Heregex (Extended Regular Expressions)

Rip supports heregexes - extended regular expressions that allow whitespace and comments for readability:

```rip
pattern = ///
  ^ \d+      # starts with digits
  \s*        # optional whitespace
  [a-z]+     # followed by letters
  $          # end of string
  ///i

# Compiles to: /^\d+\s*[a-z]+$/i
# Comments and whitespace automatically stripped!
```

## Security Features

### Injection Protection

By default, **rejects strings with newlines**:

```rip
# Safe - rejects malicious input
userInput = "test\nmalicious"
userInput =~ /^test$/   # Returns null! (newline detected)

# Explicit multiline when needed
text = "line1\nline2"
text =~ /line2/m        # Works! (/m flag allows newlines)
```

---

## Design Philosophy

1. **Syntax over API** — Reactive primitives are operators, not function calls
2. **Implicit tracking** — Dependencies are detected automatically
3. **Minimal boilerplate** — No `useState`, no `.value` in most cases
4. **Familiar feel** — Looks like regular assignment, behaves reactively
5. **Zero dependencies** — Runtime is inlined, no external packages needed
6. **Framework-agnostic** — Use Rip's reactivity with any UI framework

---

**See Also:**
- [INTERNALS.md](INTERNALS.md) - Compiler and parser details
- [PHILOSOPHY.md](PHILOSOPHY.md) - Why Rip exists
- [BROWSER.md](BROWSER.md) - Browser usage and REPL guide
