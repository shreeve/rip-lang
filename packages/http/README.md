<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip HTTP - @rip-lang/http

> **Zero-dependency HTTP client for Rip — ky-inspired convenience over native fetch**

A lightweight HTTP client that wraps Bun's native `fetch` with method shortcuts,
JSON convenience, automatic error throwing, retries with exponential backoff,
timeouts, lifecycle hooks, and reusable instances. 220 lines of Rip, zero
dependencies.

## Quick Start

```bash
bun add @rip-lang/http
```

```coffee
import { http } from '@rip-lang/http'

# Simple GET
data = http.get!('https://api.example.com/users').json!

# POST with JSON body
user = http.post!('https://api.example.com/users', json: { name: 'Alice' }).json!

# Reusable API client
api = http.create
  prefixUrl: 'https://api.example.com/v1'
  headers: { Authorization: "Bearer #{token}" }
  timeout: 5000
  retry: 3

users = api.get!('users').json!
user  = api.post!('users', json: { name: 'Alice' }).json!
```

## Features

- **Method shortcuts** — `http.get`, `http.post`, `http.put`, `http.patch`, `http.del`, `http.head`
- **JSON convenience** — `json:` option auto-stringifies body and sets Content-Type
- **Auto error throwing** — non-2xx responses throw `HTTPError` (native fetch doesn't)
- **Timeouts** — built-in via `AbortSignal.timeout()`, default 10s
- **Retries** — exponential backoff with jitter, `Retry-After` header support
- **Lifecycle hooks** — `beforeRequest`, `afterResponse`, `beforeRetry`, `beforeError`
- **Reusable instances** — `create()` and `extend()` with `prefixUrl` and default headers
- **Bun-native** — no cross-platform shims, no polyfills, no feature detection

| File | Lines | Role |
|------|-------|------|
| `http.rip` | ~220 | Everything |

## Methods

All methods return a `Promise<Response>`. Use Rip's dammit operator (`!`) to
call and await in one step.

```coffee
res  = http.get!(url)
res  = http.post!(url, opts)
res  = http.put!(url, opts)
res  = http.patch!(url, opts)
res  = http.del!(url, opts)
res  = http.head!(url, opts)

# Read the response
data = res.json!           # Parse JSON
text = res.text!           # Read text
buf  = res.arrayBuffer!    # Read binary
```

## JSON Convenience

The `json:` option stringifies the body and sets `Content-Type: application/json`
automatically.

```coffee
# Without json: option
res = http.post! url,
  body: JSON.stringify({ name: 'Alice' })
  headers: { 'Content-Type': 'application/json' }

# With json: option
res = http.post! url, json: { name: 'Alice' }
```

## Error Handling

By default, non-2xx responses throw an `HTTPError` with the response attached.
Native fetch silently returns error responses — this catches bugs earlier.

```coffee
# Auto-throws on 4xx/5xx
try
  data = http.get!('https://api.example.com/missing').json!
catch err
  if err instanceof http.HTTPError
    console.log err.response.status   # 404
    body = err.response.json!         # Read error body
    console.log body

# Opt out of auto-throwing
res = http.get! url, throwHttpErrors: false
if res.ok
  data = res.json!
else
  console.log "Failed:", res.status
```

## Timeouts

Default timeout is 10 seconds. Uses `AbortSignal.timeout()` under the hood.

```coffee
# Custom timeout
res = http.get! url, timeout: 5000

# No timeout
res = http.get! url, timeout: false

# Catch timeout errors
try
  res = http.get! url, timeout: 1000
catch err
  if err instanceof http.TimeoutError
    console.log 'Request timed out'
```

## Retries

Failed requests are automatically retried with exponential backoff and jitter.
Only safe methods (`GET`, `PUT`, `HEAD`, `DELETE`, `OPTIONS`, `TRACE`) are
retried by default.

```coffee
# Retry up to 5 times
res = http.get! url, retry: 5

# Disable retries
res = http.get! url, retry: false

# Fine-grained control
res = http.get! url,
  retry:
    limit: 3
    methods: ['GET', 'POST']
    statusCodes: [408, 429, 500, 502, 503, 504]
    backoffLimit: 10000
    delay: (attempt) -> attempt * 1000
```

### Defaults

| Option | Default |
|--------|---------|
| `limit` | 2 |
| `methods` | `GET`, `PUT`, `HEAD`, `DELETE`, `OPTIONS`, `TRACE` |
| `statusCodes` | 408, 413, 429, 500, 502, 503, 504 |
| `backoffLimit` | Infinity |
| `delay` | `0.3 * 2^(attempt-1) * 1000` ms with ~10% jitter |

The retry engine respects `Retry-After` headers (both seconds and date formats).

## Hooks

Lifecycle hooks let you intercept requests and responses without modifying
the core logic. All hooks are async-compatible.

```coffee
api = http.create
  hooks:
    beforeRequest: [
      (req, opts) ->
        token = getToken!
        req.headers.set 'Authorization', "Bearer #{token}"
    ]
    afterResponse: [
      (req, opts, res) ->
        console.log "#{req.method} #{req.url} → #{res.status}"
    ]
    beforeRetry: [
      ({ request, options, error, retryCount }) ->
        console.log "Retry #{retryCount}..."
    ]
    beforeError: [
      (error) ->
        error.customMessage = "API Error: #{error.response.status}"
        error
    ]
```

### Hook Types

| Hook | Arguments | Can Return |
|------|-----------|------------|
| `beforeRequest` | `(request, options)` | `Request` (modify), `Response` (short-circuit) |
| `afterResponse` | `(request, options, response)` | `Response` (replace) |
| `beforeRetry` | `({ request, options, error, retryCount })` | — |
| `beforeError` | `(error)` | `HTTPError` (replace) |

## Instances

Create reusable client instances with default options. Instances support
all the same methods as the top-level `http` export.

### create

Build a new instance from scratch.

```coffee
api = http.create
  prefixUrl: 'https://api.example.com/v1'
  headers: { 'X-API-Key': 'secret' }
  timeout: 5000
  retry: 3

users = api.get!('users').json!
user  = api.post!('users', json: { name: 'Alice' }).json!
```

### extend

Build a new instance that inherits from an existing one.

```coffee
api = http.create
  prefixUrl: 'https://api.example.com/v1'
  headers: { 'X-API-Key': 'secret' }

admin = api.extend
  headers: { 'X-Admin': 'true' }

# admin inherits prefixUrl and X-API-Key, adds X-Admin
admin.get!('dashboard').json!
```

Headers are deep-merged (new headers add to or override existing ones).
Hooks are concatenated (parent hooks run first, then child hooks).

## Search Params

```coffee
# Object
res = http.get! url, searchParams: { page: 1, limit: 20 }

# String
res = http.get! url, searchParams: 'page=1&limit=20'

# URLSearchParams
params = new URLSearchParams()
params.set 'page', '1'
res = http.get! url, searchParams: params
```

Undefined values in objects are automatically filtered out.

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | string | `'GET'` | HTTP method |
| `json` | any | — | Auto-stringify body, set Content-Type |
| `body` | BodyInit | — | Raw request body |
| `headers` | object/Headers | — | Request headers |
| `prefixUrl` | string | — | Base URL prepended to input |
| `searchParams` | object/string/URLSearchParams | — | Query parameters |
| `timeout` | number/false | `10000` | Timeout in ms (false to disable) |
| `retry` | number/object/false | `{ limit: 2 }` | Retry configuration |
| `throwHttpErrors` | boolean | `true` | Throw on non-2xx responses |
| `hooks` | object | — | Lifecycle hooks |

All native fetch options (`mode`, `credentials`, `cache`, `redirect`, `signal`,
etc.) are passed through to the underlying `fetch()` call.

## Error Types

### HTTPError

Thrown when a response has a non-2xx status code (when `throwHttpErrors` is true).

```coffee
try
  http.get!(url)
catch err
  err.name          # 'HTTPError'
  err.message       # 'Request failed with status 404'
  err.response      # Response object
  err.request       # Request object
  err.options       # Options used for the request
```

### TimeoutError

Thrown when a request exceeds the timeout.

```coffee
try
  http.get! url, timeout: 100
catch err
  err.name     # 'TimeoutError'
  err.message  # 'Request timed out'
  err.request  # Request object
```

## Comparison with ky

This package is inspired by [ky](https://github.com/sindresorhus/ky) and covers
the same core feature set in a fraction of the code.

| | ky | @rip-lang/http |
|---|---|---|
| Source files | 24 | 1 |
| Runtime code | ~1,200 lines | 220 lines |
| Dependencies | 0 | 0 |
| Method shortcuts | yes | yes |
| JSON convenience | yes | yes |
| Auto error throwing | yes | yes |
| Timeout | yes | yes |
| Retry + backoff | yes | yes |
| Hooks | yes | yes |
| Instances | yes | yes |
| Search params | yes | yes |
| Retry-After | yes | yes |
| Progress callbacks | yes | — |
| Custom JSON parser | yes | — |
| Cross-platform shims | yes (browser/Node/Deno/Bun) | — (Bun only) |

The size difference comes from two things: Rip's concise syntax and the fact
that ky must support browsers, Node.js, Deno, and Bun simultaneously — requiring
extensive feature detection, AbortController polyfills, ReadableStream
compatibility checks, and careful response body memory management. We target
Bun only, so none of that is needed.

## API Summary

```coffee
# Top-level methods
http(url, opts)            # Generic request
http.get(url, opts)        # GET
http.post(url, opts)       # POST
http.put(url, opts)        # PUT
http.patch(url, opts)      # PATCH
http.del(url, opts)        # DELETE
http.head(url, opts)       # HEAD

# Instance management
http.create(opts)          # New instance from scratch
http.extend(opts)          # New instance inheriting defaults

# Error classes
http.HTTPError             # Non-2xx response error
http.TimeoutError          # Timeout error
```

## License

MIT
