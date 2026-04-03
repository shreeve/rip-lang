# Server API Reference

> Extracted from the main [@rip-lang/server README](./README.md).

This document covers the framework-facing API for `@rip-lang/server`, including
validation, routing, middleware, request/response helpers, and app entrypoints.

The framework API is one way to create served content inside Rip Server. It is
not the whole product identity: the same runtime also serves static content,
proxied HTTP services, and TCP/TLS services. This reference covers the app and
API surface within that broader serving model.

## Validation with `read()`

The `read()` function is a validation and parsing powerhouse that eliminates
90% of API boilerplate.

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

Three filters run at different stages: `raw` -> `before` -> handler -> `after`

```coffee
import { raw, before, after, get } from '@rip-lang/server'

raw (req) ->
  if req.headers.get('X-Raw-SQL') is 'true'
    req.headers.set 'content-type', 'text/plain'

skipPaths = ['/favicon.ico', '/ping', '/health']

before ->
  @start = Date.now()
  @silent = @req.path in skipPaths
  unless @req.header 'Authorization'
    return @json { error: 'Unauthorized' }, 401

after ->
  return if @silent
  console.log "#{@req.method} #{@req.path} - #{Date.now() - @start}ms"
```

## Context Object

Use `@` to access the context directly — no parameter needed.

### Response Helpers

```coffee
get '/demo' ->
  @json { data: 'value' }
  @text 'Hello'
  @html '<h1>Hello</h1>'
  @redirect '/new-location'
  @body data, 200, { 'Content-Type': 'application/octet-stream' }
  @send 'public/style.css'
```

### Request Helpers

```coffee
get '/info' ->
  id = read 'id', 'id!'
  q  = read 'q'
  auth = @req.header 'Authorization'
  json = @req.json!
  @req.raw
  @req.method
  @req.url
  @req.path
```

### Request-Scoped State

```coffee
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
efficient streaming.

```coffee
get '/css/*' -> @send "css/#{@req.path.slice(5)}"
get '/files/*' -> @send "uploads/#{@req.path.slice(7)}", 'application/octet-stream'
notFound -> @send 'index.html', 'text/html; charset=UTF-8'
```

### `mimeType(path)`

```coffee
import { mimeType } from '@rip-lang/server'

mimeType 'style.css'
mimeType 'app.js'
mimeType 'photo.png'
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

### Handler Only

```coffee
import { startHandler } from '@rip-lang/server'

export default startHandler()
```

### App Pattern

```coffee
import { App, get, post } from '@rip-lang/server'

export default App ->
  get '/' -> 'Hello'
  post '/echo' -> read()
```

## Context Utilities

### `ctx()`

Get the current request context from anywhere:

```coffee
import { ctx } from '@rip-lang/server'

logRequest = ->
  c = ctx()
  console.log "#{c.req.method} #{c.req.path}" if c
```

### `resetGlobals()`

Reset all global state (routes, middleware, filters). Useful for testing.

```coffee
import { resetGlobals, get } from '@rip-lang/server'

beforeEach ->
  resetGlobals()
```

## Utility Functions

### `isBlank`

```coffee
import { isBlank } from '@rip-lang/server'

isBlank null
isBlank ''
isBlank {}
```

### `toName`

```coffee
import { toName } from '@rip-lang/server'

toName 'john doe'
toName "o'brien"
```

### `toPhone`

```coffee
import { toPhone } from '@rip-lang/server'

toPhone '5551234567'
toPhone '555.123.4567 x99'
```

## Migration from Hono

### Before

```coffee
import { Hono } from 'hono'

app = new Hono()
app.get '/users/:id', (c) ->
  id = c.req.param 'id'
  c.json { id }

export default app
```

### After

```coffee
import { get, read, startHandler } from '@rip-lang/server'

get '/users/:id' ->
  id = read 'id', 'id!'
  { id }

export default startHandler()
```

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

get '/' ->
  { name: 'My API', version: '1.0' }

get '/users' ->
  page = read 'page', 'int', [1, 100]
  limit = read 'limit', 'int', [1, 50]
  users = db.listUsers! page or 1, limit or 10
  { users, page, limit }

get '/users/:id' ->
  id = read 'id', 'id!'
  user = db.getUser!(id) or throw { message: 'User not found', status: 404 }
  { user }

post '/users' ->
  email = read 'email', 'email!'
  name = read 'name', 'string', [1, 100]
  phone = read 'phone', 'phone'
  user = db.createUser! { email, name, phone }
  { user, created: true }

put '/users/:id' ->
  id = read 'id', 'id!'
  email = read 'email', 'email'
  name = read 'name', 'string', [1, 100]
  user = db.updateUser! id, { email, name }
  { user, updated: true }

del '/users/:id' ->
  id = read 'id', 'id!'
  db.deleteUser!(id)
  { deleted: true }

start port: 3000
```
