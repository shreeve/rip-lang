# Edgefile Contract

This document defines the `Edgefile.rip` contract as implemented in
`@rip-lang/server`.

## Host model detection

The Edgefile supports two host models, auto-detected by key presence:

- **Flat model** (`routes`/`sites`) -- routes listed at the top level with optional per-host site groups
- **Server blocks** (`servers`) -- per-domain blocks that own cert, root, routes, and passthrough

You cannot mix `servers` with `routes`/`sites` in the same Edgefile.
`version` and `edge` are optional (default to `1` and `{}` respectively).

## Flat model shape

```coffee
export default
  version: 1
  edge: ...
  upstreams: ...
  streamUpstreams: ...
  apps: ...
  routes: ...
  streams: ...
  sites: ...
```

## Server blocks shape

```coffee
export default
  servers: ...
  upstreams: ...
  apps: ...
  streamUpstreams: ...
  streams: ...
```

### `servers`

Per-domain server blocks, keyed by hostname (exact or wildcard).

```coffee
servers:
  '*.trusthealth.com':
    cert: '/ssl/trusthealth.com.crt'
    key:  '/ssl/trusthealth.com.key'
    root: '/mnt/trusthealth/website'
    routes: [
      { path: '/*', static: '.', spa: true }
    ]
```

Server block fields:

- `passthrough?: string` -- raw TLS passthrough to `host:port` (no cert, no routes needed)
- `cert?: string` -- TLS certificate path (must pair with `key`)
- `key?: string` -- TLS private key path (must pair with `cert`)
- `root?: string` -- default filesystem base; serves static files if no routes are defined
- `spa?: boolean` -- server-level SPA fallback (used with root-only blocks)
- `routes?: array` -- route objects (optional if `root` or `passthrough` is set)
- `timeouts?: object` -- per-server timeout defaults

Per-server `cert`/`key` enable SNI-based certificate selection via Bun's TLS
array. `edge.cert` and `edge.key` remain the fallback TLS identity for
unmatched hostnames. The TLS array is sorted by specificity: exact hosts first,
then wildcards by label count, then the fallback entry.

Routes inside a server block inherit the server hostname and must not specify
`host`. Routes with `upstream` or `app` must reference known entries from the
top-level `upstreams` or `apps` sections.

Static routes support `static` (string path), `root` (overrides server root),
and `spa` (boolean, serves `index.html` on miss for GET/HEAD with Accept
text/html).

Hosts not matching any server block or stream route fall through to the default
app.

## Determinism policy

- Config evaluation is synchronous.
- Async operations are disallowed.
- Network I/O is disallowed.
- Validation errors must include a field path, message, and remediation hint.
- With the same file contents, config evaluation must produce the same normalized shape.

## Top-level sections

### `version`

- Optional. Defaults to `1`.

### `edge`

Global edge settings. Optional (defaults to `{}`).

Supported keys:

- `acme: boolean`
- `acmeDomains: string[]`
- `cert: string`
- `key: string`
- `hsts: boolean`
- `trustedProxies: string[]`
- `timeouts: { connectMs, readMs }`
- `verify: { requireHealthyUpstreams, requireReadyApps, includeUnroutedManagedApps, minHealthyTargetsPerUpstream }`

### `upstreams`

Named reverse-proxy backends.

```coffee
upstreams:
  app:
    targets: ['http://app.incusbr0:3000']
    healthCheck:
      path: '/health'
      intervalMs: 5000
      timeoutMs: 2000
    retry:
      attempts: 2
      retryOn: [502, 503, 504]
    timeouts:
      connectMs: 2000
      readMs: 30000
```

### `apps`

Managed Rip applications with worker pools.

```coffee
apps:
  admin:
    entry: './admin/index.rip'
    hosts: ['admin.example.com']
    workers: 2
    maxQueue: 512
    queueTimeoutMs: 30000
    readTimeoutMs: 30000
    env:
      ADMIN_MODE: '1'
```

### `streamUpstreams`

Named raw TCP upstreams for Layer 4 passthrough.

```coffee
streamUpstreams:
  incus:
    targets: ['127.0.0.1:8443']
    connectTimeoutMs: 5000  # optional, default 5000
```

### `routes`

Declarative edge route objects.

Each route must define exactly one action:

- `upstream`
- `app`
- `static`
- `redirect`
- `headers`

Common route fields:

- `id?: string`
- `host?: string` — exact host, wildcard host like `*.example.com`, or `*`
- `path: string` — must start with `/`
- `methods?: string[] | "*"`
- `priority?: number`
- `timeouts?: { connectMs, readMs }`

Action-specific fields:

- `upstream: string`
- `app: string`
- `static: string`
- `redirect: { to: string, status: number }`
- `headers: { set?: object, remove?: string[] }`

WebSocket proxy routes use:

- `websocket: true`
- `upstream: string`

### `streams`

Declarative Layer 4 stream routes.

```coffee
streams: [
  { listen: 8443, sni: ['incus.example.com'], upstream: 'incus' }
]
```

Supported fields:

- `id?: string`
- `listen: number`
- `sni: string[]`
- `upstream: string`
- `timeouts?: { handshakeMs, idleMs, connectMs }`

If a stream route listens on the active HTTPS port, Rip switches that port into
a shared multiplexer mode:

- the public port is owned by the Layer 4 listener
- matching SNI traffic is passed through to the configured `streamUpstreams`
- non-matching SNI, or TLS clients without SNI, fall through to Rip's internal
  HTTPS server and continue through the normal HTTP/WebSocket edge runtime

### `sites`

Per-host route groups and policy overrides.

```coffee
sites:
  'admin.example.com':
    routes: [
      { path: '/*', app: 'admin' }
    ]
```

## Host/path precedence

Route precedence is:

1. exact host
2. wildcard host
3. catch-all host
4. more specific path
5. lower explicit priority number
6. declaration order tie-break

Wildcard hosts are single-label only:

- `*.example.com` matches `api.example.com`
- `*.example.com` does **not** match `a.b.example.com`

## Timeout inheritance

Timeout resolution is:

1. route-level `timeouts`
2. site-level `timeouts`
3. edge-level `timeouts`
4. server defaults

## Verification policy

`edge.verify` tunes post-activate verification:

- `requireHealthyUpstreams: boolean`
- `requireReadyApps: boolean`
- `includeUnroutedManagedApps: boolean`
- `minHealthyTargetsPerUpstream: number`

These settings affect staged activation, post-activate verification, and rollback.

## Reload semantics

- Every reload trigger runs the same lifecycle.
- Invalid config never replaces the active config.
- A new edge runtime is staged, activated atomically, then verified.
- Failed verification causes automatic rollback to the previous runtime.
- Retired runtimes drain in-flight HTTP and websocket proxy traffic before cleanup.

## v1 TLS implications

Based on `packages/server/spikes/tls/FINDINGS.md`:

- v1 does not assume dynamic per-SNI cert switching.
- v1 does not assume in-process cert hot reload.
- v1 uses graceful restart for cert activation.
- v1 ACME prioritizes HTTP-01.
- ACME HTTP-01 cannot issue wildcard certificates. Wildcard TLS requires manual
  `cert` + `key`.
