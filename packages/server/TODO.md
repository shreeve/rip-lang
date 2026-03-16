# Rip Server — TODO

## Auto-ACME per host

When a host block has no `cert`/`key`, Rip should automatically obtain a
Let's Encrypt certificate for that hostname. The ACME infrastructure already
exists (`acme/client.rip`, `acme/manager.rip`, `acme/crypto.rip`, `acme/store.rip`)
and has been validated against Let's Encrypt staging.

What's needed:

- Detect host blocks without `cert`/`key` during normalization
- For each, trigger ACME cert issuance via the existing manager
- Store per-host certs in `~/.rip/certs/{hostname}/`
- Add issued certs to the TLS array dynamically (or on reload)
- Handle renewal per-host (the renewal loop already exists for single domain)
- HTTP-01 challenge server on port 80 is already wired

Estimated scope: ~70 lines of glue code, no new crypto or ACME protocol work.

## Location-based routing within a host

Allow path-scoped routing inside a host block:

```coffee
hosts:
  api.example.com:
    cert: '/ssl/example.com.crt'
    key:  '/ssl/example.com.key'

    /api/*:    { app: 'api' }
    /admin/*:  { app: 'admin' }
    /*:        { root: '/mnt/website', spa: true }
```

Path keys would be recognized by starting with `/` and compiled into routes
with the host inherited from the block. This replaces the `routes` array
with a more natural object-key syntax.

## Browse mode (directory listings)

Add `browse: true` on host blocks to enable directory listings. The renderer
already exists in `default.rip` (`renderIndex`). Two implementation paths:

- **Edge handler**: export `renderIndex`, import in `edge/static.rip`, call
  inline when directory has no `index.html`. Fast, no workers.
- **Managed app**: run `default.rip` as a worker app for the host. Supports
  auth middleware, sessions, and the full framework. Heavier.

For public browse, the edge handler is sufficient. For authenticated browse,
use a managed app with `before ->` middleware.

## Per-route middleware in Edgefile

Allow inline middleware configuration per host or per route:

```coffee
hosts:
  api.example.com:
    rateLimit: 100
    cors: true
    app: 'api'
```

This would apply rate limiting and CORS at the edge before the request
reaches the app. Currently, middleware must be configured in app code.

## HTTP response caching

Cache responses at the edge for upstream-proxied routes. Similar to nginx's
`proxy_cache`. Would require a cache store (in-memory or disk) and
cache-control header awareness.

## Diagnostics enhancements

- Report TLS mode: single-cert vs SNI-array
- List configured host names and their cert status
- Report which hosts use passthrough vs app vs static
- Show per-host request counts

## Inline edge handlers

Run small handlers directly in the edge process without spawning workers:

```coffee
hosts:
  health.example.com:
    handler: -> { status: 'ok', time: Date.now() }
```

This is the Cloudflare Workers / Deno Deploy model. Useful for health checks,
redirects, and lightweight API endpoints that don't need the full app framework.
