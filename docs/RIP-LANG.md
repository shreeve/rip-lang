<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Language Reference

Rip is a modern reactive language that compiles to ES2022 JavaScript. It combines CoffeeScript's elegant syntax with built-in reactivity primitives. Zero dependencies, self-hosting, ~13,500 LOC.

---

## Table of Contents

1. [Installation & Running](#1-installation--running)
2. [Core Syntax](#2-core-syntax)
3. [Operators](#3-operators)
4. [Functions](#4-functions)
5. [Classes](#5-classes)
6. [Reactivity](#6-reactivity)
7. [Async Patterns](#7-async-patterns)
8. [Modules & Imports](#8-modules--imports)
9. [Regex Features](#9-regex-features)
10. [Packages](#10-packages)
11. [CLI Tools & Scripts](#11-cli-tools--scripts)
12. [Types](#12-types)
13. [JavaScript Interop](#13-javascript-interop)
14. [Common Patterns](#14-common-patterns)
15. [Quick Reference](#15-quick-reference)
16. [Future Ideas](#16-future-ideas)

---

# 1. Installation & Running

```bash
# Install Bun first (if needed)
curl -fsSL https://bun.sh/install | bash

# Install Rip globally
bun add -g rip-lang
```

```bash
rip                    # Interactive REPL
rip app.rip            # Run a file
rip -c app.rip         # Compile to JavaScript (stdout)
rip -o app.js app.rip  # Compile to file
rip -t app.rip         # Show tokens (debug)
rip -s app.rip         # Show S-expressions (debug)
bun app.rip            # Direct execution with Bun loader
```

All Rip files use the `.rip` extension.

---

# 2. Core Syntax

## Variables

```coffee
# Regular assignment (compiles to let)
name = "Alice"
count = 0
items = [1, 2, 3]

# Constant assignment (compiles to const)
MAX_SIZE =! 100
API_URL =! "https://api.example.com"

# Destructuring
{name, age} = person
[first, second, ...rest] = items
{data: {users}} = response
```

## Data Types

```coffee
# Strings (interpolation with #{} or ${})
greeting = "Hello, #{name}!"
greeting = "Hello, ${name}!"

# Heredocs — closing delimiter position defines the left margin
multiline = """
  This is a
  multi-line string
  """
# Result: "This is a\nmulti-line string" (closing """ at col 2 strips 2 spaces)

# Raw heredocs — append \ to keep escape sequences literal
script = '''\
  echo "hello\nworld"   # \n stays as \n, not a newline
  \'''

# Numbers
count = 42
price = 19.99
hex = 0xFF
binary = 0b1010

# Arrays
items = [1, 2, 3]
matrix = [[1, 2], [3, 4]]

# Objects
user = {name: "Alice", age: 30}
shorthand = {name, age}  # Same as {name: name, age: age}

# Ranges
nums = [1..5]      # [1, 2, 3, 4, 5]
exclusive = [1...5]  # [1, 2, 3, 4]
```

## Control Flow

```coffee
# If/else (expression — returns value)
status = if active then "on" else "off"

# Block form
if user.admin
  showAdminPanel()
else if user.moderator
  showModPanel()
else
  showUserPanel()

# Ternary (JS-style)
status = active ? "on" : "off"
result = x > 5 ? "big" : "small"

# Ternary (Python-style postfix)
status = "active" if online else "offline"
label = "big" if x > 5 else "small"

# NOTE: Subscript in ternary true-branch needs parentheses
item = found ? (arr[0]) : default

# Unless
showWarning() unless saved

# Postfix conditionals
console.log "active" if user.active
return early unless valid

# Switch/when
result = switch status
  when "pending" then "Waiting..."
  when "active" then "Running"
  when "done" then "Complete"
  else "Unknown"

# Pattern matching in switch
switch value
  when 1, 2, 3
    "small"
  when 4, 5, 6
    "medium"
  else
    "large"
```

## Guard Clauses

Rip supports Ruby-style control flow short-circuits:

```coffee
# or return — return early if falsy
def loadUser(id)
  data = fetchUser!(id) or return {error: "User not found"}
  processUser(data)

# or throw — throw if falsy
def requireAuth(req)
  token = req.headers.authorization or throw new Error "No auth token"
  verify(token)

# ?? return — return only if null/undefined (not falsy values like 0, "")
def getPort(config)
  port = config.port ?? return 3000  # 0 is valid, won't trigger return
  port

# ?? throw — throw only if null/undefined
def requireId(params)
  id = params.id ?? throw new Error "ID required"  # 0 is valid ID
  id

# and return — return if truthy (for cache patterns)
def getData(key)
  cached = cache.get(key) and return cached
  result = compute(key)
  cache.set(key, result)
  result
```

**Key distinction:**
- `or`/`and` — check **truthiness** (falsy = `false`, `0`, `""`, `null`, `undefined`)
- `??` — check **nullish** only (`null`, `undefined`) — `0`, `""`, `false` pass through

## Loops

```coffee
# For...in (arrays)
for item in items
  console.log item

# With index
for item, i in items
  console.log "#{i}: #{item}"

# For...of (objects)
for key, value of object
  console.log "#{key} = #{value}"

# For own (skip inherited)
for own key, value of object
  console.log key

# For...as (ES6 for-of on iterables)
for x as iterable
  console.log x

# For...as! (async iteration shorthand)
for x as! asyncIterable
  console.log x
# Equivalent to: for await x as asyncIterable

# Range loops
for i in [1..10]
  console.log i

# While / Until / Loop
while condition
  doSomething()

until done
  process()

loop
  data = fetch()
  break if data.complete

# Loop N times
loop 5
  console.log "hi"
# Compiles to: for (let _i = 0; _i < 5; _i++) { ... }

# Loop with variable or expression
loop retries
  attempt!
```

## Comprehensions

```coffee
# Array comprehension (context-aware!)
squares = (x * x for x in [1..10])

# With filter
evens = (x for x in [1..10] when x % 2 is 0)

# Object comprehension
doubled = {k: v * 2 for k, v of prices}

# Statement context (no array created — just loops)
console.log item for item in items
```

## Comments

```coffee
# Single line comment

###
Block comment
Multiple lines
###
```

---

# 3. Operators

## Standard Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `+` `-` `*` `/` | `a + b` | Arithmetic |
| `%` | `a % b` | Remainder (can be negative) |
| `**` | `a ** b` | Exponentiation |
| `==` `!=` | `a == b` | Equality (compiles to `===`) |
| `<` `>` `<=` `>=` | `a < b` | Comparison |
| `and` `or` `not` | `a and b` | Logical (also `&&` `\|\|` `!`) |
| `is` `isnt` | `a is b` | Identity (`===` / `!==`) |
| `in` | `x in arr` | Array membership |
| `of` | `k of obj` | Object key existence |
| `?` (postfix) | `a?` | Existence check (`a != null`) |
| `?` (ternary) | `a ? b : c` | Ternary conditional |
| `if...else` (postfix) | `b if a else c` | Python-style ternary |
| `?.` `?.[]` `?.()` | `a?.b` `a?.[0]` `a?.()` | Optional chaining (ES6) |
| `?[]` `?()` | `a?[0]` `a?(x)` | Optional chaining shorthand |
| `??` | `a ?? b` | Nullish coalescing |

## Rip-Specific Operators

| Operator | Name | Example | Compiles To |
|----------|------|---------|-------------|
| `=` | Assign | `x = 5` | `let x; x = 5` |
| `:=` | State | `count := 0` | Reactive state |
| `~=` | Computed | `doubled ~= count * 2` | Computed value |
| `=!` | Readonly | `MAX =! 100` | `const MAX = 100` |
| `//` | Floor division | `7 // 2` | `Math.floor(7 / 2)` — always floors toward negative infinity |
| `%%` | True modulo | `-1 %% 3` | Always positive result (not remainder) |
| `!` | Dammit | `fetchData!` | `await fetchData()` — calls AND awaits |
| `!` | Void | `def process!` | Suppresses implicit return |
| `!?` | Otherwise | `val !? 5` | Default if undefined or throws |
| `=~` | Match | `str =~ /pat/` | Ruby-style regex match, captures in `_` |
| `::` | Prototype | `String::trim` | `String.prototype.trim` |
| `[-n]` | Negative index | `arr[-1]` | `arr.at(-1)` |
| `*` | String repeat | `"-" * 40` | `"-".repeat(40)` |
| `<` `<=` | Chained comparison | `1 < x < 10` | `(1 < x) && (x < 10)` |
| `\|>` | Pipe | `x \|> fn` or `x \|> fn(y)` | `fn(x)` or `fn(x, y)` |
| `.=` | Method assign | `x .= trim()` | `x = x.trim()` |
| `*` | Merge assign | `*obj = {a: 1}` | `Object.assign(obj, {a: 1})` |
| `not in` | Not in | `x not in arr` | Negated membership test |
| `not of` | Not of | `k not of obj` | Negated key existence |
| `<=>` | Two-way bind | `value <=> name` | Bidirectional reactive binding (render blocks) |

## Assignment Operators

```coffee
x = 5        # let x = 5
x := 5       # reactive state
x ~= y * 2   # computed (auto-updates)
x =! 5       # const x = 5
x += 1       # x = x + 1
x -= 1       # x = x - 1
x *= 2       # x = x * 2
x /= 2       # x = x / 2
x //= 2      # x = Math.floor(x / 2)
x %%= 3      # x = true modulo
x ?= 10      # x = x ?? 10 (nullish assignment)
x &&= val    # x = x && val
x ||= val    # x = x || val
```

## Optional Chaining

```coffee
# ES6 optional chaining (with dot)
user?.profile?.name
arr?.[0]
fn?.(arg)

# Shorthand (without dot — same behavior)
arr?[0]       # Compiles to arr?.[0]
fn?(arg)      # Compiles to fn?.(arg)
```

## Ternary Operator

```coffee
# JavaScript-style ternary
status = active ? 'on' : 'off'
result = valid ? obj.field : null
output = ready ? compute() : fallback

# Python-style postfix ternary
status = "active" if online else "offline"
label = "big" if x > 5 else "small"

# Nested
level = score > 90 ? 'A' : score > 80 ? 'B' : score > 70 ? 'C' : 'F'

# Subscript in true-branch needs parentheses
item = found ? (arr[0]) : default
```

## Otherwise Operator (`!?`)

Handles both null/undefined AND thrown errors:

```coffee
result = riskyOperation() !? "default"
# If riskyOperation() throws or returns null/undefined, result = "default"
```

## Method Assignment (`.=`)

A Rip original. Compound assignment for method calls — apply a method to a
variable and assign the result back in one step:

```coffee
# Without .= — repeat the variable name every time
items = items.filter -> it.active
items = items.map -> it.name
items = items.sort (a, b) -> a.localeCompare b
str = str.trim()
str = str.toLowerCase()

# With .= — name it once, transform in place
items .= filter -> it.active
items .= map -> it.name
items .= sort (a, b) -> a.localeCompare b
str .= trim()
str .= toLowerCase()
```

`x .= method(args)` compiles to `x = x.method(args)`. It's the method-call
equivalent of `+=` — just as `x += 5` means `x = x + 5`, `x .= trim()`
means `x = x.trim()`.

This operator is unique to Rip. Other languages have `+=`, `-=`, `*=`, and
other arithmetic compound assignments, but none extend the concept to method
calls. Combined with implicit `it`, this enables remarkably concise data
transformation pipelines:

```coffee
users .= filter -> it.active
users .= map -> it.name
users .= sort()
```

Works with any method — built-in or custom, with or without arguments. Spacing
is flexible — all of these are equivalent:

```coffee
str .= trim()          # canonical (spaced)
str.=trim()            # compact (no spaces)
str .=trim()           # mixed
```

## Merge Assignment (`*`)

A Rip original. Merge properties into an existing object without repeating
its name:

```coffee
# Without * — repeat the object name or use verbose Object.assign
Object.assign config,
  host: "localhost"
  port: 3000
  debug: true

# With * — clean and direct
*config =
  host: "localhost"
  port: 3000
  debug: true

# Single line
*opts = {method: "POST", body: data}

# Dotted paths
*el.style =
  color: "red"
  fontSize: "14px"

# Merge user overrides into defaults
*defaults = userConfig
```

`*target = value` compiles to `Object.assign(target, value)`. The `*` reads
as "spread these into" — the same concept as `...` spread but as an
assignment. This is unique to Rip.

Common use cases: config objects, options bags, state initialization, DOM
styling, merging defaults with overrides — anywhere you're setting multiple
properties on an existing object.

## Prototype Operator (`::`)

Access `.prototype` with `::` (CoffeeScript-style). Disambiguated from type annotations by spacing:

```coffee
# Prototype access (no space after ::)
String::starts = String::startsWith
String::ends   = String::endsWith
String::has    = String::includes

# Now you can use them
"hello".starts "he"        # true
"hello.rip".ends ".rip"    # true
"error: bad".has "error"   # true

# Define new prototype methods
String::shout = -> @toUpperCase() + "!"
"hello".shout()            # "HELLO!"

# Type annotations (space after ::) — unaffected
name:: string = "Alice"
def greet(name:: string):: string
  "Hello, #{name}!"
```

The rule is simple: `::` with **no space** before an identifier is prototype access. `::` with a **space** is a type annotation.

## Negative Indexing

Literal negative indexes compile to `.at()` for Python-style access from the end:

```coffee
arr = [10, 20, 30, 40, 50]

arr[-1]          # → arr.at(-1)  — 50 (last)
arr[-2]          # → arr.at(-2)  — 40 (second to last)
str[-1]          # works on strings too

arr?[-1]         # → arr?.at(-1) — optional variant

# Positive and variable indexes are unchanged
arr[0]           # → arr[0]      — normal access
arr[i]           # → arr[i]      — variable index
```

Only literal negative numbers trigger the `.at()` transform. Variable indexes pass through as-is.

## Pipe Operator (`|>`)

Pipes a value into a function as its first argument. Chains left-to-right:

```coffee
# Simple reference — value becomes the sole argument
5 |> double                      # → double(5)
10 |> Math.sqrt                  # → Math.sqrt(10)
"hello" |> console.log           # → console.log("hello")

# Multi-arg — value is inserted as the FIRST argument
5 |> add(3)                      # → add(5, 3)
data |> filter(isActive)         # → filter(data, isActive)
"World" |> greet("!")            # → greet("World", "!")

# Chaining — reads left-to-right like a pipeline
5 |> double |> add(1) |> console.log
# → console.log(add(double(5), 1))

# Works with dotted methods
users |> Array.from              # → Array.from(users)
data |> JSON.stringify(null, 2)  # → JSON.stringify(data, null, 2)
```

This is the **Elixir-style** pipe — strictly better than F#'s (which only supports bare function references) and cleaner than Hack's (which requires a `%` placeholder). No special syntax to learn; if the right side is a call, the left value goes first.

---

# 4. Functions

## Function Styles

```coffee
# Named function (hoisted)
def greet(name)
  "Hello, #{name}!"

# Arrow function (not hoisted, unbound this)
add = (a, b) -> a + b

# Fat arrow (bound this — use in callbacks/handlers)
handler = (e) => @process(e)

# Void function (suppresses implicit return)
def logItems!
  for item in items
    console.log item
  # Returns undefined, not last expression
```

Void works with all function types:

```coffee
c! = (x) ->          # Void thin arrow
process! = (d) =>    # Void fat arrow
```

## Parameters

```coffee
# Default parameters
def greet(name = "World")
  "Hello, #{name}!"

# Rest parameters
def sum(...nums)
  nums.reduce ((a, b) -> a + b), 0

# Destructuring parameters
def processUser({name, age})
  console.log "#{name} is #{age}"

# Constructor shorthand (in classes)
constructor: (@name, @age) ->
  # Automatically assigns this.name and this.age
```

## Implicit Returns

```coffee
# Last expression is returned automatically
def add(a, b)
  a + b  # Returns this

def getStatus(user)
  if user.active
    "active"
  else
    "inactive"

# Explicit return when needed
def findUser(id)
  for user in users
    return user if user.id is id
  null
```

## Implicit `it` Parameter

Arrow functions with no explicit parameters that reference `it` in the body automatically inject `it` as the parameter:

```coffee
# Without `it` — must name a throwaway variable
users.filter (u) -> u.active
names = users.map (u) -> u.name

# With `it` — cleaner
users.filter -> it.active
names = users.map -> it.name
orders.filter -> it.total > 100

# Works with fat arrows too
items.map => it.toUpperCase()

# Nested arrows — each level gets its own `it`
# Only the innermost param-less arrow with `it` is affected
groups.map -> it.items.filter -> it.active

# Explicit params still work normally
items.sort (a, b) -> a - b
```

Compiles to standard JavaScript — `it` becomes a regular function parameter:

```coffee
arr.filter -> it > 5
# → arr.filter(function(it) { return (it > 5); })

arr.map => it.name
# → arr.map(it => it.name)
```

## Calling Functions

```coffee
# Normal calls
greet("Alice")
add(1, 2)

# Without parentheses (when unambiguous)
console.log "Hello"
greet "World"

# Chained
users.filter((u) -> u.active).map((u) -> u.name)

# Ruby-style constructor
counter = Counter.new(initial: 5)
# Same as: new Counter({initial: 5})
```

## Implicit Commas

When a literal value is followed by an arrow function, Rip inserts a comma automatically:

```coffee
# Clean route handlers
get '/users' -> User.all!
get '/users/:id' -> User.find params.id
post '/users' -> User.create body
```

This enables Sinatra-style routing and other DSLs where functions take a value and a callback.

---

# 5. Classes

```coffee
class Animal
  constructor: (@name) ->

  speak: ->
    console.log "#{@name} makes a sound"

class Dog extends Animal
  constructor: (name, @breed) ->
    super(name)

  speak: ->
    console.log "#{@name} barks!"

class Counter
  @count = 0          # Static property
  @increment: ->      # Static method
    @count += 1

# Instantiation
dog = new Dog("Buddy", "Golden Retriever")
dog = Dog.new("Buddy", "Golden Retriever")  # Ruby-style
user = User.new(name: "Alice", role: "admin")
```

---

# 6. Reactivity

Rip's reactive features are **language-level operators**, not library imports.

## Reactive Operators

| Operator | Name | Read as | Purpose |
|----------|------|---------|---------|
| `=` | Assign | "gets value" | Regular assignment |
| `:=` | State | "gets state" | Reactive state variable |
| `~=` | Computed | "always equals" | Computed value (auto-updates) |
| `~>` | Effect | "always calls" | Side effect on dependency change |
| `=!` | Readonly | "equals, dammit!" | Constant (`const`) |

## Reactive Behavior

|  | `:=` state | `~=` computed | `~>` effect |
|---|---|---|---|
| **Purpose** | Hold a mutable value | Derive a value | Perform a side effect |
| **When it runs** | On write | Lazily, on read | Eagerly, on dependency change |
| **Caching** | N/A (stores directly) | Yes, memoized | No, always re-runs |
| **Returns** | A readable/writable value | A readable value | A cleanup function (optional) |

## State (`:=`)

```coffee
count := 0
name := "World"
items := []

# Write triggers updates
count = 5              # All dependents update
items = [...items, newItem]
```

## Computed Values (`~=`)

```coffee
count := 0
doubled ~= count * 2
message ~= "Count is #{count}"

count = 5
# doubled is now 10
# message is now "Count is 5"

# Complex computed
items := [{price: 10}, {price: 20}]
total ~= items.reduce ((sum, i) -> sum + i.price), 0
```

## Effects (`~>`)

```coffee
count := 0

# Fire and forget
~> console.log "Count changed to #{count}"

count = 5  # Logs: "Count changed to 5"

# Controllable (assign to variable)
logger ~> console.log count
logger.stop!     # Pause reactions
logger.run!      # Resume reactions
logger.cancel!   # Permanent disposal

# With cleanup
ticker ~>
  interval = setInterval (-> tick()), 1000
  -> clearInterval interval  # Cleanup function
```

## Auto-Unwrapping

Reactive variables automatically unwrap in most contexts:

```coffee
count := 10

# All of these work automatically:
doubled ~= count * 2        # Arithmetic
message = "Count: #{count}"  # Interpolation
console.log count            # Function arguments

# Explicit access when needed:
count.read()   # Get value without tracking dependencies
+count         # Unary plus (same as count.value)
```

## Dependency Tracking

| Expression | Tracks? | Why |
|------------|---------|-----|
| `count * 2` | Yes | Arithmetic triggers `.valueOf()` |
| `"Count: #{count}"` | Yes | Interpolation triggers `.toString()` |
| `console.log count` | Yes | Coercion triggers `.valueOf()` |
| `count.value` | Yes | Direct `.value` access |
| `count.read()` | No | Explicit non-tracking read |
| `y = count` | No | Assigns state object, not value |

## Reactive Variable Methods

| Method | Purpose |
|--------|---------|
| `x.read()` | Get value without tracking |
| `x.value` | Direct access to underlying value |
| `+x` | Shorthand for `x.value` |
| `x.lock()` | Make readonly (subscriptions stay active) |
| `x.free()` | Unsubscribe from dependencies |
| `x.kill()` | Clean up everything, return final value |

## Effect Controller Methods

| Method | Purpose |
|--------|---------|
| `e.stop!` | Pause reactions (can resume) |
| `e.run!` | Resume reactions |
| `e.cancel!` | Permanent disposal |
| `e.active` | Boolean — is the effect running? |

## When to Use What

| Need | Use | Example |
|------|-----|---------|
| Mutable state that triggers updates | `:=` | `count := 0` |
| Computed value from other state | `~=` | `total ~= price * qty` |
| Side effect on change | `~>` | `~> save(data)` |
| Controllable side effect | `x ~>` | `saver ~> save(data)` |
| Immutable constant | `=!` | `API_URL =! "..."` |
| Regular variable | `=` | `temp = calculate()` |

## How It Works

```coffee
# Rip source
count := 0
doubled ~= count * 2
~> console.log count
```

```javascript
// Compiled output (conceptual)
const count = __state(0);
const doubled = __computed(() => count.value * 2);
__effect(() => { console.log(count.value); });
```

The reactive runtime is **automatically inlined** when needed. Non-reactive code produces clean output with no runtime overhead.

## Effect Cleanup

Effects may return a cleanup function that runs before re-execution and on disposal:

```coffee
~>
  id = setInterval tick, 1000
  -> clearInterval id              # cleanup: returned arrow function
```

This enables higher-level reactive utilities — without adding anything to the language.

## Timing Primitives

Unlike React's `useTransition` or Vue's flush modes, Rip does not add timing to the framework. Timing composes from the triad:

```coffee
# Delay — truthy after source is stable for N ms, falsy immediately
showLoading := delay 200 -> loading

# Debounce — propagates after value stops changing for N ms
debouncedQuery := debounce 300 -> query

# Throttle — at most one update per N ms
smoothScroll := throttle 100 -> scrollY

# Hold — once true, stays true for at least N ms
showSaved := hold 2000 -> saved
```

All four are implemented using `:=` (output signal) + `~>` (watches source, manages timers) + effect cleanup (cancels pending timers). No new compiler features, no scheduler.

### Writable Timing Signals

Timing utilities can wrap a source signal directly:

```coffee
navigating = delay 100, __state(false)
```

Reads return the delayed value; writes update the source immediately. A drop-in replacement for `__state` with asymmetric behavior.

## Types and Reactivity

Reactive operators work with Rip's optional type system:

```coffee
count:: number := 0               # Typed state
doubled:: number ~= count * 2     # Typed computed
```

Type annotations are erased from `.js` output. In `.d.ts` output, reactive state emits `Signal<T>` and computed values emit `Computed<T>`:

```ts
declare const count: Signal<number>;
declare const doubled: Computed<number>;
```

## Two-Way Binding (`<=>`)

The `<=>` operator creates bidirectional reactive bindings inside render blocks.
It connects a parent's reactive state to a child element or component — changes
flow in both directions automatically. This is a Rip original.

### With HTML Elements

```coffee
export Form = component
  @name := ''
  @age := 25
  @agree := false

  render
    input value <=> @name                           # text input
    input type: "number", value <=> @age            # number input
    input type: "checkbox", checked <=> @agree      # checkbox
    p "#{@name}, age #{@age}, agreed: #{@agree}"
```

`value <=> @name` compiles to two things:
1. **State → DOM**: an effect that sets `el.value = name` whenever `name` changes
2. **DOM → State**: an event listener that sets `name = e.target.value` on input

The compiler auto-detects types:
- Text inputs use the `input` event and `e.target.value`
- Number/range inputs use `e.target.valueAsNumber`
- Checkboxes use the `change` event and `e.target.checked`

### With Components

`<=>` works with custom components using the same syntax:

```coffee
export App = component
  @selected := 'viewer'
  @showDialog := false
  @darkMode := false

  render
    Select value <=> @selected
      Option value: "viewer", "Viewer"
      Option value: "editor", "Editor"
      Option value: "admin",  "Admin"
    Switch checked <=> @darkMode, "Dark mode"
    Dialog open <=> @showDialog
      p "Are you sure?"
    p "Role: #{@selected}"
```

The parent owns the state. The child reads it and writes back to it. No
callback props, no `onChange` handlers, no `onOpenChange`, no `setValue`.

### Why This Matters

React requires explicit `value` + `onChange` pairs for every bindable property.
This is the "controlled component" pattern — the single most tedious aspect of
React development:

```jsx
// React: 8 lines of wiring for 4 controls
const [name, setName] = useState('');
const [role, setRole] = useState('viewer');
const [notify, setNotify] = useState(true);
const [show, setShow] = useState(false);

<input value={name} onChange={e => setName(e.target.value)} />
<Select value={role} onValueChange={setRole} />
<Switch checked={notify} onCheckedChange={setNotify} />
<Dialog open={show} onOpenChange={setShow} />
```

Rip eliminates all of it:

```coffee
# Rip: 4 state declarations, 4 bindings, zero callbacks
@name := ''
@role := 'viewer'
@notify := true
@show := false

input value <=> @name
Select value <=> @role
Switch checked <=> @notify
Dialog open <=> @show
```

Vue has `v-model`. Svelte has `bind:`. But Rip's `<=>` is cleaner — it works
uniformly across HTML elements and custom components with the same syntax, the
same operator, and the same mental model. No framework-specific directives, no
special component protocol. Just a reactive binding that flows both ways.

### Auto-Detection

Even without `<=>`, the compiler auto-detects when `value:` or `checked:` is
bound to a reactive expression and generates two-way binding automatically:

```coffee
# These are equivalent:
input value <=> @name           # explicit
input value: @name              # auto-detected (name is reactive)
```

---

# 7. Async Patterns

## The Dammit Operator (`!`)

The `!` suffix **calls AND awaits** a function:

```coffee
# Without dammit
user = await getUser(id)
posts = await getPosts(user.id)

# With dammit
user = getUser!(id)
posts = getPosts!(user.id)

# No arguments — still calls
data = fetchLatest!
# Compiles to: await fetchLatest()
```

## Auto-Async Detection

Functions containing `await` or `!` are automatically async:

```coffee
def loadUserData(id)
  user = getUser!(id)
  posts = getPosts!(user.id)
  friends = getFriends!(user.id)
  {user, posts, friends}
# Compiles to: async function loadUserData(id) { ... }
```

## Async Patterns

```coffee
# Sequential (use when order matters)
def processSequential(ids)
  for id in ids
    result = process!(id)
    console.log result

# Parallel (use for independent operations)
def processParallel(ids)
  results = await Promise.all(ids.map (id) -> process(id))
  results

# Error handling
def safeFetch(url)
  try
    response = fetch!(url)
    response.json!
  catch error
    console.error "Failed:", error
    null
```

## Async Iteration

```coffee
# Long form
for await x as iterable
  console.log x

# Shorthand with as!
for x as! iterable
  console.log x
```

---

# 8. Modules & Imports

```coffee
# Named imports
import { readFile, writeFile } from "fs"

# Default import
import express from "express"

# Namespace import
import * as path from "path"

# Mixed
import React, { useState } from "react"

# Relative paths
import { utils } from "./utils.rip"
```

```coffee
# Named exports
export def processData(data)
  data.map (x) -> x * 2

export config = {
  timeout: 5000
  retries: 3
}

export class DataProcessor
  process: (data) -> data

# Default export
export default {
  process: processData
  config
}
```

---

# 9. Regex Features

## Match Operator (`=~`)

```coffee
# Basic matching — captures stored in _
if text =~ /pattern/
  console.log "Found:", _[0]

# Capture groups
email = "user@example.com"
if email =~ /(.+)@(.+)/
  username = _[1]  # "user"
  domain = _[2]    # "example.com"

# Phone parsing
phone = "2125551234"
if phone =~ /^(\d{3})(\d{3})(\d{4})$/
  formatted = "(#{_[1]}) #{_[2]}-#{_[3]}"
```

## Regex Indexing

```coffee
# Extract match directly
domain = "user@example.com"[/@(.+)$/, 1]  # "example.com"
word = "hello world"[/\w+/]                # "hello"
zip = "12345-6789"[/^(\d{5})/, 1]          # "12345"
```

## Heregex (Extended Regex)

```coffee
pattern = ///
  ^                 # Start
  (\d{3})           # Area code
  [-.\s]?           # Optional separator
  (\d{3})           # Exchange
  [-.\s]?           # Optional separator
  (\d{4})           # Subscriber
  $                 # End
///
```

## Validator Pattern

```coffee
validators =
  email:    (v) -> v[/^([^@]+)@([^@]+\.[a-z]{2,})$/i] and _[0]
  phone:    (v) -> v[/^(\d{10})$/] and _[1]
  zip:      (v) -> v[/^(\d{5})/] and _[1]
  ssn:      (v) -> v[/^(\d{3})-?(\d{2})-?(\d{4})$/] and "#{_[1]}#{_[2]}#{_[3]}"
  truthy:   (v) -> (v =~ /^(true|t|1|yes|y|on)$/i) and true
  falsy:    (v) -> (v =~ /^(false|f|0|no|n|off)$/i) and true
```

## Security

By default, `=~` rejects strings with newlines to prevent injection:

```coffee
userInput = "test\nmalicious"
userInput =~ /^test$/   # Returns null (newline detected)

# Explicit multiline when needed
text = "line1\nline2"
text =~ /line2/m        # Works with /m flag
```

---

# 10. Packages

Rip includes optional packages for full-stack development. All are written in Rip, have zero dependencies, and run on Bun.

```bash
bun add @rip-lang/api            # Web framework
bun add @rip-lang/server         # Production server
bun add @rip-lang/grid           # Reactive data grid
bun add @rip-lang/db             # DuckDB server + client
bun add @rip-lang/schema         # ORM + validation
bun add @rip-lang/swarm          # Parallel job runner
bun add @rip-lang/csv            # CSV parser + writer
```

## @rip-lang/api — Web Framework

Sinatra-style routing with `@` context magic and built-in validators.

```coffee
import { get, post, use, read, start, notFound } from '@rip-lang/api'

# Routes — return data directly
get '/' -> { message: 'Hello!' }
get '/users/:id' -> User.find!(read 'id', 'id!')

# Form validation with read()
post '/signup' ->
  email = read 'email', 'email!'           # required email
  age   = read 'age', 'int', [18, 120]     # integer between 18-120
  role  = read 'role', ['admin', 'user']   # enum
  { success: true, email, age, role }

# File serving
get '/css/*' -> @send "public/#{@req.path.slice(5)}"
notFound -> @send 'index.html', 'text/html; charset=UTF-8'

# Middleware
import { cors, logger, sessions } from '@rip-lang/api/middleware'

use logger()
use cors origin: '*'
use sessions secret: process.env.SECRET

# Lifecycle hooks
before -> @start = Date.now()
after -> console.log "#{@req.method} #{@req.path} - #{Date.now() - @start}ms"

start port: 3000
```

### read() Validators

```coffee
id    = read 'id', 'id!'        # positive integer (required)
count = read 'count', 'whole'   # non-negative integer
price = read 'price', 'money'   # cents (multiplies by 100)
name  = read 'name', 'string'   # collapses whitespace
email = read 'email', 'email'   # valid email format
phone = read 'phone', 'phone'   # US phone → (555) 123-4567
state = read 'state', 'state'   # two-letter → uppercase
zip   = read 'zip', 'zip'       # 5-digit zip
url   = read 'url', 'url'       # valid URL
uuid  = read 'id', 'uuid'       # UUID format
date  = read 'date', 'date'     # YYYY-MM-DD
time  = read 'time', 'time'     # HH:MM or HH:MM:SS
flag  = read 'flag', 'bool'     # boolean
tags  = read 'tags', 'array'    # must be array
ids   = read 'ids', 'ids'       # "1,2,3" → [1, 2, 3]
slug  = read 'slug', 'slug'     # URL-safe slug
```

## @rip-lang/server — Production Server

Multi-worker process manager with hot reload, automatic HTTPS, and mDNS.

```bash
rip-server                # Start (uses ./index.rip)
rip-server -w             # With file watching + hot-reload
rip-server myapp          # Named (accessible at myapp.local)
rip-server http:3000      # HTTP on specific port
```

## Rip UI — Reactive Web Framework (built into rip-lang)

Zero-build reactive framework. Ships the compiler to the browser and compiles `.rip` components on demand. File-based routing, unified reactive stash, and SSE hot reload.

```coffee
# Server setup (index.rip)
import { get, use, start, notFound } from '@rip-lang/api'
import { serve } from '@rip-lang/api/serve'

dir = import.meta.dir
use serve dir: dir, watch: true
get '/css/*' -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

```coffee
# Component (routes/counter.rip)
Counter = component
  @count := 0
  doubled ~= @count * 2

  increment: -> @count += 1

  render
    div.counter
      h1 "Count: #{@count}"
      p "Doubled: #{doubled}"
      button @click: @increment, "+"
```

## @rip-lang/db — DuckDB Server + Client

HTTP server for DuckDB with the official DuckDB UI built in, plus an ActiveRecord-style client library.

```bash
rip-db                          # In-memory database
rip-db mydata.duckdb            # File-based database
```

```coffee
# Client library
import { connect, query, findAll, Model } from '@rip-lang/db/client'

connect 'http://localhost:4213'

users = findAll! "SELECT * FROM users WHERE role = $1", ['admin']

User = Model 'users'
user = User.find! 42
User.where(active: true).order('name').limit(10).all!
```

## @rip-lang/swarm — Parallel Job Runner

```coffee
import { swarm, init, retry, todo } from '@rip-lang/swarm'

setup = ->
  unless retry()
    init()
    for i in [1..100] then todo(i)

perform = (task, ctx) ->
  await Bun.sleep(Math.random() * 1000)

swarm { setup, perform }
```

## @rip-lang/csv — CSV Parser + Writer

```coffee
import { CSV } from '@rip-lang/csv'

# Parse
rows = CSV.read "name,age\nAlice,30\nBob,25\n", headers: true
# [{name: 'Alice', age: '30'}, {name: 'Bob', age: '25'}]

# Write
CSV.save! 'output.csv', rows
```

## @rip-lang/schema — ORM + Validation

```coffee
import { Model } from '@rip-lang/schema'

class User extends Model
  @table = 'users'
  @schema
    name:  { type: 'string', required: true }
    email: { type: 'email', unique: true }

user = User.find!(25)
user.name = 'Alice'
user.save!()
```

## Full-Stack Example

A complete API server in Rip:

```coffee
import { get, post, use, read, start, notFound } from '@rip-lang/api'
import { cors, logger } from '@rip-lang/api/middleware'

use logger()
use cors origin: '*'

# In-memory store
users = []
nextId = 1

get '/api/users' -> users

get '/api/users/:id' ->
  id = read 'id', 'id!'
  user = users.find (u) -> u.id is id
  user or throw { status: 404, message: 'Not found' }

post '/api/users' ->
  name = read 'name', 'string!'
  email = read 'email', 'email!'
  user = { id: nextId++, name, email }
  users.push user
  user

notFound -> { error: 'Not found' }

start port: 3000
```

---

# 11. CLI Tools & Scripts

```coffee
# Basic CLI tool
import { argv } from "process"

args = argv.slice(2)

if args.length is 0
  console.log "Usage: rip greet.rip <name>"
  process.exit(1)

name = args[0]
console.log "Hello, #{name}!"
```

```coffee
# File processing
import { readFileSync, writeFileSync, readdirSync } from "fs"
import { join, extname } from "path"

INPUT_DIR =! "./input"
OUTPUT_DIR =! "./output"

files = readdirSync(INPUT_DIR).filter (f) -> extname(f) is ".txt"

for filename in files
  content = readFileSync(join(INPUT_DIR, filename), "utf-8")
  processed = content.split("\n").filter((l) -> l.trim().length > 0).join("\n")
  writeFileSync(join(OUTPUT_DIR, filename), processed)
  console.log "Processed: #{filename}"
```

---

# 12. Types

Rip supports an optional, compile-time-only type system. Types are erased from
`.js` output and preserved in `.d.ts` declaration files.

```coffee
# Type annotations (::)
count:: number = 0
def greet(name:: string):: string
  "Hello, #{name}!"

# Type aliases (::=)
ID ::= number
User ::= type
  id: number
  name: string

# Interfaces
interface Animal
  name: string

# Enums (emit runtime JS)
enum HttpCode
  ok = 200
  notFound = 404
```

Types use `=>` for function type arrows and `->` for code arrows. This
disambiguates type expressions from function bodies cleanly.

For the complete type system specification, see [RIP-TYPES.md](RIP-TYPES.md).

---

# 13. JavaScript Interop

```coffee
# Import any npm package
import express from "express"
import { z } from "zod"
import axios from "axios"

# JavaScript functions work directly
console.log("Hello")
Math.max(1, 2, 3)
JSON.stringify({a: 1})
Object.keys(obj)

# DOM APIs (in browser)
document.getElementById("app")
element.addEventListener "click", handler
```

```javascript
// Call Rip from JavaScript
import { processData } from "./utils.rip";

// Or compile at runtime
import { compile } from "rip-lang";
const { code } = compile('x = 42');
```

---

# 14. Common Patterns

## Error Handling

```coffee
try
  data = fetchData!(url)
  process(data)
catch error
  console.error "Failed:", error.message
finally
  cleanup()

# Otherwise operator for defaults
value = riskyOperation() !? "default"

# Optional chaining for safety
name = user?.profile?.name ?? "Anonymous"
```

## Configuration

```coffee
export default
  api:
    baseUrl: process.env.API_URL ?? "http://localhost:3000"
    timeout: parseInt(process.env.TIMEOUT) or 5000
  database:
    host: process.env.DB_HOST ?? "localhost"
    port: parseInt(process.env.DB_PORT) or 5432
```

## Builder Pattern

```coffee
class QueryBuilder
  constructor: ->
    @_select = "*"
    @_from = null
    @_where = []
    @_limit = null

  select: (fields) -> (@_select = fields; @)
  from: (table) -> (@_from = table; @)
  where: (condition) -> (@_where.push(condition); @)
  limit: (n) -> (@_limit = n; @)

  build: ->
    sql = "SELECT #{@_select} FROM #{@_from}"
    sql += " WHERE #{@_where.join(' AND ')}" if @_where.length
    sql += " LIMIT #{@_limit}" if @_limit
    sql

query = new QueryBuilder()
  .select("id, name")
  .from("users")
  .where("active = true")
  .limit(10)
  .build()
```

## Event Emitter

```coffee
class EventEmitter
  constructor: ->
    @_listeners = {}

  on: (event, callback) ->
    @_listeners[event] ?= []
    @_listeners[event].push(callback)
    @

  emit: (event, ...args) ->
    return @ unless @_listeners[event]
    for callback in @_listeners[event]
      callback(...args)
    @
```

---

# 15. Quick Reference

## Syntax Cheat Sheet

```coffee
# Variables
x = 5           # let
x =! 5          # const
x := 5          # state (reactive)
x ~= y * 2      # computed (reactive)

# Functions
def fn(a, b)    # named function
  a + b
fn = (a) -> a   # arrow (unbound this)
fn = (a) => a   # fat arrow (bound this)
def fn!         # void function

# Control
if x then a else b
x ? a : b
switch x
  when 1 then "one"
  else "other"

# Loops
for x in arr
for k, v of obj
for x as iterable
for x as! asyncIterable
while cond
until cond

# Classes
class X extends Y
  constructor: (@a) ->
  method: -> @a
X.new(a: 1)

# Operators
a!             # await a()
a !? b         # a if defined, else b
a // b         # floor divide
a %% b         # true modulo
a =~ /pat/     # regex match, captures in _
a[/pat/, 1]    # regex extract
a?             # existence check (a != null)
a ?? b         # nullish coalescing

# Two-way binding (render blocks)
input value <=> @name      # bidirectional reactive binding
Dialog open <=> @show      # works with components too
```

## File Templates

### API Server

```coffee
import { serve } from "bun"

serve
  port: 3000
  fetch: (req) ->
    Response.json({message: "Hello!"})

console.log "Running on http://localhost:3000"
```

### Utility Module

```coffee
export def formatDate(date)
  date.toISOString().split("T")[0]

export def capitalize(str)
  str.charAt(0).toUpperCase() + str.slice(1)

export def sleep(ms)
  new Promise (resolve) -> setTimeout(resolve, ms)
```

### Reactive State

```coffee
count := 0
doubled ~= count * 2

~> console.log "Count: #{count}, Doubled: #{doubled}"

count = 5   # Logs: "Count: 5, Doubled: 10"
count = 10  # Logs: "Count: 10, Doubled: 20"
```

---

# 16. Future Ideas

Ideas and candidates that have been discussed but not yet implemented.

## Standard Library (`stdlib`)

Rip is a zero-dependency language, but a small standard library of useful
utilities would save users from writing the same one-liners in every project.
These are **not** language features — they're plain functions that could ship
as a prelude or optional import.

### Candidates

```coffee
# Printing (Ruby's p)
p = console.log

# Exit with optional code (uses implicit `it`)
exit = -> process.exit(it)

# Tap — call a function for side effects, return the original value
# Useful in pipe chains: data |> tap(console.log) |> process
tap = (v, fn) -> fn(v); v

# Identity — returns its argument unchanged
# Useful as a default callback: items.filter(id)
id = -> it

# No-op — does nothing
# Useful as a default handler: onClick ?= noop
noop = ->

# String method aliases (shorter names for common checks)
String::starts = String::startsWith
String::ends   = String::endsWith
String::has    = String::includes

# Clamp a value to a range
clamp = (v, lo, hi) -> Math.min(Math.max(v, lo), hi)

# Sleep for N milliseconds (returns a Promise)
sleep = (ms) -> new Promise (resolve) -> setTimeout resolve, ms

# Times helper — call a function N times, collect results
times = (n, fn) -> (fn(i) for i in [0...n])
```

### Design Questions

- **Prelude vs import?** Should these be injected automatically (like Go's
  `fmt` or Rip's reactive runtime), or explicitly imported (`import { p, tap }
  from '@rip-lang/std'`)? Leaning toward explicit — Rip's philosophy is zero
  magic in the output.

- **Scope?** Keep it tiny. A stdlib that grows to 500 functions defeats the
  purpose. Each entry should save real keystrokes on something people do
  constantly.

- **Node vs Browser?** Some helpers (like `exit`) are Node-only. Others (like
  `p`, `tap`, `sleep`) work everywhere. May want to split into `std` (universal)
  and `std/node` (server-only).

## Future Syntax Ideas

Each would need design discussion before building.

- **`defer`** — Go-style cleanup that runs when the function exits. Compiles
  to try/finally. `defer file.close()`.

- **Pattern matching** — `match value` with destructuring arms. Big feature,
  needs careful design.

- **Reactive resource operator (`~>?`)** — Language-level `createResource`.
  `user ~>? fetch!("/api/users/#{id}").json!` gives `user.loading`,
  `user.error`, `user.data`. Park until real-world usage shows demand.

- **Pipe operator (`|>`) — Hack-style placeholder** — Currently Rip uses
  Elixir-style first-arg insertion. A `%` placeholder for arbitrary position
  (`data |> fn(1, %, 3)`) could be added later if needed. Current design
  covers 95%+ of cases.

---

## Resources

- [Rip Playground](https://shreeve.github.io/rip-lang/) — Try Rip in the browser
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip) — IDE support
- [GitHub](https://github.com/shreeve/rip-lang) — Source code

| Document | Purpose |
|----------|---------|
| **[RIP-LANG.md](RIP-LANG.md)** | Full language reference (this file) |
| **[RIP-TYPES.md](RIP-TYPES.md)** | Type system specification |
| **[RIP-INTERNALS.md](RIP-INTERNALS.md)** | Compiler architecture & design decisions |
| **[AGENT.md](../AGENT.md)** | AI agent guide for working on the compiler |

---

*Rip 3.10 — 1,243 tests — Zero dependencies — Self-hosting — ~13,500 LOC*
