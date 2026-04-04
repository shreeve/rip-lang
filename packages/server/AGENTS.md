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

- `config.rip` — `serve.rip` loading, composition, and validation
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
- `tls.rip` — TLS loading helpers
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

Canonical top-level keys:

- `version`
- `server` (global settings; `edge` accepted as deprecated alias)
- `certs`
- `proxies`
- `apps`
- `rules`
- `groups`
- `hosts`
- `streams`

Public config model:

- `certs` — reusable TLS identities
- `proxies` — named backends; host URLs decide transport
- `rules` — reusable HTTP rule bundles
- `groups` — reusable hostname lists
- `hosts` — canonical authoring surface

Transport rules for `proxies.*.hosts`:

- `http://...` => HTTP proxy backend
- `https://...` => HTTPS proxy backend
- `tcp://...` => raw TCP backend
- mixed schemes in one proxy are invalid

Host rules:

- `rules` may be a rule-set ID, inline rule array, or mixed array of both
- host rules use `proxy`, not `upstream`
- host-level `proxy: 'tcpBackend'` creates the default TLS passthrough binding
- `certs.name: '/ssl/site'` expands to `site.crt` + `site.key`

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

- config parsing -> update `tests/serve_config.rip`, `tests/servers.rip`, `tests/proxy.rip`
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
