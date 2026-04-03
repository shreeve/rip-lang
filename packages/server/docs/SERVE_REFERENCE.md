# Serve Reference

This document is the reference for `serve.rip` and the runtime behavior behind
it. It combines:

- config shape
- config lifecycle
- runtime contracts
- scheduler policy
- implementation constraints that matter to operators

## Canonical shape

`serve.rip` is the only config file and `hosts` is the canonical authoring
surface.

```coffee
export default
  version: 1
  edge: {}
  certs: {}
  proxies: {}
  apps: {}
  rules: {}
  groups: {}
  hosts: {}
  streams: []
```

There are no alternate top-level route/site models.

## Top-level sections

### `edge`

Global settings:

- `acme`
- `acmeDomains`
- `cert`
- `key`
- `hsts`
- `trustedProxies`
- `timeouts`
- `verify`

Verification settings:

- `requireHealthyProxies`
- `requireReadyApps`
- `includeUnroutedManagedApps`
- `minHealthyTargetsPerProxy`

### `certs`

Reusable TLS identities.

Preferred shorthand:

```coffee
certs:
  trusthealth: '/ssl/trusthealth.com'
```

This expands to:

- `cert: '/ssl/trusthealth.com.crt'`
- `key: '/ssl/trusthealth.com.key'`

Explicit object form is also valid:

```coffee
certs:
  trusthealth:
    cert: '/ssl/trusthealth.com.crt'
    key: '/ssl/trusthealth.com.key'
```

### `proxies`

Named backend proxy targets.

Transport kind is inferred from URL scheme:

- `http://...` => HTTP proxy
- `https://...` => HTTPS proxy
- `tcp://...` => raw TCP proxy

```coffee
proxies:
  api:
    hosts: ['http://127.0.0.1:4000']
    check:
      path: '/health'
      intervalMs: 5000
      timeoutMs: 2000
    retry:
      attempts: 2
      retryOn: [502, 503, 504]
    timeouts:
      connectMs: 2000
      readMs: 30000

  incus:
    hosts: ['tcp://127.0.0.1:8443']
    connectTimeoutMs: 5000
```

Rules:

- HTTP proxies may use `check`, `retry`, and `timeouts`
- TCP proxies may use `connectTimeoutMs`
- mixed scheme families in one proxy are invalid

### `apps`

Named managed Rip applications with worker and queue settings.

```coffee
apps:
  web:
    entry: './apps/web/index.rip'
    workers: 4
    maxQueue: 512
    queueTimeoutMs: 30000
    readTimeoutMs: 30000
```

### `rules`

Named reusable HTTP rule bundles.

```coffee
rules:
  web: [
    { path: '/api/*', proxy: 'api' }
    { path: '/*', app: 'web' }
  ]
```

You do not have to use `rules`. Hosts may also define inline rules or mixed
arrays of named and inline rules.

### `groups`

Named reusable host lists.

```coffee
groups:
  publicWeb: ['example.com', 'www.example.com']
```

### `hosts`

The canonical config surface. Each binding resolves to one or more concrete
hosts and owns the HTTP or passthrough behavior for those hosts.

Examples:

```coffee
hosts:
  'example.com':
    cert: 'main'
    rules: [
      { path: '/api/*', proxy: 'api' }
      { path: '/*', app: 'web' }
    ]

  publicWeb:
    hosts: 'publicWeb'
    cert: 'main'
    rules: 'web'

hosts: *{
  ['example.com', 'foo.bar.com']:
    cert: 'main'
    rules: 'web'
}
```

Host block fields:

- `hosts`
- `cert`
- `key`
- `rules`
- `proxy`
- `app`
- `root`
- `spa`
- `browse`
- `timeouts`

Rules:

- `cert` references a named entry in `certs`, unless paired with inline `key`
- `rules` can reference named rules, inline rules, or both
- rules inside a host block must not specify `host`
- `proxy` is a shorthand catch-all proxy binding
- `app` is a shorthand catch-all app binding
- `root` is a shorthand catch-all static binding
- if `proxy` targets a TCP proxy, Rip generates the default `:443` SNI stream route automatically

### `streams`

Explicit Layer 4 stream routes matched by `listen` port and SNI.

```coffee
streams: [
  { listen: 443, sni: ['db.example.com'], proxy: 'db' }
]
```

If a stream route shares the HTTPS port, Rip switches that port into shared
multiplexer mode: matching SNI is passed through at Layer 4, and everything
else falls through to Rip's internal HTTPS server.

## Config lifecycle

### Goal

Config updates must be:

- atomic
- reversible
- observable
- safe for in-flight HTTP and websocket proxy traffic

### Apply pipeline

1. Parse
   - Load `serve.rip`
   - Evaluate synchronously in config context
   - Reject on syntax or runtime errors
2. Validate
   - Require `version: 1`
   - Validate supported top-level keys
   - Validate reusable config references, wildcard hosts, websocket route requirements, timeout shapes, and verification policy
3. Normalize
   - Expand defaults
   - Normalize certs, proxies, apps, rules, groups, concrete host bindings, timeouts, and verification policy
   - Compile the deterministic route table
4. Stage
   - Build a new edge runtime generation
   - Prepare managed app registry changes
   - Do not affect active traffic yet
5. Activate
   - Swap the active runtime atomically
   - Route new traffic through the new generation
   - Keep the old generation retired for rollback or drain
6. Post-activate verify
   - Check referenced HTTP proxies, healthy target counts, and managed app worker readiness
7. Rollback
   - Restore the previous registry snapshot and active runtime if verification fails

### Trigger modes

- file watch on `serve.rip`
- `SIGHUP`
- control API: `POST /reload`

All triggers use the same reload path and safeguards.

### Failure behavior

- Parse or validate failure: keep serving the existing config
- Stage failure: keep serving the existing config
- Post-activate verification failure: rollback automatically

### Draining behavior

- Retired runtimes remain alive while:
  - HTTP requests that started on them are still in flight
  - websocket proxy connections that started on them are still open
- Health checks stop only after a retired runtime finishes draining

## Contracts

### `AppDescriptor`

```ts
type AppDescriptor = {
  id: string
  entry: string | null
  appBaseDir: string | null
  hosts: string[]
  workers: number | null
  maxQueue: number
  queueTimeoutMs: number
  readTimeoutMs: number
  env: Record<string, string>
}
```

### `RouteRule`

```ts
type RouteRule = {
  id: string
  host: string | "*" | "*.example.com"
  path: string
  methods: string[] | "*"
  priority: number
  proxy?: string | null
  app?: string | null
  static?: string | null
  redirect?: { to: string, status: number } | null
  headers?: { set?: Record<string, string>, remove?: string[] } | null
  websocket?: boolean
  timeouts?: Partial<TimeoutPolicy>
}
```

Route rules are normalized from `serve.rip` host bindings. Authoring
composition through `rules`, `groups`, `certs`, and `proxies` must be fully
resolved before route compilation.

### `VerifyPolicy`

```ts
type VerifyPolicy = {
  requireHealthyProxies: boolean
  requireReadyApps: boolean
  includeUnroutedManagedApps: boolean
  minHealthyTargetsPerProxy: number
}
```

Defaults:

- `requireHealthyProxies: true`
- `requireReadyApps: true`
- `includeUnroutedManagedApps: true`
- `minHealthyTargetsPerProxy: 1`

### `EdgeRuntime`

```ts
type EdgeRuntime = {
  id: string
  upstreamPool: UpstreamPool
  routeTable: RouteTable
  configInfo: ConfigInfo
  verifyPolicy: VerifyPolicy | null
  inflight: number
  wsConnections: number
  retiredAt: string | null
}
```

## Scheduler policy

v1 uses **least-inflight** per app pool.

Selection order:

1. filter to workers in `ready` state
2. choose the worker with lowest `inflight`
3. tie-break by lowest `workerId`

Fallback behavior:

- if all workers are saturated and queue depth `< maxQueue`: enqueue
- if queue depth `>= maxQueue`: return `503` with `Retry-After`

Retry interaction:

- retry only idempotent requests by default
- never retry after partial upstream response
- retry decisions occur after scheduler selection and only on retry-eligible failures

## Operational constraints

- Config evaluation must be deterministic
- No async work while evaluating config
- No network I/O while evaluating config
- Validation errors must include field path, message, and remediation hint

TLS posture in v1:

- dynamic SNI selection was not observed
- in-process cert hot reload was not observed
- graceful restart cert activation works
- ACME HTTP-01 is the reliable baseline

## Historical notes worth keeping

Accepted design choices that still matter:

- single project architecture with two runtime roles:
  - EdgeControlPlane
  - AppDataPlane
- direct request path remains `client -> ingress -> worker`
- config apply lifecycle is atomic
- `server.rip` should stay orchestration/wiring, not business logic
- prefer themed files over generic utility dumping grounds
