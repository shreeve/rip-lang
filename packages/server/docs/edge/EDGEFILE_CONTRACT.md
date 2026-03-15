# Edgefile Contract

This document defines the current v1 contract for `Edgefile.rip` as implemented in
`@rip-lang/server`.

## Required top-level shape

```coffee
export default
  version: 1
  edge: ...
  upstreams: ...
  apps: ...
  routes: ...
  sites: ...
```

Only `version`, `edge`, `upstreams`, `apps`, `routes`, and `sites` are valid
top-level keys.

## Determinism policy

- Config evaluation is synchronous.
- Async operations are disallowed.
- Network I/O is disallowed.
- Validation errors must include a field path, message, and remediation hint.
- With the same file contents, config evaluation must produce the same normalized shape.

## Top-level sections

### `version`

- Required.
- Must be `1`.

### `edge`

Global edge settings.

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
