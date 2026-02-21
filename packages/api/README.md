<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip API - @rip-lang/api

> **A fast, elegant API framework with zero dependencies — written entirely in Rip**

Rip API is a complete HTTP framework for building APIs with Bun. It provides
Sinatra-style routing, Koa-style middleware composition, 37 built-in validators,
and powerful session management — all in two files with no external dependencies.
It powers [@rip-lang/db](https://github.com/shreeve/rip-lang/tree/main/packages/db)
and is designed for APIs that are clear, concise, and correct.

## Features

- **Zero dependencies** — Pure Rip implementation, no external frameworks
- **Sinatra-style handlers** — Return data directly, no ceremony
- **Magic `@` access** — `@req`, `@json()`, `@session` like Sinatra
- **37 built-in validators** — Elegant `read()` function for parsing and validation
- **Lifecycle filters** — `raw` → `before` → handler → `after` hooks
- **AsyncLocalStorage context** — `read()` and `session` work anywhere, no prop drilling
- **File serving** — `@send` with auto-detected MIME types and `Bun.file()` streaming
- **Hono-compatible API** — Easy migration from existing Hono apps

| File | Lines | Role |
|------|-------|------|
| `api.rip` | ~640 | Core framework: routing, validation, `read()`, `session`, file serving, server |
| `middleware.rip` | ~465 | Built-in middleware: cors, logger, sessions, compression, security |

> **See Also**: For Rip language documentation, see the [main rip-lang repository](https://github.com/shreeve/rip-lang) and [docs/RIP-LANG.md](https://github.com/shreeve/rip-lang/blob/main/docs/RIP-LANG.md).

## Try it Now

Create `app.rip`:

```coffee
import { get, post, read, session, start, use, before } from '@rip-lang/api'
import { sessions } from '@rip-lang/api/middleware'

use sessions()  # Add secret: 'your-secret' for production

before ->
  session.views ?= 0
  session.views += 1

get '/' -> 'Hello, World!'
get '/json' -> { message: 'It works!', timestamp: Date.now() }
get '/users/:id' -> { user: { id: read('id', 'id!') } }
get '/session' -> { views: session.views, loggedIn: session.userId? }
get '/login' -> session.userId = 123; { loggedIn: true, userId: 123 }
get '/logout' -> delete session.userId; { loggedOut: true }

start port: 3000
```

Run it:

```bash
rip app.rip
```

**Test the endpoints:**

```bash
# Basic routes
curl http://localhost:3000/
curl http://localhost:3000/json
curl http://localhost:3000/users/42

# Session demo (use -c/-b for cookies)
curl -c cookies.txt -b cookies.txt http://localhost:3000/session
# {"views":1,"loggedIn":false}

curl -c cookies.txt -b cookies.txt http://localhost:3000/session
# {"views":2,"loggedIn":false}

curl -c cookies.txt -b cookies.txt http://localhost:3000/login
# {"loggedIn":true,"userId":123}

curl -c cookies.txt -b cookies.txt http://localhost:3000/session
# {"views":4,"userId":123,"loggedIn":true}

curl -c cookies.txt -b cookies.txt http://localhost:3000/logout
# {"loggedOut":true}

# POST with validation
curl -X POST http://localhost:3000/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","age":25}'
```

## Quick Start

### Installation

```bash
bun add @rip-lang/api
```

### Basic Usage

```coffee
import { get, post, use, read, start } from '@rip-lang/api'

# Context-free handlers — just return data!
# Note: In Rip, the comma after a string/regex is optional when immediately
# followed by an arrow function. So `get '/', ->` can be `get '/' ->`
get '/' -> 'Hello, World!'

get '/json' -> { message: 'It works!', timestamp: Date.now() }

# Path parameters
get '/users/:id' ->
  id = read 'id', 'id!'
  { user: { id, name: "User #{id}" } }

# Form validation
post '/signup' ->
  email = read 'email', 'email!'
  phone = read 'phone', 'phone'
  age   = read 'age', 'int', [18, 120]
  { success: true, email, phone, age }

start port: 3000
```

### With Context (when needed)

```coffee
# Access full context for headers, redirects, etc.
# Note: Comma IS needed when there's a parameter between the path and arrow
get '/download/:id', (env) ->
  env.header 'Content-Disposition', 'attachment'
  env.body getFile!(read 'id', 'id!')

get '/redirect', (env) ->
  env.redirect 'https://example.com'

get '/custom', (env) ->
  env.json { created: true }, 201
```

## The `read()` Function

The crown jewel of `@rip-lang/api` — a validation and parsing powerhouse that eliminates 90% of API boilerplate.

### Basic Patterns

```coffee
# Required field (throws if missing)
email = read 'email', 'email!'

# Optional field (returns null if missing)
phone = read 'phone', 'phone'

# With default value
role = read 'role', ['admin', 'user'], 'user'

# Get entire payload
data = read()
```

### Range Validation

The `[min, max]` syntax works for both numbers and string lengths:

```coffee
# Numbers: value range
age = read 'age', 'int', [18, 120]        # Between 18 and 120
priority = read 'priority', 'int', [1, 10]  # 1-10 range

# Strings: length range
username = read 'username', 'string', [3, 20]  # 3-20 characters
bio = read 'bio', 'string', [0, 500]           # Up to 500 chars

# Numbers: value range
views = read 'views', 'int', min: 0            # Non-negative integer
discount = read 'discount', 'number', max: 100  # Up to 100
```

### Enumeration Validation

```coffee
# Must be one of these values
role = read 'role', ['admin', 'user', 'guest']
status = read 'status', ['pending', 'active', 'closed']
```

### Regex Validation

```coffee
# Custom pattern matching
code = read 'code', /^[A-Z]{3,6}$/
```

## Built-in Validators

`@rip-lang/api` includes 37 validators for every common API need:

### Numbers & Money
```coffee
id = read 'user_id', 'id!'       # Positive integer (1+)
count = read 'count', 'whole'    # Non-negative integer (0+)
price = read 'price', 'decimal'  # Decimal number
cost = read 'cost', 'money'      # Cents (multiplies by 100)
```

### Text Processing
```coffee
title = read 'title', 'string'   # Collapses whitespace
bio = read 'bio', 'text'         # Light cleanup
name = read 'name', 'name'       # Trims and normalizes
```

### Contact Information
```coffee
email = read 'email', 'email'        # Valid email format
phone = read 'phone', 'phone'        # US phone → (555) 123-4567
address = read 'address', 'address'  # Trimmed address
```

### Geographic Data
```coffee
state = read 'state', 'state'      # Two-letter → uppercase
zip = read 'zip', 'zip'            # 5-digit zip
zipplus4 = read 'zip', 'zipplus4'  # 12345-6789 format
```

### Identity & Security
```coffee
ssn = read 'ssn', 'ssn'                # SSN → digits only
sex = read 'gender', 'sex'             # m/f/o
username = read 'username', 'username' # 3-20 chars, lowercase
```

### Web & Technical
```coffee
url = read 'website', 'url'      # Valid URL
ip = read 'ip_address', 'ip'     # IPv4 address
mac = read 'mac', 'mac'          # MAC address
color = read 'color', 'color'    # Hex color → #abc123
uuid = read 'user_id', 'uuid'    # UUID format
semver = read 'version', 'semver' # Semantic version
```

### Time & Date
```coffee
time = read 'time', 'time'        # HH:MM or HH:MM:SS
date = read 'date', 'date'        # YYYY-MM-DD
time24 = read 'time', 'time24'    # 24-hour format
time12 = read 'time', 'time12'    # 12-hour with am/pm
```

### Boolean & Collections
```coffee
active = read 'active', 'truthy'    # true/t/1/yes/y/on → true
inactive = read 'off', 'falsy'      # false/f/0/no/n/off → true
flag = read 'flag', 'bool'          # Either → boolean
tags = read 'tags', 'array'         # Must be array
config = read 'config', 'hash'      # Must be object
settings = read 'data', 'json'      # Parse JSON string
ids = read 'ids', 'ids'             # "1,2,3" → [1, 2, 3]
slug = read 'slug', 'slug'          # URL-safe slug
```

### Custom Validators

Register your own validators:

```coffee
import { registerValidator, read } from '@rip-lang/api'

registerValidator 'postalCode', (v) ->
  if v =~ /^[A-Z]\d[A-Z] \d[A-Z]\d$/i
    _[0].toUpperCase()
  else
    null

# Now use it
code = read 'postal', 'postalCode!'
```

## Routing

### HTTP Methods

```coffee
import { get, post, put, patch, del, all } from '@rip-lang/api'

get    '/users'     -> listUsers!
post   '/users'     -> createUser!
get    '/users/:id' -> getUser!
put    '/users/:id' -> updateUser!
patch  '/users/:id' -> patchUser!
del    '/users/:id' -> deleteUser!
all    '/health'    -> 'ok'  # All methods
```

### Path Parameters

```coffee
# Basic parameters
get '/users/:id' ->
  id = read 'id', 'id!'
  { id }

# Multiple parameters
get '/users/:userId/posts/:postId' ->
  userId = read 'userId', 'id!'
  postId = read 'postId', 'id!'
  { userId, postId }

# Custom patterns
get '/files/:name{[a-z]+\\.txt}' ->
  name = read 'name'
  { file: name }

# Wildcards
get '/static/*', (env) ->
  { path: env.req.path }
```

### Route Grouping

```coffee
import { prefix } from '@rip-lang/api'

prefix '/api/v1' ->
  get '/users' -> listUsers!
  get '/posts' -> listPosts!

prefix '/api/v2' ->
  get '/users' -> listUsersV2!
```

## Middleware

### Built-in Middleware

Import from `@rip-lang/api/middleware`:

```coffee
import { use } from '@rip-lang/api'
import { cors, logger, compress, sessions, secureHeaders, timeout, bodyLimit } from '@rip-lang/api/middleware'

# Logging
use logger()
use logger format: 'tiny'                # Minimal output
use logger format: 'dev'                 # Colorized (default)
use logger skip: (c) -> c.req.path is '/health'

# CORS
use cors()                               # Allow all origins
use cors origin: 'https://myapp.com'     # Specific origin
use cors origin: ['https://a.com', 'https://b.com']
use cors credentials: true, maxAge: 86400

# Compression (gzip/deflate)
use compress()
use compress threshold: 1024             # Min bytes to compress

# Security headers
use secureHeaders()
use secureHeaders hsts: true, contentSecurityPolicy: "default-src 'self'"

# Request limits
use timeout ms: 30000                    # 30 second timeout
use bodyLimit maxSize: 1024 * 1024       # 1MB max body
```

### Middleware Options

| Middleware | Options |
|------------|---------|
| `logger()` | `format`, `skip`, `stream` |
| `cors()` | `origin`, `methods`, `headers`, `credentials`, `maxAge`, `exposeHeaders`, `preflight` |
| `compress()` | `threshold`, `encodings` |
| `sessions()` | `secret`, `name`, `maxAge`, `secure`, `httpOnly`, `sameSite` |
| `secureHeaders()` | `hsts`, `hstsMaxAge`, `contentSecurityPolicy`, `frameOptions`, `referrerPolicy` |
| `timeout()` | `ms`, `message`, `status` |
| `bodyLimit()` | `maxSize`, `message` |

### Session Usage

```coffee
import { get, use, before, session } from '@rip-lang/api'
import { sessions } from '@rip-lang/api/middleware'

# Sessions parses cookies directly from request headers
use sessions secret: process.env.SESSION_SECRET

before ->
  session.views ?= 0
  session.views += 1

get '/profile' ->
  { userId: session.userId, views: session.views }

get '/login' ->
  session.userId = 123
  { loggedIn: true }

get '/logout' ->
  delete session.userId
  { loggedOut: true }
```

The `session` import works anywhere via AsyncLocalStorage — no `@` needed, works in helpers and nested callbacks.

**Security note:** Without `secret`, sessions use plain base64 (dev only). With `secret`, sessions are HMAC-SHA256 signed (tamper-proof). Always set `secret` in production.

### CORS with Preflight

For APIs that need to handle OPTIONS preflight requests before route matching:

```coffee
import { use } from '@rip-lang/api'
import { cors } from '@rip-lang/api/middleware'

# Handle OPTIONS early (before routes are matched)
use cors origin: 'https://myapp.com', preflight: true
```

### Custom Middleware

```coffee
# Authentication middleware
use (c, next) ->
  token = @req.header 'Authorization'
  unless token
    return @json { error: 'Unauthorized' }, 401
  @user = validateToken!(token)
  await next()

# Timing middleware
use (c, next) ->
  start = Date.now()
  await next()
  @header 'X-Response-Time', "#{Date.now() - start}ms"
```

### Middleware Chain

Middleware runs in registration order with Koa-style `next()`:

```coffee
use (c, next) ->
  console.log 'Before handler'
  await next()
  console.log 'After handler'
```

### Request Lifecycle Filters

Three filters run at different stages: `raw` → `before` → handler → `after`

```coffee
import { raw, before, after, get } from '@rip-lang/api'

# Runs first — modify raw request before body parsing
raw (req) ->
  # Fix content-type for specific clients
  if req.headers.get('X-Raw-SQL') is 'true'
    req.headers.set 'content-type', 'text/plain'

skipPaths = ['/favicon.ico', '/ping', '/health']

# Runs before handler (after body parsing)
before ->
  @start = Date.now()
  @silent = @req.path in skipPaths
  # Return a Response to short-circuit (e.g., for auth)
  unless @req.header 'Authorization'
    return @json { error: 'Unauthorized' }, 401

# Runs after handler
after ->
  return if @silent
  console.log "#{@req.method} #{@req.path} - #{Date.now() - @start}ms"
```

**Note:** `raw` receives the native `Request` object (before parsing). `before` and `after` use `@` to access the context.

**How `@` works:** Handlers are called with `this` bound to the context, so `@foo` is `this.foo`. This gives you Sinatra-like magic access to:
- `@req` — Request object
- `@json()`, `@text()`, `@html()`, `@redirect()`, `@send()` — Response helpers
- `@header()` — Response header modifier
- `@anything` — Custom per-request state

**Imports that work anywhere** (via AsyncLocalStorage or Proxy):
- `read` — Validated request parameters
- `session` — Session data (if middleware enabled)
- `env` — `process.env` shortcut (e.g., `env.DATABASE_URL`)

```coffee
import { get, read, session } from '@rip-lang/api'

get '/profile' ->
  id = read 'id', 'id!'     # Works anywhere
  { id, user: session.userId }  # No @ needed
```

**Note:** In nested callbacks, use fat arrow `=>` to preserve `@`:

```coffee
get '/delayed' ->
  @user = 'alice'
  setTimeout =>           # Fat arrow preserves @
    console.log @user     # Works!
  , 100
```

## Context Object

Use `@` to access the context directly — no parameter needed:

### Response Helpers

```coffee
get '/demo' ->
  # JSON response
  @json { data: 'value' }
  @json { data: 'value' }, 201  # With status
  @json { data: 'value' }, 200, { 'X-Custom': 'header' }

  # Text response
  @text 'Hello'
  @text 'Created', 201

  # HTML response
  @html '<h1>Hello</h1>'

  # Redirect
  @redirect '/new-location'
  @redirect '/new-location', 301  # Permanent

  # Raw body
  @body data, 200, { 'Content-Type': 'application/octet-stream' }

  # File serving (auto-detected MIME type via Bun.file)
  @send 'public/style.css'                    # text/css
  @send 'data/export.json', 'application/json' # explicit type
```

### Request Helpers

```coffee
get '/info' ->
  # Path and query parameters — use read() for validation!
  id = read 'id', 'id!'
  q  = read 'q'  # Raw value; use 'string' validator to collapse whitespace

  # Headers
  auth = @req.header 'Authorization'
  allHeaders = @req.header()

  # Body (async)
  json = @req.json!
  text = @req.text!
  form = @req.formData!
  parsed = @req.parseBody!

  # Raw request
  @req.raw     # Native Request object
  @req.method  # 'GET', 'POST', etc.
  @req.url     # Full URL
  @req.path    # Path only
```

### Request-Scoped State

Use `@` to store per-request state (each request gets a fresh context):

```coffee
# Store data for later middleware/handlers
use (c, next) ->
  @user = { id: 1, name: 'Alice' }
  @startTime = Date.now()
  await next()

get '/profile' ->
  @json @user
```

## File Serving

### `@send(path, type?)`

Serve a file with auto-detected MIME type. Uses `Bun.file()` internally for
efficient streaming — the file is never buffered in memory. Works correctly
when proxied through `@rip-lang/server`.

```coffee
# Auto-detected content type (30+ extensions supported)
get '/css/*', -> @send "css/#{@req.path.slice(5)}"

# Explicit content type
get '/files/*', -> @send "uploads/#{@req.path.slice(7)}", 'application/octet-stream'

# SPA fallback — serve index.html for all unmatched routes
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
```

### `mimeType(path)`

Exported utility that returns the MIME type for a file path based on its
extension. Falls back to `application/octet-stream` for unknown extensions.

```coffee
import { mimeType } from '@rip-lang/api'

mimeType 'style.css'    # 'text/css; charset=UTF-8'
mimeType 'app.js'       # 'application/javascript'
mimeType 'photo.png'    # 'image/png'
mimeType 'data.xyz'     # 'application/octet-stream'
```

Supported extensions: `.html`, `.css`, `.js`, `.mjs`, `.json`, `.txt`, `.csv`,
`.xml`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`, `.ico`,
`.woff`, `.woff2`, `.ttf`, `.otf`, `.mp3`, `.mp4`, `.webm`, `.ogg`, `.pdf`,
`.zip`, `.gz`, `.wasm`, `.rip`.

## Error Handling

### Custom Error Handler

```coffee
import { onError } from '@rip-lang/api'

onError (err, c) ->
  console.error 'Error:', err
  c.json { error: err.message }, err.status or 500
```

### Custom 404 Handler

```coffee
import { notFound } from '@rip-lang/api'

notFound (c) ->
  c.json { error: 'Not found', path: c.req.path }, 404
```

## Server Options

### Basic Server

```coffee
import { start } from '@rip-lang/api'

start port: 3000
start port: 3000, host: '0.0.0.0'
```

### Handler Only (for @rip-lang/server)

```coffee
import { startHandler } from '@rip-lang/api'

export default startHandler()
```

### App Pattern

```coffee
import { App, get, post } from '@rip-lang/api'

export default App ->
  get '/', -> 'Hello'
  post '/echo', -> read()
```

## Context Utilities

### ctx()

Get the current request context from anywhere (via AsyncLocalStorage):

```coffee
import { ctx } from '@rip-lang/api'

# In a helper function
logRequest = ->
  c = ctx()
  console.log "#{c.req.method} #{c.req.path}" if c

# Works in callbacks, helpers, anywhere during request
get '/demo' ->
  logRequest()
  { ok: true }
```

### resetGlobals()

Reset all global state (routes, middleware, filters). Useful for testing:

```coffee
import { resetGlobals, get, start } from '@rip-lang/api'

# In test setup
beforeEach ->
  resetGlobals()

# Now define fresh routes for this test
get '/test', -> { test: true }
```

## Utility Functions

### isBlank

```coffee
import { isBlank } from '@rip-lang/api'

isBlank null        # true
isBlank undefined   # true
isBlank ''          # true
isBlank '   '       # true
isBlank []          # true
isBlank {}          # true
isBlank false       # true
isBlank 'hello'     # false
isBlank [1, 2]      # false
```

### toName

Advanced name formatting with intelligent capitalization:

```coffee
import { toName } from '@rip-lang/api'

toName 'john doe'           # 'John Doe'
toName 'JANE SMITH'         # 'Jane Smith'
toName "o'brien"            # "O'Brien"
toName 'mcdonald'           # 'McDonald'
toName 'los angeles', 'address'  # 'Los Angeles'
```

### mimeType

Auto-detect content type from file extension:

```coffee
import { mimeType } from '@rip-lang/api'

mimeType 'style.css'    # 'text/css; charset=UTF-8'
mimeType 'app.js'       # 'application/javascript'
mimeType 'data.json'    # 'application/json'
mimeType 'unknown.xyz'  # 'application/octet-stream'
```

### toPhone

US phone number formatting:

```coffee
import { toPhone } from '@rip-lang/api'

toPhone '5551234567'        # '(555) 123-4567'
toPhone '555-123-4567'      # '(555) 123-4567'
toPhone '555.123.4567 x99'  # '(555) 123-4567, ext. 99'
toPhone '+1 555 123 4567'   # '(555) 123-4567'
```

## Migration from Hono

`@rip-lang/api` provides a Hono-compatible API surface:

### Before (Hono)

```coffee
import { Hono } from 'hono'

app = new Hono()
app.get '/users/:id', (c) ->
  id = c.req.param 'id'
  c.json { id }

export default app
```

### After (@rip-lang/api)

```coffee
import { get, read, startHandler } from '@rip-lang/api'

get '/users/:id', ->
  id = read 'id', 'id!'
  { id }

export default startHandler()
```

### API Compatibility

| Hono | @rip-lang/api |
|------|---------------|
| `app.get(path, handler)` | `get path, handler` |
| `app.post(path, handler)` | `post path, handler` |
| `app.use(middleware)` | `use middleware` |
| `app.basePath(path)` | `prefix path, -> ...` |
| `c.json(data)` | `@json(data)` or return `{ data }` |
| `c.req.param('id')` | `@req.param('id')` or `read 'id'` |
| `c.req.query('q')` | `@req.query('q')` or `read 'q'` |

## Real-World Example

```coffee
import { get, post, put, del, use, read, start, before, after, onError } from '@rip-lang/api'
import { logger } from '@rip-lang/api/middleware'

# Middleware
use logger()

# Filters
before ->
  @start = Date.now()

after ->
  console.log "#{@req.method} #{@req.path} - #{Date.now() - @start}ms"

# Error handling
onError (err) ->
  @json { error: err.message }, err.status or 500

# Routes
get '/', ->
  { name: 'My API', version: '1.0' }

get '/users', ->
  page = read 'page', 'int', [1, 100]
  limit = read 'limit', 'int', [1, 50]
  users = db.listUsers! page or 1, limit or 10
  { users, page, limit }

get '/users/:id', ->
  id = read 'id', 'id!'
  user = db.getUser!(id)
  unless user
    throw { message: 'User not found', status: 404 }
  { user }

post '/users', ->
  email = read 'email', 'email!'
  name = read 'name', 'string', [1, 100]
  phone = read 'phone', 'phone'
  user = db.createUser! { email, name, phone }
  { user, created: true }

put '/users/:id', ->
  id = read 'id', 'id!'
  email = read 'email', 'email'
  name = read 'name', 'string', [1, 100]
  user = db.updateUser! id, { email, name }
  { user, updated: true }

del '/users/:id', ->
  id = read 'id', 'id!'
  db.deleteUser!(id)
  { deleted: true }

start port: 3000
```

## Performance

- **Minimal footprint** — Core is ~590 lines, middleware ~465 lines
- **Zero dependencies** — No external packages to load
- **Compiled patterns** — Route regexes compiled once at startup
- **Smart response wrapping** — Minimal overhead for return-value handlers
- **AsyncLocalStorage** — Industry-standard, zero-copy context propagation

## Contributing

Contributions that enhance developer productivity and code clarity are welcome. See the [main rip-lang repository](https://github.com/shreeve/rip-lang) for contribution guidelines.

---

**Transform your API development from verbose boilerplate to clear, elegant code.**

*"90% less code, 100% more clarity"*
