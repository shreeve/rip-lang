<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Language Reference

Rip is a modern reactive language that compiles to ES2022 JavaScript. It combines CoffeeScript's elegant syntax with built-in reactivity primitives. Zero dependencies, self-hosting, ~10,300 LOC.

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
10. [Server-Side Development](#10-server-side-development)
11. [CLI Tools & Scripts](#11-cli-tools--scripts)
12. [Types](#12-types)
13. [JavaScript Interop](#13-javascript-interop)
14. [Common Patterns](#14-common-patterns)
15. [Quick Reference](#15-quick-reference)

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

Works with any method — built-in or custom, with or without arguments.

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
| `:=` | State | "has state" | Reactive state variable |
| `~=` | Computed | "always equals" | Computed value (auto-updates) |
| `~>` | Effect | "reacts to" | Side effect on dependency change |
| `=!` | Readonly | "equals, dammit!" | Constant (`const`) |

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

# 10. Server-Side Development

## HTTP Server

```coffee
import { serve } from "bun"

serve
  port: 3000
  fetch: (req) ->
    url = new URL(req.url)
    switch url.pathname
      when "/"
        new Response("Hello from Rip!")
      when "/api/users"
        Response.json([{id: 1, name: "Alice"}])
      else
        new Response("Not Found", status: 404)

console.log "Server running on http://localhost:3000"
```

## REST API

```coffee
import { serve } from "bun"

db = {
  users: [
    {id: 1, name: "Alice", email: "alice@example.com"}
    {id: 2, name: "Bob", email: "bob@example.com"}
  ]
  nextId: 3
}

def parseBody(req)
  try
    req.json!
  catch
    null

serve
  port: 3000
  fetch: (req) ->
    {pathname} = new URL(req.url)
    method = req.method

    switch "#{method} #{pathname}"
      when "GET /api/users"
        Response.json(db.users)

      when /^GET \/api\/users\/(\d+)$/
        id = parseInt(_[1])
        user = db.users.find (u) -> u.id is id
        if user then Response.json(user)
        else Response.json({error: "Not found"}, status: 404)

      when "POST /api/users"
        body = parseBody!(req)
        user = {id: db.nextId++, ...body}
        db.users.push(user)
        Response.json(user, status: 201)

      else
        Response.json({error: "Not found"}, status: 404)
```

## WebSocket Server

```coffee
import { serve } from "bun"

clients = new Set()

serve
  port: 3000
  fetch: (req, server) ->
    if server.upgrade(req)
      return
    new Response("WebSocket server")

  websocket:
    open: (ws) ->
      clients.add(ws)
      console.log "Client connected (#{clients.size} total)"

    message: (ws, message) ->
      for client in clients
        client.send(message) unless client is ws

    close: (ws) ->
      clients.delete(ws)
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

*Rip 3.4 — 1,140 tests passing — Zero dependencies — Self-hosting — ~10,300 LOC*
