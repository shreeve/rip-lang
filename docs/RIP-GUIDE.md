<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Guide

A practical guide for using Rip in your projects. Rip is a modern language that compiles to ES2022 JavaScript. It runs on [Bun](https://bun.sh) and has zero dependencies.

---

## Getting Started

```bash
# Install Bun (if needed)
curl -fsSL https://bun.sh/install | bash

# Install Rip
bun add -g rip-lang

# Run a file
rip app.rip

# Interactive REPL
rip

# Compile to JavaScript
rip -c app.rip

# Compile with source map
rip -cm app.rip

# Generate .d.ts type declarations
rip -d app.rip
```

Rip files use the `.rip` extension. Bun runs them directly via `bun app.rip` or `rip app.rip`.

---

## Language Basics

Rip uses **significant whitespace** (indentation, not braces) and **implicit returns** (the last expression is the return value). Semicolons and parentheses are optional in most contexts.

### Variables

```coffee
# Assignment (compiles to let)
name = "Alice"
count = 0

# Constant ("equals, dammit!")
MAX =! 100

# Destructuring
{name, age} = person
[first, ...rest] = items
```

### Strings

```coffee
# Interpolation (both styles work)
greeting = "Hello, #{name}!"
greeting = "Hello, ${name}!"

# Heredocs (closing delimiter sets left margin)
html = """
    <div>
      <p>Hello</p>
    </div>
    """
```

### Functions

```coffee
# Named function
def greet(name)
  "Hello, #{name}!"

# Arrow function
add = (a, b) -> a + b

# Fat arrow (preserves this)
handler = (e) => @process(e)

# Default parameters
def greet(name = "World")
  "Hello, #{name}!"

# Void function (suppresses return)
def log!(message)
  console.log message
```

### Classes

```coffee
class Animal
  constructor: (@name) ->

  speak: -> "#{@name} makes a sound"

class Dog extends Animal
  speak: -> "#{@name} barks!"

# Ruby-style instantiation
dog = Dog.new "Buddy"
```

### Control Flow

```coffee
# If/else
if user.admin
  showAdmin()
else
  showUser()

# Ternary
status = active ? "on" : "off"

# Postfix
console.log "hi" if ready
return unless valid

# Switch
result = switch status
  when "active" then "Running"
  when "done" then "Complete"
  else "Unknown"
```

### Loops

```coffee
# Arrays
for item in items
  console.log item

for item, i in items     # with index
  console.log "#{i}: #{item}"

# Objects
for key, value of object
  console.log "#{key} = #{value}"

# Ranges
for i in [1..10]         # inclusive (1 to 10)
for i in [1...10]        # exclusive (1 to 9)

# Comprehensions
squares = (x * x for x in [1..10])
evens = (x for x in items when x % 2 is 0)
```

---

## Operators

Rip extends JavaScript with powerful operators:

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `!` | Dammit | `fetchData!` | `await fetchData()` |
| `!` | Void | `def log!` | Function returns `undefined` |
| `=!` | Readonly | `MAX =! 100` | `const MAX = 100` |
| `!?` | Otherwise | `val !? 5` | Default if undefined/throws |
| `?` | Existence | `x?` | `x != null` |
| `?.` | Optional chain | `a?.b?.c` | ES6 optional chaining |
| `?[]` | Optional index | `arr?[0]` | `arr?.[0]` |
| `??` | Nullish | `a ?? b` | ES6 nullish coalescing |
| `//` | Floor div | `7 // 2` | `3` |
| `%%` | True modulo | `-1 %% 3` | `2` (always positive) |
| `=~` | Regex match | `str =~ /pat/` | Match, captures in `_` |
| `:=` | State | `count := 0` | Reactive signal |
| `~=` | Computed | `doubled ~= x * 2` | Reactive computed |
| `~>` | Effect | `~> console.log x` | Reactive side effect |
| `**` | Power | `2 ** 10` | `1024` |
| `..` | Range | `[1..5]` | Inclusive range |
| `...` | Spread/rest | `[...a, ...b]` | ES6 spread |

### Dammit Operator (`!`)

The most distinctive Rip operator. Appended to a function call, it both calls AND awaits:

```coffee
# These are equivalent:
data = fetchUsers!
data = await fetchUsers()

# With arguments:
user = getUser!(id)
user = await getUser(id)

# Functions are auto-async when they contain !
def loadData(id)
  user = getUser!(id)
  posts = getPosts!(user.id)
  {user, posts}
# Compiles to: async function loadData(id) { ... }
```

### Regex Match (`=~`)

Ruby-style pattern matching with captures stored in `_`:

```coffee
if text =~ /Hello, (\w+)/
  console.log "Found: #{_[1]}"

# Direct extraction via regex indexing
domain = "user@example.com"[/@(.+)$/, 1]  # "example.com"
```

### Guard Clauses

```coffee
def loadUser(id)
  data = fetchUser!(id) or return {error: "Not found"}
  token = headers.auth or throw new Error "No auth"
  port = config.port ?? return 3000
```

### Implicit Commas

When a literal value is followed by an arrow function, Rip inserts a comma automatically:

```coffee
# Clean route handlers
get '/users' -> User.all!
get '/users/:id' -> User.find params.id
post '/users' -> User.create body
```

---

## Reactivity

Rip provides fine-grained reactivity as language-level operators, not library imports:

```coffee
# State — reactive container
count := 0

# Computed — derived value (lazy, cached)
doubled ~= count * 2
message ~= "Count is #{count}"

# Effect — side effect, re-runs when dependencies change
~> console.log "Count changed to #{count}"

# Update state (triggers dependents)
count = 5
# doubled is now 10
# effect logs: "Count changed to 5"
```

### Reactive Methods

```coffee
count := 0
count.read()   # Get value without tracking
count.lock()   # Make readonly
count.free()   # Unsubscribe from dependencies
count.kill()   # Clean up, return final value
```

---

## Type Annotations

Rip's optional type system adds annotations that are **erased** from JavaScript output and **emitted** as `.d.ts` files for TypeScript interoperability.

```coffee
# Annotate parameters and return types
def greet(name:: string):: string
  "Hello, #{name}!"

# Type aliases
User ::= type
  id: number
  name: string
  email?: string    # optional property

# Interfaces
interface Animal
  name: string
  speak: => void

# Enums (emit runtime JS + .d.ts)
enum Status
  Active
  Inactive
  Pending

# Generate .d.ts
# rip -d myfile.rip
```

---

## Modules

Standard ES6 module syntax:

```coffee
# Import
import express from 'express'
import { readFile } from 'fs'
import * as path from 'path'

# Export
export def processData(data)
  data.map (x) -> x * 2

export default { process: processData }

# Re-export
export { foo, bar } from './utils'
```

---

## Async Patterns

```coffee
# Traditional await
user = await getUser(id)

# Dammit operator (call + await)
user = getUser!(id)
posts = getPosts!(user.id)

# Error handling
try
  data = fetchData!
catch error
  console.error error

# Async iteration
for item as! asyncIterable
  console.log item
```

---

## Packages

Rip includes optional packages for full-stack development. All are written in Rip, have zero dependencies, and run on Bun.

```bash
bun add @rip-lang/api            # Web framework
bun add @rip-lang/server         # Production server
bun add @rip-lang/db             # DuckDB server
bun add @rip-lang/ui             # Reactive web UI
bun add @rip-lang/schema         # ORM + validation
bun add @rip-lang/swarm          # Parallel job runner
bun add @rip-lang/csv            # CSV parser + writer
```

### @rip-lang/api — Web Framework

Sinatra-style routing with `@` context magic and 37 built-in validators.

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

#### read() Validators

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

### @rip-lang/server — Production Server

Multi-worker process manager with hot reload, HTTPS, and mDNS.

```bash
rip-server                # Start (uses ./index.rip)
rip-server -w             # With file watching + hot-reload
rip-server myapp          # Named (accessible at myapp.local)
rip-server http:3000      # HTTP on specific port
```

### @rip-lang/db — DuckDB Server

HTTP server for DuckDB with JSONCompact responses.

```bash
rip-db mydata.duckdb --port=4000
```

```coffee
# Query from Rip
import { get, start } from '@rip-lang/api'
import { DB } from '@rip-lang/db'

db = DB.new 'data.duckdb'

get '/users' -> db.query! "SELECT * FROM users"
get '/users/:id' -> db.query! "SELECT * FROM users WHERE id = ?", [read 'id', 'id!']

start port: 3000
```

### @rip-lang/ui — Reactive Web Framework

Zero-build framework. The browser loads the Rip compiler, compiles the UI
framework, fetches an app bundle, and renders. No build step, no bundler.

```coffee
# Server (index.rip)
import { get, use, start, notFound } from '@rip-lang/api'
import { ripUI } from '@rip-lang/ui/serve'

dir = import.meta.dir
use ripUI dir: dir, watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

```html
<!-- index.html -->
<script type="module" src="/rip/browser.js"></script>
<script type="text/rip">
  { launch } = importRip! '/rip/ui.rip'
  launch()
</script>
```

```coffee
# Component (parts/counter.rip)
export Counter = component
  @count := 0
  doubled ~= @count * 2

  increment: -> @count += 1

  render
    div.counter
      h1 "Count: #{@count}"
      p "Doubled: #{doubled}"
      button @click: @increment, "+"
```

### @rip-lang/swarm — Parallel Job Runner

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

### @rip-lang/csv — CSV Parser + Writer

```coffee
import { CSV } from '@rip-lang/csv'

# Parse
rows = CSV.read "name,age\nAlice,30\nBob,25\n", headers: true
# [{name: 'Alice', age: '30'}, {name: 'Bob', age: '25'}]

# Write
CSV.save! 'output.csv', rows
```

### @rip-lang/schema — ORM + Validation

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

---

## Browser

Rip runs directly in the browser with full async/await support — no build step.

### Inline Scripts

Load the compiler, then write Rip:

```html
<script type="module" src="/rip/browser.js"></script>
<script type="text/rip">
  res = fetch! 'https://api.example.com/data'
  data = res.json!
  console.log data
</script>
```

The `!` operator works in inline scripts — `processRipScripts` wraps
compiled code in an async IIFE transparently.

### Console REPL

The `rip()` function is available in any browser console where `rip.browser.js`
is loaded:

```javascript
rip("42 * 10 + 8")                  // → 428
rip("name = 'Alice'")               // → 'Alice' (persists on globalThis)
rip("(x * x for x in [1..5])")      // → [1, 4, 9, 16, 25]

// Async — use await, Chrome displays the resolved value
await rip("res = fetch! 'https://jsonplaceholder.typicode.com/todos/1'; res.json!")
// → {userId: 1, id: 1, title: 'delectus aut autem', completed: false}
```

Sync code returns values directly. Async code (using `!`) returns a Promise
that Chrome auto-awaits. Variables persist between calls on `globalThis`.

### `importRip(url)`

Fetch, compile, and import a `.rip` file as an ES module:

```html
<script type="text/rip">
  { launch } = importRip! '/rip/ui.rip'
  launch '/demo'
</script>
```

---

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

## CLI Reference

```bash
rip                        # REPL
rip file.rip               # Run
rip -c file.rip            # Compile to JS (stdout)
rip -o out.js file.rip     # Compile to file
rip -m file.rip            # Compile with inline source map
rip -d file.rip            # Generate .d.ts
rip -t file.rip            # Show tokens
rip -s file.rip            # Show S-expressions
rip -q -c file.rip         # Quiet (no headers)
bun run test               # Run test suite (1,140 tests)
```

---

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| **[RIP-GUIDE.md](RIP-GUIDE.md)** | Users / AI | Practical guide for using Rip in projects |
| **[AGENT.md](../AGENT.md)** | AI agents | Get up to speed for working on the compiler |
| **[RIP-LANG.md](RIP-LANG.md)** | Users | Full language reference |
| **[RIP-TYPES.md](RIP-TYPES.md)** | Contributors | Type system specification |
| **[RIP-REACTIVITY.md](RIP-REACTIVITY.md)** | Users | Reactivity deep dive |
| **[RIP-INTERNALS.md](RIP-INTERNALS.md)** | Contributors | Compiler architecture |

## Resources

- [Rip Playground](https://shreeve.github.io/rip-lang/) — Try Rip in the browser
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip) — IDE support
- [GitHub](https://github.com/shreeve/rip-lang) — Source code

---

*Rip — Start simple. Build incrementally. Ship elegantly.*
