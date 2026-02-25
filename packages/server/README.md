<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Server - @rip-lang/server

> **A full-stack web framework and production server — routing, middleware, multi-worker processes, hot reload, HTTPS, and mDNS — written entirely in Rip**

Rip Server is a unified web framework and application server. It provides
Sinatra-style routing, built-in validators, file serving, and middleware
composition for defining your API, plus multi-worker process management,
rolling restarts, automatic TLS certificates, mDNS service discovery, and
request load balancing for running it in production — all with zero external
dependencies.

## Features

- **Multi-worker architecture** — Automatic worker spawning based on CPU cores
- **Hot module reloading** — Watches `*.rip` files by default, rolling restarts on change
- **Rolling restarts** — Zero-downtime deployments
- **Automatic HTTPS** — Shipped `*.ripdev.io` wildcard cert (green lock, zero setup)
- **mDNS discovery** — `.local` hostname advertisement
- **Request queue** — Built-in request buffering and load balancing
- **Built-in dashboard** — Server status UI at `rip.local`
- **Unified package** — Web framework + production server in one

| File | Lines | Role |
|------|-------|------|
| `api.rip` | ~662 | Core framework: routing, validation, `read()`, `session`, `@send`, server |
| `middleware.rip` | ~559 | Built-in middleware: cors, logger, sessions, compression, security, serve |
| `server.rip` | ~1,210 | Process manager: CLI, workers, load balancing, TLS, mDNS |
| `server.html` | ~420 | Built-in dashboard UI |

> **See Also**: For the DuckDB server, see [@rip-lang/db](../db/README.md).

## Quick Start

### Installation

```bash
# Local (per-project)
bun add @rip-lang/server

# Global
bun add -g rip-lang @rip-lang/server
```

### Running Your App

```bash
# From your app directory (uses ./index.rip, watches *.rip)
rip serve

# Name your app (for mDNS: myapp.local)
rip serve myapp

# Explicit entry file
rip serve ./app.rip

# HTTP only mode
rip serve http
```

### Example App

Create `index.rip`:

```coffee
import { get, read, start } from '@rip-lang/server'

get '/', ->
  'Hello from Rip Server!'

get '/json', ->
  { message: 'It works!', timestamp: Date.now() }

get '/users/:id', ->
  id = read 'id', 'id!'
  { user: { id, name: "User #{id}" } }

start()
```

Run it:

```bash
rip serve
```

Test it:

```bash
curl http://localhost/
# Hello from Rip Server!

curl http://localhost/json
# {"message":"It works!","timestamp":1234567890}

curl http://localhost/users/42
# {"user":{"id":42,"name":"User 42"}}

curl http://localhost/status
# {"status":"healthy","app":"myapp","workers":5,"ports":{"https":443}}
```

## The `read()` Function

A validation and parsing powerhouse that eliminates 90% of API boilerplate.

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

# Named parameters
views = read 'views', 'int', min: 0             # Non-negative integer
discount = read 'discount', 'float', max: 100   # Up to 100
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

`@rip-lang/server` includes 37 validators for every common API need:

### Numbers & Money
```coffee
id = read 'user_id', 'id!'       # Positive integer (1+)
count = read 'count', 'whole'    # Non-negative integer (0+)
price = read 'price', 'float'   # Decimal number
cost = read 'cost', 'money'     # Banker's rounding to cents
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
date = read 'date', 'date'        # YYYY-MM-DD
time = read 'time', 'time'        # HH:MM or HH:MM:SS (24-hour)
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

```coffee
import { registerValidator, read } from '@rip-lang/server'

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
import { get, post, put, patch, del, all } from '@rip-lang/server'

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
import { prefix } from '@rip-lang/server'

prefix '/api/v1' ->
  get '/users' -> listUsers!
  get '/posts' -> listPosts!

prefix '/api/v2' ->
  get '/users' -> listUsersV2!
```

## Middleware

### Built-in Middleware

Import from `@rip-lang/server/middleware`:

```coffee
import { use } from '@rip-lang/server'
import { cors, logger, compress, sessions, secureHeaders, timeout, bodyLimit } from '@rip-lang/server/middleware'

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
import { get, use, before, session } from '@rip-lang/server'
import { sessions } from '@rip-lang/server/middleware'

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

```coffee
import { use } from '@rip-lang/server'
import { cors } from '@rip-lang/server/middleware'

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

### Request Lifecycle Filters

Three filters run at different stages: `raw` → `before` → handler → `after`

```coffee
import { raw, before, after, get } from '@rip-lang/server'

# Runs first — modify raw request before body parsing
raw (req) ->
  if req.headers.get('X-Raw-SQL') is 'true'
    req.headers.set 'content-type', 'text/plain'

skipPaths = ['/favicon.ico', '/ping', '/health']

# Runs before handler (after body parsing)
before ->
  @start = Date.now()
  @silent = @req.path in skipPaths
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
  q  = read 'q'

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
efficient streaming — the file is never buffered in memory.

```coffee
# Auto-detected content type (30+ extensions supported)
get '/css/*', -> @send "css/#{@req.path.slice(5)}"

# Explicit content type
get '/files/*', -> @send "uploads/#{@req.path.slice(7)}", 'application/octet-stream'

# SPA fallback — serve index.html for all unmatched routes
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
```

### `mimeType(path)`

Exported utility that returns the MIME type for a file path:

```coffee
import { mimeType } from '@rip-lang/server'

mimeType 'style.css'    # 'text/css; charset=UTF-8'
mimeType 'app.js'       # 'application/javascript'
mimeType 'photo.png'    # 'image/png'
mimeType 'data.xyz'     # 'application/octet-stream'
```

## Error Handling

### Custom Error Handler

```coffee
import { onError } from '@rip-lang/server'

onError (err, c) ->
  console.error 'Error:', err
  c.json { error: err.message }, err.status or 500
```

### Custom 404 Handler

```coffee
import { notFound } from '@rip-lang/server'

notFound (c) ->
  c.json { error: 'Not found', path: c.req.path }, 404
```

## Server Options

### Basic Server

```coffee
import { start } from '@rip-lang/server'

start port: 3000
start port: 3000, host: '0.0.0.0'
```

### Handler Only (for custom servers)

```coffee
import { startHandler } from '@rip-lang/server'

export default startHandler()
```

### App Pattern

```coffee
import { App, get, post } from '@rip-lang/server'

export default App ->
  get '/', -> 'Hello'
  post '/echo', -> read()
```

## Context Utilities

### ctx()

Get the current request context from anywhere (via AsyncLocalStorage):

```coffee
import { ctx } from '@rip-lang/server'

logRequest = ->
  c = ctx()
  console.log "#{c.req.method} #{c.req.path}" if c

get '/demo' ->
  logRequest()
  { ok: true }
```

### resetGlobals()

Reset all global state (routes, middleware, filters). Useful for testing:

```coffee
import { resetGlobals, get, start } from '@rip-lang/server'

beforeEach ->
  resetGlobals()

get '/test', -> { test: true }
```

## Utility Functions

### isBlank

```coffee
import { isBlank } from '@rip-lang/server'

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
import { toName } from '@rip-lang/server'

toName 'john doe'           # 'John Doe'
toName 'JANE SMITH'         # 'Jane Smith'
toName "o'brien"            # "O'Brien"
toName 'mcdonald'           # 'McDonald'
toName 'los angeles', 'address'  # 'Los Angeles'
```

### toPhone

US phone number formatting:

```coffee
import { toPhone } from '@rip-lang/server'

toPhone '5551234567'        # '(555) 123-4567'
toPhone '555-123-4567'      # '(555) 123-4567'
toPhone '555.123.4567 x99'  # '(555) 123-4567, ext. 99'
toPhone '+1 555 123 4567'   # '(555) 123-4567'
```

## Migration from Hono

### Before (Hono)

```coffee
import { Hono } from 'hono'

app = new Hono()
app.get '/users/:id', (c) ->
  id = c.req.param 'id'
  c.json { id }

export default app
```

### After (@rip-lang/server)

```coffee
import { get, read, startHandler } from '@rip-lang/server'

get '/users/:id', ->
  id = read 'id', 'id!'
  { id }

export default startHandler()
```

### API Compatibility

| Hono | @rip-lang/server |
|------|------------------|
| `app.get(path, handler)` | `get path, handler` |
| `app.post(path, handler)` | `post path, handler` |
| `app.use(middleware)` | `use middleware` |
| `app.basePath(path)` | `prefix path, -> ...` |
| `c.json(data)` | `@json(data)` or return `{ data }` |
| `c.req.param('id')` | `@req.param('id')` or `read 'id'` |
| `c.req.query('q')` | `@req.query('q')` or `read 'q'` |

## Real-World Example

```coffee
import { get, post, put, del, use, read, start, before, after, onError } from '@rip-lang/server'
import { logger } from '@rip-lang/server/middleware'

use logger()

before ->
  @start = Date.now()

after ->
  console.log "#{@req.method} #{@req.path} - #{Date.now() - @start}ms"

onError (err) ->
  @json { error: err.message }, err.status or 500

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

## App Path & Naming

### Entry File Resolution

When you run `rip serve`, it looks for your app's entry file:

```bash
# No arguments: looks for index.rip (or index.ts) in current directory
rip serve

# Directory path: looks for index.rip (or index.ts) in that directory
rip serve ./myapp/

# Explicit file: uses that file directly
rip serve ./app.rip
rip serve ./src/server.ts
```

### App Naming

The **app name** is used for mDNS discovery (e.g., `myapp.local`) and logging. It's determined by:

```bash
# Default: current directory name becomes app name
~/projects/api$ rip serve         # app name = "api"

# Explicit name: pass a name that's not a file path
rip serve myapp                   # app name = "myapp"

# With aliases: name@alias1,alias2
rip serve myapp@api,backend       # accessible at myapp.local, api.local, backend.local

# Path with alias
rip serve ./app.rip@myapp         # explicit file + custom app name
```

**Examples:**

```bash
# In ~/projects/api/ with index.rip
rip serve                         # app = "api", entry = ./index.rip
rip serve myapp                   # app = "myapp", entry = ./index.rip
rip serve ./server.rip            # app = "api", entry = ./server.rip
rip serve ./server.rip@myapp      # app = "myapp", entry = ./server.rip
```

## File Watching

Directory watching is **on by default** — any `.rip` file change in your app directory triggers an automatic rolling restart. Use `--watch=<glob>` to customize the pattern, or `--static` to disable watching entirely.

```bash
rip serve                         # Watches *.rip (default)
rip serve --watch=*.ts            # Watch TypeScript files instead
rip serve --static                # No watching, no hot reload (production)
```

**How it works:**

1. Uses OS-native file watching (FSEvents on macOS, inotify on Linux)
2. Watches the entire app directory recursively
3. When a matching file changes, touches the entry file
4. The hot-reload mechanism detects the mtime change and does a rolling restart

This is a single kernel-level file descriptor in the main process — no polling, zero overhead when files aren't changing.

## CLI Reference

### Basic Syntax

```bash
rip serve [flags] [app-path] [app-name]
rip serve [flags] [app-path]@<alias1>,<alias2>,...
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-h`, `--help` | Show help and exit | — |
| `-v`, `--version` | Show version and exit | — |
| `--watch=<glob>` | Watch glob pattern | `*.rip` |
| `--static` | Disable hot reload and file watching | — |
| `--env=<mode>` | Environment mode (`dev`, `prod`) | `development` |
| `--debug` | Enable debug logging | Disabled |
| `http` | HTTP-only mode (no HTTPS) | HTTPS enabled |
| `https` | HTTPS mode (explicit) | Auto |
| `http:<port>` | Set HTTP port | 80, fallback 3000 |
| `https:<port>` | Set HTTPS port | 443, fallback 3443 |
| `w:<n>` | Worker count (`auto`, `half`, `2x`, `3x`, or number) | `half` of cores |
| `r:<reqs>,<secs>s` | Restart policy: requests, seconds (e.g., `5000,3600s`) | `10000,3600s` |
| `--cert=<path>` | TLS certificate path | Shipped `*.ripdev.io` cert |
| `--key=<path>` | TLS private key path | Shipped `*.ripdev.io` key |
| `--hsts` | Enable HSTS headers | Disabled |
| `--no-redirect-http` | Don't redirect HTTP to HTTPS | Redirects enabled |
| `--json-logging` | Output JSON access logs | Human-readable |
| `--no-access-log` | Disable access logging | Enabled |

### Subcommands

```bash
rip serve stop                    # Stop running server
rip serve list                    # List registered hosts
```

### Examples

```bash
# Development (default: watches *.rip, HTTPS, hot reload)
rip serve

# HTTP only
rip serve http

# Production: 8 workers, no hot reload
rip serve --static w:8

# Custom port
rip serve http:3000

# With mDNS aliases (accessible as myapp.local and api.local)
rip serve myapp@api

# Watch TypeScript files instead of Rip
rip serve --watch=*.ts

# Debug mode
rip serve --debug

# Restart workers after 5000 requests or 1 hour
rip serve r:5000,3600s
```

## Architecture

### Self-Spawning Design

The server uses a single-file, self-spawning architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Server    │  │   Manager   │  │  Control Socket │  │
│  │ (HTTP/HTTPS)│  │  (Workers)  │  │   (Commands)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
└─────────┼────────────────┼──────────────────┼───────────┘
          │                │                  │
          ▼                ▼                  │
    ┌──────────┐    ┌──────────────┐          │
    │ Requests │    │ Spawn/Monitor│          │
    └────┬─────┘    └──────┬───────┘          │
         │                 │                  │
         ▼                 ▼                  │
┌─────────────────────────────────────────────│───┐
│              Worker Processes               │   │
│  ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │Worker 0│ │Worker 1│ │Worker N│  ◄────────┘   │
│  │(Unix)  │ │(Unix)  │ │(Unix)  │               │
│  └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────┘
```

When `RIP_SETUP_MODE=1` is set, the same file runs the one-time setup phase. When `RIP_WORKER_MODE=1` is set, it runs as a worker.

### Startup Lifecycle

1. **Setup** — If `setup.rip` exists next to the entry file, it runs once in a temporary process before any workers spawn. Use this for database migrations, table creation, and seeding.
2. **Workers** — N worker processes are spawned, each loading the entry file and serving requests.

### Request Flow

1. **Main Process** receives HTTP/HTTPS request
2. **Server** selects available worker from pool
3. **Request** forwarded via Unix socket
4. **Worker** processes request, returns response
5. **Server** forwards response to client

### Hot Reloading

Two layers of hot reload work together by default:

- **API changes** — The Manager watches for `.rip` file changes in the app directory and triggers rolling worker restarts (zero downtime, server-side).
- **UI changes** (`watch: true` in `serve` middleware) — Workers register their component directories with the Manager via the control socket. The Manager watches those directories and broadcasts SSE reload events to connected browsers (client-side).

SSE connections are held by the long-lived Server process, not by recyclable workers, ensuring stable hot-reload connections. Each app prefix gets its own SSE pool for multi-app isolation.

Use `--static` in production to disable hot reload entirely.

### Worker Lifecycle

Workers are automatically recycled to prevent memory leaks and ensure reliability:

- **maxRequests**: Restart worker after N requests (default: 10,000)
- **maxSeconds**: Restart worker after N seconds (default: 3,600)

## Built-in Endpoints

The server provides these endpoints automatically:

| Endpoint | Description |
|----------|-------------|
| `/status` | Health check with worker count and uptime |
| `/server` | Simple "ok" response for load balancer probes |

## TLS Certificates

### Shipped Wildcard Cert (`*.ripdev.io`)

The server ships with a GlobalSign wildcard certificate for `*.ripdev.io`. Combined with DNS (`*.ripdev.io → 127.0.0.1`), every app gets trusted HTTPS automatically:

```bash
rip serve streamline    # → https://streamline.ripdev.io (green lock)
rip serve analytics     # → https://analytics.ripdev.io (green lock)
rip serve myapp         # → https://myapp.ripdev.io (green lock)
```

No setup, no flags, no certificate generation. The app name becomes the subdomain.

### Custom Certificates

For production domains or custom setups, provide your own cert/key:

```bash
rip serve --cert=/path/to/cert.pem --key=/path/to/key.pem
```

## mDNS Service Discovery

The server automatically advertises itself via mDNS (Bonjour/Zeroconf):

```bash
# App accessible at myapp.local
rip serve myapp

# Multiple aliases
rip serve myapp@api,backend
```

Requires `dns-sd` (available on macOS by default).

## App Requirements

Your app must provide a fetch handler. Three patterns are supported:

### Pattern 1: Use `@rip-lang/server` with `start()` (Recommended)

```coffee
import { get, start } from '@rip-lang/server'

get '/', -> 'Hello!'

start()
```

The `start()` function automatically detects when running under `rip serve` and registers the handler.

### Pattern 2: Export fetch function directly

```coffee
export default (req) ->
  new Response('Hello!')
```

### Pattern 3: Export object with fetch method

```coffee
export default
  fetch: (req) -> new Response('Hello!')
```

## One-Time Setup

If a `setup.rip` file exists next to your entry file, `rip serve` runs it
automatically **once** before spawning any workers. This is ideal for database
migrations, table creation, and seeding.

```coffee
# setup.rip — runs once before workers start
export setup = ->
  await createTables()
  await seedData()
  console.log 'Database ready'
```

The setup function can export as `setup` or `default`. If the file doesn't
exist, the setup phase is skipped entirely (no overhead). If setup fails,
the server exits immediately.

## Environment Variables

Most settings are configured via CLI flags, but environment variables provide an alternative for containers, CI/CD, or system-wide defaults.

**Essential:**

| Variable | CLI Equivalent | Default | Description |
|----------|----------------|---------|-------------|
| `NODE_ENV` | `--env=` | `development` | Environment mode (`development` or `production`) |
| `RIP_DEBUG` | `--debug` | — | Enable debug logging |
| `RIP_STATIC` | `--static` | `0` | Set to `1` to disable hot reload |

**Advanced (rarely needed):**

| Variable | CLI Equivalent | Default | Description |
|----------|----------------|---------|-------------|
| `RIP_MAX_REQUESTS` | `r:N,...` | `10000` | Max requests before worker recycle |
| `RIP_MAX_SECONDS` | `r:...,Ns` | `3600` | Max seconds before worker recycle |
| `RIP_MAX_QUEUE` | `--max-queue=` | `512` | Request queue limit |
| `RIP_QUEUE_TIMEOUT_MS` | `--queue-timeout-ms=` | `30000` | Queue wait timeout (ms) |
| `RIP_CONNECT_TIMEOUT_MS` | `--connect-timeout-ms=` | `2000` | Reserved for future use |
| `RIP_READ_TIMEOUT_MS` | `--read-timeout-ms=` | `30000` | Worker read timeout (ms) |

## Dashboard

The server includes a built-in dashboard accessible at `http://rip.local/` (when mDNS is active). This is a **meta-UI for the server itself**, not your application.

**Dashboard Features:**

- **Server Status** — Health status and uptime
- **Worker Overview** — Active worker count
- **Registered Hosts** — All mDNS aliases being advertised
- **Server Ports** — HTTP/HTTPS port configuration

The dashboard uses the same mDNS infrastructure as your app, so it's always available at `rip.local` when any `rip serve` instance is running.

## Troubleshooting

**Port 80/443 requires sudo**: Use `http:3000` or another high port, or run with sudo.

**mDNS not working**: Ensure `dns-sd` is available (built into macOS). On Linux, install Avahi.

**Workers keep restarting**: Use `--debug` (or `RIP_DEBUG=1`) to see import errors in your app.

**Changes not triggering reload**: Ensure you're not using `--static`. Check that the file matches the watch pattern (default: `*.rip`).

## Serving Rip UI Apps

Rip Server works seamlessly with the `serve` middleware for serving
reactive web applications with hot reload. The `serve` middleware handles
framework files, page manifests, and SSE hot-reload — `rip serve` adds HTTPS,
mDNS, multi-worker load balancing, and rolling restarts on top.

### Example: Rip UI App

Create `index.rip`:

```coffee
import { get, use, start, notFound } from '@rip-lang/server'
import { serve } from '@rip-lang/server/middleware'

dir = import.meta.dir

use serve dir: dir, title: 'My App', watch: true

get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"

notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'

start()
```

Run it:

```bash
rip serve
```

This gives you:

- **Framework bundle** served at `/rip/rip.min.js`
- **App bundle** auto-generated at `/{app}/bundle`
- **Hot reload** via SSE at `/{app}/watch` — save a `.rip` file and the browser
  updates instantly
- **HTTPS + mDNS** — access at `https://myapp.local`
- **Multi-worker** — load balanced across CPU cores
- **Rolling restarts** — zero-downtime file-watch reloading

See [Hot Reloading](#hot-reloading) for details on how the two layers (API + UI) work together.

## Comparison with Other Servers

| Feature | rip serve | PM2 | Nginx |
|---------|-----------|-----|-------|
| Pure Rip | ✅ | ❌ | ❌ |
| Single File | ✅ (~1,200 lines) | ❌ | ❌ |
| Hot Reload | ✅ (default) | ✅ | ❌ |
| Directory Watch | ✅ (default) | ✅ | ❌ |
| Multi-Worker | ✅ | ✅ | ✅ |
| Auto HTTPS | ✅ | ❌ | ❌ |
| mDNS | ✅ | ❌ | ❌ |
| Zero Config | ✅ | ❌ | ❌ |
| Built-in LB | ✅ | ❌ | ✅ |

## Roadmap

> *Planned improvements for future releases:*

- [ ] Request ID tracing for debugging
- [ ] Metrics endpoint (Prometheus format)
- [ ] Static file serving
- [ ] Rate limiting
- [ ] Performance benchmarks

## License

MIT

## Links

- [Rip Language](https://github.com/shreeve/rip-lang) — Compiler + reactive UI framework
- [Report Issues](https://github.com/shreeve/rip-lang/issues)
