<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Special Operators - Complete Guide

## Dammit Operator (`!`)

**Feature:** Call-and-await shorthand operator
**Status:** ✅ Shipped in v0.3.4, Enhanced in v0.5.0
**Tests:** 29 tests, all passing
**Version:** 1.0.0

---

## What It Does

The **dammit operator (`!`)** is a trailing suffix that does TWO things:
1. **Calls the function** (even without parentheses)
2. **Awaits the result** (prepends `await`)

### Quick Examples

```coffeescript
# Simple call and await
result = fetchData!      # → await fetchData()

# With arguments
user = getUser!(id)      # → await getUser(id)

# Method calls
data = api.get!          # → await api.get()

# In expressions
total = 5 + getValue!    # → 5 + await getValue()
```

---

## Basic Usage

### 1. No Parens Needed

```coffeescript
# WITHOUT dammit - reference only
fn = loadConfig
typeof fn  # → 'function'

# WITH dammit - calls immediately
config = loadConfig!  # → await loadConfig()
```

**The `!` makes it a call, parens optional.**

### 2. With Arguments

```coffeescript
# ! signals await, parens provide args
result = fetchUser!(123)  # → await fetchUser(123)

# Multiple args
data = query!('SELECT *', params)  # → await query('SELECT *', params)
```

### 3. Method Calls

```coffeescript
# Property access + dammit
user = api.getUser!       # → await api.getUser()

# With args
posts = api.getPosts!(userId)  # → await api.getPosts(userId)

# Prototype
text = str::trim!         # → await str.prototype.trim()
```

### 4. In Data Structures

```coffeescript
# Arrays - each element awaited
[user!, posts!, stats!]   # Each call awaited

# Expressions
x = compute!() + process!()  # Both awaited
```

---

## Comparison: Before & After

### Before (Explicit Await)

```coffeescript
# Verbose, repetitive
user = await db.findUser(id)
posts = await db.getPosts(user.id)
comments = await db.getComments(posts[0].id)
result = await buildResponse(comments)
```

### After (Dammit Operator)

```coffeescript
# Clean, concise
user = db.findUser!(id)
posts = db.getPosts!(user.id)
comments = db.getComments!(posts[0].id)
result = buildResponse!(comments)
```

**Benefit:** ~50% shorter, same clarity, **zero performance traps**

---

## Dual Sigil System

### At Call-Site: Dammit Operator (`!`)

**Forces await on function calls:**
```coffeescript
result = fetchData!      # → await fetchData()
```

**Key behaviors:**
- Calls AND awaits
- Works on identifiers, methods, prototype access
- Functions containing `!` calls automatically become `async`

### At Definition-Site: Void Operator (`!`)

**Suppresses implicit returns (side-effect only functions):**
```coffeescript
def processItems!
  for item in items
    item.update()
  # ← Executes all statements, then returns undefined

# With explicit return (value stripped)
def validate!(x)
  return if x < 0     # → Just "return" (no value)
  console.log "valid"
  # ← Executes console.log, then returns undefined
```

**Compiled output:**
```javascript
function processItems() {
  for (const item of items) { item.update(); }
  return;  // ← Explicit void return
}

function validate(x) {
  if (x < 0) return;  // ← Value stripped
  console.log("valid");
  return;  // ← Always undefined
}
```

**Works with all function types:**
```coffeescript
c! = (x) ->              # Void thin arrow
  x * 2                  # Executes but doesn't return value

process! = (data) =>     # Void fat arrow
  data.toUpperCase()     # Executes but returns undefined
```

---

## Restrictions

### ❌ Cannot Use in Declarations (Call-Site Only)

```coffeescript
# ERROR: Can't use ! in variable names
getData! = -> Promise.resolve(42)  # ❌ Error!

# ERROR: Can't use ! in function names (unless void function)
# (See void function syntax above)

# CORRECT: Use at call-site only
getData = -> Promise.resolve(42)   # ✓ Define normally
result = getData!                  # ✓ Use ! when calling
```

**Exception:** `!` at definition creates void function (no implicit returns)

**Rationale:** `!` at call-site is a call marker; `!` at definition means void.

---

## Why This Operator Exists

### The Problem with Implicit Await

We analyzed full implicit await (all async calls await by default) and found **critical problems:**

**❌ Performance Footgun:**
```coffeescript
# Easy to accidentally serialize parallel operations
user = fetchUser(id)     # waits 1 second
posts = fetchPosts(id)   # waits 1 second
stats = fetchStats(id)   # waits 1 second
# Total: 3 seconds instead of 1 second!
```

**❌ In Loops - Devastating:**
```coffeescript
# 100 items × 100ms each = 10 seconds instead of 100ms
for url in urls
  data = fetch(url)  # Serialized!
```

**❌ Ecosystem Mismatch:**
- JavaScript tooling expects explicit `await`
- Linters don't understand implicit await
- Type checkers can't infer await points
- Stack traces harder to debug

See [Design Decisions](#design-rationale) for full analysis.

### The Dammit Operator Solution

**✅ 80% of ergonomic benefit**
**✅ 0% of performance risk**

The dammit operator provides cleaner syntax WITHOUT the performance traps:

| Feature | Implicit Await | Dammit Operator | Explicit Await |
|---------|----------------|-----------------|----------------|
| **Syntax** | `fetchData()` | `fetchData!` | `await fetchData()` |
| **Chars saved** | -6 | -3 | 0 (baseline) |
| **Performance trap?** | ❌ Yes (easy) | ✅ No (visible) | ✅ No (visible) |
| **Ecosystem compat** | ❌ Poor | ✅ Perfect | ✅ Perfect |
| **Explicit?** | ❌ No | ✅ Yes | ✅ Yes |
| **Ready now?** | ❌ No | ✅ Yes | ✅ Yes |

---

## Usage Guidelines

### ✅ When to Use `!`

**Sequential async code (most common case):**
```coffeescript
user = findUser!(id)
posts = getPosts!(user.id)
render!(user, posts)
```

**Simple async chains:**
```coffeescript
config = loadConfig!
db = connectDB!(config)
server = startServer!(db)
```

**API handlers (80% of async code):**
```coffeescript
get '/user/:id', (req) ->
  user = db.findUser!(req.params.id)
  posts = db.getPosts!(user.id)
  stats = db.getStats!(user.id)
  render('profile', {user, posts, stats})
```

### ❌ When NOT to Use `!`

**Parallel operations (use Promise.all):**
```coffeescript
# DON'T (serialized - slow):
a = fetch1!
b = fetch2!
c = fetch3!

# DO (parallel - fast):
[a, b, c] = await Promise.all([fetch1(), fetch2(), fetch3()])
```

**Function references (when you don't want to call):**
```coffeescript
# DON'T:
callback = processData!  # Calls it immediately!

# DO:
callback = processData   # Just a reference
```

**In loops (unless you mean it):**
```coffeescript
# DON'T (probably serialized):
for item in items
  result = process!(item)  # Each awaits before next!

# DO (parallel with comprehension):
results = await Promise.all (process(item) for item in items)
```

---

## How It Works

### Lexer (src/lexer.js)

**Line 1749:** Identifier regex already allowed trailing `!`
```javascript
IDENTIFIER = /^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+!?)([^\n\S]*:(?!:))?/;
//                                                  ^^
//                                          optional trailing !
```

**Lines 426-442:** Detect `!`, add metadata, strip from name
```javascript
if (id.length > 1 && id.endsWith('!')) {
  tokenData.await = true;  // Mark for await
  id = id.slice(0, -1);    // Strip ! from identifier name
}
```

### Parser

No changes needed! Grammar preserves String objects with metadata.

### Codegen (src/compiler.js)

**Lines 267-277:** Bare identifier with `!`
```javascript
if (sexpr instanceof String && sexpr.await === true) {
  const cleanName = sexpr.valueOf();
  return `await ${cleanName}()`;  // Add call + await
}
```

**Lines 936-940:** Property access with `!`
```javascript
if (prop instanceof String && prop.await === true) {
  const cleanProp = prop.valueOf();
  return `await ${base}.${cleanProp}()`;
}
```

**Lines 3183-3190:** Function call with `!`
```javascript
const needsAwait = headAwaitMetadata === true;
const callStr = `${calleeName}(${args})`;
return needsAwait ? `await ${callStr}` : callStr;
```

**Lines 4180-4215:** Async detection
```javascript
containsAwait(sexpr) {
  // Check for dammit operator
  if (sexpr instanceof String && sexpr.await === true) {
    return true;  // Contains await
  }
  // ... also checks explicit await nodes
}
```

---

## Design Rationale

### Why Not Full Implicit Await?

We thoroughly analyzed implicit await (all async calls await by default). Here's why we rejected it:

**1. Performance Footgun (Critical)** 🔴
- Easy to serialize parallel work accidentally
- Devastating in loops (10x slowdowns)
- Hard to spot in code review

**2. Ecosystem Mismatch**
- JS tooling expects explicit `await`
- TypeScript can't infer await points
- Breaks existing patterns

**3. Mental Model Confusion**
- Fights 10+ years of industry training
- Mixing contexts is confusing
- Callbacks become ambiguous

See full analysis in `docs-ORIG/ASYNC.md` for complete reasoning.

### Why Dammit Operator Works

**Advantages over full implicit await:**
- ✅ **Explicit** - Visual signal at every async call
- ✅ **No performance traps** - Each await is marked
- ✅ **Backwards compatible** - Purely additive feature
- ✅ **No ecosystem friction** - Generates standard `async/await`
- ✅ **Clear intent** - `!` says "I mean to await this"

**Better than bare `await`:**
- ✅ **Shorter** - `fetchData!` vs `await fetchData()`
- ✅ **Cleaner** - Less noise in sequential async code
- ✅ **Ruby-inspired** - Familiar from `method!` convention
- ✅ **Dual purpose** - Also calls without parens

---

## Future: Punt Operator (`&`)

The infrastructure is ready for the `&` operator to prevent await:

```coffeescript
# Future: Implicit await mode
result = fetchData()      # awaits by default (when mode enabled)
promise = &fetchData()    # opt-out with &
forced = fetchData!       # explicit await even in explicit mode

# Interaction:
fetchData!    # → await fetchData() (dammit forces)
&fetchData    # → fetchData() (punt prevents)
&fetchData!   # → fetchData() (punt wins, but ! still calls)
```

**Decision:** We'll evaluate punt operator based on dammit usage and feedback.

**Status:** Ready but not implemented (lexer/codegen prepared, commented out)

---

## Implementation Summary

### Code Changes

**Lexer (`src/lexer.js`):**
- Regex already supported `!` suffix on identifiers (line 1749)
- Added `.await = true` metadata to token data
- Strips `!` from identifier name
- ~15 lines added

**Parser:**
- No changes (String objects flow through)

**Codegen (`src/compiler.js`):**
- Detects `.await` property on String objects
- Converts `identifier!` → `await identifier()`
- Handles bare identifiers, calls with args, method calls, prototype access
- Updated `containsAwait()` to detect dammit operators
- Auto-marks functions as `async` when they contain `!` calls
- ~90 lines added

**Tests (`test/rip/async.rip`):**
- 29 comprehensive tests
- Execution tests (basic, args, methods, arrays, expressions)
- Code generation tests
- Validation tests (errors on invalid usage)
- All passing

### Metadata Flow

1. **Lexer:** Sees `fetchData!` token
   - Matches `IDENTIFIER` regex (includes `!`)
   - Creates String object with `.await = true`
   - Strips `!` from identifier name
   - Returns token `["IDENTIFIER", String("fetchData")]` where `fetchData.await === true`

2. **Parser:** Preserves String objects
   - Grammar returns the String object as-is
   - S-expression contains String objects with metadata intact

3. **Codegen:** Checks `.await` property
   - Before converting to primitive, saves `.await` value
   - If `.await === true`, wraps with `await` and adds `()`
   - Generates clean JavaScript

### Why This Design

✅ **Clean separation** - Lexer marks, codegen acts
✅ **Extensible** - Ready for `&` with minimal changes
✅ **Type-safe** - Uses existing String metadata pattern
✅ **Maintainable** - Clear flow, well-documented
✅ **Zero runtime overhead** - Pure syntactic sugar

---

## Performance

**No compilation overhead:**
- Lexer already scanned for `!` (regex had it)
- Metadata is free (existing String object pattern)
- Codegen just checks a boolean property
- Generated code is standard `async/await`

**Runtime:**
- Identical to writing `await` manually
- No extra function calls
- No wrappers
- Pure syntactic sugar

**Generated code quality:**
```coffeescript
# Input
user = getUser!(id)
posts = getPosts!(user.id)

# Output
async function() {
  let user, posts;
  user = await getUser(id);
  posts = await getPosts(user.id);
}
```

Clean, readable, standard JavaScript!

---

## Real-World Examples

### API Handler Pattern

**Before:**
```coffeescript
get '/user/:id', (req) ->
  user = await db.findUser(req.params.id)
  posts = await db.getPosts(user.id)
  stats = await db.getStats(user.id)
  await render('profile', {user, posts, stats})
```

**After:**
```coffeescript
get '/user/:id', (req) ->
  user = db.findUser!(req.params.id)
  posts = db.getPosts!(user.id)
  stats = db.getStats!(user.id)
  render!('profile', {user, posts, stats})
```

### Data Pipeline

**Before:**
```coffeescript
data = await loadData()
validated = await validate(data)
transformed = await transform(validated)
await save(transformed)
```

**After:**
```coffeescript
data = loadData!
validated = validate!(data)
transformed = transform!(validated)
save!(transformed)
```

### Error Handling

```coffeescript
try
  user = findUser!(id)      # Error throws HERE
  posts = getPosts!(user)   # Not here if findUser failed
catch err
  handleError(err)
```

Works naturally with try/catch at call sites!

---

## Best Practices

### ✅ DO: Sequential Operations

```coffeescript
# Clear, clean, explicit
config = loadConfig!
db = connectDB!(config)
server = startServer!(db)
```

### ✅ DO: Error Boundaries

```coffeescript
# Natural error handling
try
  result = riskyOperation!
  process!(result)
catch error
  logError!(error)
```

### ❌ DON'T: Parallel Operations

```coffeescript
# BAD: Serialized (slow)
a = fetch1!
b = fetch2!
c = fetch3!

# GOOD: Parallel (fast)
[a, b, c] = await Promise.all([
  fetch1()
  fetch2()
  fetch3()
])
```

### ❌ DON'T: In Tight Loops

```coffeescript
# BAD: Serializes every iteration
for item in items
  result = process!(item)  # Each awaits!

# GOOD: Parallel processing
results = await Promise.all (process(item) for item in items)
```

---

## Testing

### Comprehensive Test Suite

**29 tests in `test/rip/async.rip`:**

**Execution tests:**
- Basic dammit operator (bare identifier)
- With parameters
- Method calls (property access)
- Multiple calls in sequence
- No parens (proves ! calls the function)
- Redundant parens (fetchData!() works)
- Reference vs call comparison
- Actually calls (side effects verified)
- In expressions (arithmetic)
- In arrays (multiple awaits)

**Code generation tests:**
- Bare identifier compilation
- Method call compilation
- Auto-async detection

**Validation tests:**
- Error on ! in variable declaration
- Error on ! in function name (unless void function)

**All tests passing!** ✅

---

## Void Function Tests

**10 tests in `test/rip/functions.rip`:**

- Void function with def
- Void function with thin arrow
- Void function with fat arrow
- Explicit return (value stripped)
- Multi-statement body
- Side effects preserved
- Code generation validation

---

## Comparison with Other Languages

### Ruby
```ruby
# Exclamation convention (mutating methods)
str.upcase!    # Mutates in place
```

### Rip
```coffeescript
# Exclamation for await (non-mutating, just async)
result = fetchData!  # Awaits result
```

**Inspiration:** Ruby's `!` convention, but adapted for async/await

### JavaScript (Standard)
```javascript
const result = await fetchData();
```

### Rip
```coffeescript
result = fetchData!  # 3 fewer characters, same meaning
```

---

## Why Ship This?

### Pragmatic Decision

We wanted cleaner async syntax but found full implicit await has critical flaws (see ASYNC.md analysis).

**The dammit operator gives us:**
- ✅ Cleaner code (50% less await noise)
- ✅ Explicit semantics (every await visible)
- ✅ No performance traps (can't accidentally serialize)
- ✅ Ecosystem compatibility (generates standard async/await)
- ✅ Future-proof (enables punt operator later)

### Best of Both Worlds

| Aspect | Dammit Wins |
|--------|-------------|
| **vs. bare await** | Shorter, cleaner syntax |
| **vs. implicit await** | Explicit, safe, no traps |
| **vs. promises** | Natural error handling |

---

## Error Messages

**Invalid usage produces clear errors:**

```coffeescript
# Error: Can't use ! in variable declaration
getData! = -> 42
# Error: Cannot use ! sigil in variable declaration 'getData'.
#        Sigils are only for call-sites.

# Exception: Void functions are allowed
def process!()  # ✓ OK - void function syntax
  doWork()
```

---

## Roadmap

### v0.3.4
- ✅ Dammit operator (`!`) implemented
- ✅ Basic call-and-await functionality

### v0.5.0 (Current)
- ✅ Void function syntax (`!` at definition)
- ✅ Call-site validation
- ✅ Enhanced error messages
- ✅ Comprehensive tests (29 total)
- ✅ Documentation complete

### Future Considerations
- 📋 Punt operator (`&`) - if community wants it
- 📋 Implicit await mode - experimental branch only
- 📋 Linting for serial await patterns
- 📋 Performance hints in tooling

---

## Summary

**The dammit operator is production-ready:**

✅ **Syntax:** `fetchData!` → `await fetchData()`
✅ **Dual purpose:** Calls AND awaits
✅ **Safe:** Every await is explicit
✅ **Fast:** No performance traps
✅ **Clean:** 50% less syntax noise
✅ **Compatible:** Standard JavaScript output
✅ **Tested:** 29 comprehensive tests
✅ **Documented:** Complete guide and examples

**Recommendation:** Use for sequential async code. Avoid in loops and parallel operations.

**See Also:**
- [ASYNC.md](../docs-ORIG/ASYNC.md) - Full implicit await analysis
- [COMPREHENSIONS.md](COMPREHENSIONS.md) - Context-aware code generation
- [README.md](../README-ORIG.md) - User guide

---

**The dammit operator: Async syntax that doesn't compromise.** ⚡
