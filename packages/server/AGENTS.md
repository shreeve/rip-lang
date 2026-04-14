# AI Agent Guide for `packages/server`

This guide is for AI assistants working inside `packages/server/`.

## Purpose

`@rip-lang/server` serves content. Here, `content` means anything an operator
wants to make reachable over the network: a static site, a Rip app, a proxied
HTTP service, or a TCP/TLS service.

It has two operator stories:

1. `rip server` for a single app
2. `serve.rip` for the composable multi-host runtime

Those stories map to four serving modes:

- static serving
- app serving
- HTTP/HTTPS proxy serving
- TCP/TLS passthrough serving

TLS, proxy health, verification, rollback, drain, reload, and diagnostics are
part of the core serving story. They are serving guarantees, not side features.

## Package layout

### Top level

- `api.rip` — framework API: routing, validators, context, `start()`
- `middleware.rip` — built-in middleware
- `browse.rip` — directory browser (fallback when no app entry exists)
- `server.rip` — orchestration hub: Manager, Server, startup, request dispatch

### `serving/`

HTTP serving layer. Everything that handles an inbound HTTP request after it
arrives at the server.

- `config.rip` — `serve.rip` loading, validation, and normalization
- `forwarding.rip` — response builders, request IDs, error responses, worker forwarding
- `logging.rip` — access logging, debug flags, formatting utilities
- `metrics.rip` — diagnostics counters/gauges and response builders
- `proxy.rip` — HTTP/WebSocket proxy-to-upstream routing with retry
- `queue.rip` — worker queue helpers
- `ratelimit.rip` — request rate limiting
- `realtime.rip` — realtime hub and WebSocket handler builders
- `registry.rip` — host registry and app state
- `router.rip` — host/path/method route matching
- `runtime.rip` — serving runtime lifecycle helpers
- `security.rip` — request validation and smuggling defenses
- `static.rip` — static file serving, traversal safety, SPA fallback
- `tls.rip` — TLS loading helpers, SSL directory scanning, SAN matching
- `upstream.rip` — HTTP proxy backend pools, health checks, retry
- `verify.rip` — post-activate verification policy

### `streams/`

TCP/TLS passthrough layer. Handles Layer 4 connections before TLS termination.

- `clienthello.rip` — strict ClientHello SNI extraction
- `config.rip` — stream route normalization
- `index.rip` — stream runtime facade and listeners
- `pipe.rip` — backpressure-safe byte piping
- `router.rip` — listen port + SNI matching
- `runtime.rip` — stream runtime metadata
- `upstream.rip` — TCP backend target selection and accounting

### `acme/`

Automatic certificate management.

- `client.rip` — RFC 8555 ACME protocol client
- `crypto.rip` — P-256 keys, JWS, CSR generation
- `manager.rip` — certificate lifecycle orchestrator
- `store.rip` — filesystem cert storage + HTTP-01 challenge store

### `control/`

Process management and operator control surfaces.

- `cli.rip` — CLI parsing and subcommands
- `control.rip` — control socket handlers
- `lifecycle.rip` — shutdown hooks and event logging
- `manager.rip` — worker pool manager (spawn, monitor, rolling restart)
- `mdns.rip` — `.local` advertising
- `watchers.rip` — code and SSE watch helpers
- `worker.rip` — worker child runtime
- `workers.rip` — worker spawn/health helpers

## `serve.rip`

Top-level keys: `ssl`, `hsts`, `acme`, `sites`, `apps`, `version`, `server`.

### Config model

- `ssl` — path to directory of `.crt`/`.key` pairs (auto-scanned by SAN)
- `sites` — named aliases mapping to hostnames
- `apps` — string-based app specs binding targets to sites
- `server` — optional global settings (hsts, acme, timeouts, verify)

### App spec format

Each app value is a string of space-separated tokens:

- Site names reference entries in the `sites` section
- An optional target token (path or URL) specifies what to serve
- No target means current directory (`.`)

```coffee
apps:
  web: 'dev prod'                          # local app, current dir, on dev+prod
  patient: '../patient dev prod'           # local app at relative path
  incus: 'https://10.0.0.50:8443 incus'   # HTTP reverse proxy
  mysql: 'tcp://10.0.0.50:3306 db'        # TCP passthrough by SNI
  zion: '/home/shreeve/www zion browse'    # static directory with browsing
```

Target kinds inferred from prefix:

- `./`, `../`, `/` or none → local Rip app (if `index.rip` exists) or static files
- `http://`, `https://` → HTTP reverse proxy
- `tcp://` → Layer 4 TCP/TLS passthrough

Optional flags: `browse` (directory listing), `spa` (single-page app fallback).

### Constraints

- Each site may be bound by exactly one app
- TCP proxies require a port in the URL
- Local targets with `index.rip` become Rip apps; without it, static file serving

## Where logic belongs

- request-path behavior for served HTTP content -> `serving/*`
- HTTP proxy backend behavior and resilience -> `serving/upstream.rip` / `serving/forwarding.rip`
- verification / reload orchestration -> `serving/runtime.rip`, `serving/verify.rip`
- Layer 4 TCP/TLS routing and ingress selection -> `streams/*`
- CLI / app-entry resolution -> `control/cli.rip`
- orchestration / wiring across serving modes -> `server.rip`

Avoid adding generic utility files.

## Testing

Primary package test command:

```bash
./bin/rip packages/server/tests/runner.rip
```

Repo-wide regression suite:

```bash
bun run test
```

When changing:

- config parsing -> update `tests/config.rip`, `tests/servers.rip`
- routing -> update `tests/router.rip`, `tests/registry.rip`
- HTTP backend behavior -> update `tests/upstream.rip`
- stream behavior -> update `tests/streams_*.rip`
- verification / rollback -> update `tests/verify.rip`, `tests/control.rip`
- watcher behavior -> update `tests/watchers.rip`

## Conventions

- Keep docs and implementation aligned. Config surface changes must update:
  - `README.md`
  - `CONFIG.md`
- Prefer extractions by theme, not one-off helpers
- Keep `server.rip` as orchestration, not a dumping ground
- Use bare `try` when the catch body is truly a no-op

## Operator-facing features to protect

- `-f` / `--file`
- `--check-config`
- `POST /reload` on the control socket
- `/diagnostics`
- reload history and rollback reporting
- wildcard hosts
- websocket proxy routes
- stream passthrough drain semantics
- shared-port HTTPS multiplexer mode for `streams.listen == httpsPort`

Consider these rules if they affect your changes.

## Runtime state model

When the main server process is running, it holds these categories of state.
Understanding this is essential for features like `--restart` (hot reconfigure)
where listeners stay open but everything else tears down and rebuilds.

### Kept open during restart (expensive to recreate)

- `@server` — HTTP listener (`Bun.serve` on port 80/443)
- `@httpsServer` — HTTPS listener
- `@internalHttpsServer` — internal TLS multiplexer (when stream config shares the HTTPS port)

These are the only resources that cause a port gap if recreated. The `--restart`
command explicitly preserves them.

### Torn down and rebuilt during restart

- **Workers** — all child processes killed and respawned with fresh code
- **Control socket** (`@control`) — closed and reopened on the same path
- **File watchers** — `Manager.codeWatchers` and `Manager.appWatchers` closed and re-registered
- **mDNS** — `dns-sd` child processes killed and restarted
- **Timers** — queue sweep interval, reload poll interval, debounce timers
- **Config/routing** — `@flags` re-read, `@servingRuntime`/`@streamRuntime` rebuilt, `@appRegistry` rebuilt
- **TLS material** — reloaded from disk (picks up new certs)
- **Caches** — metrics, rate limiter, watch groups, challenge store all reset
- **PID file** — rewritten

### Never held by the server (owned by workers or external)

- Session data (in cookies, not server memory)
- Database connections (workers connect independently via rip-db HTTP)
- rip-db process (detached, survives server restart)
