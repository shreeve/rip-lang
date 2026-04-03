# AI Agent Guide for `packages/server`

This guide is for AI assistants working inside `packages/server/`.

## Purpose

`@rip-lang/server` is a Bun-native runtime with two operator stories:

1. `rip server` for a single app
2. `serve.rip` for the composable edge/app runtime

It combines:

- app framework (`api.rip`, `middleware.rip`)
- managed worker runtime (`server.rip`, `control/*`)
- edge proxy/runtime (`edge/*`)
- stream routing (`streams/*`)
- auto-TLS (`acme/*`)

## Package layout

### Top level

- `api.rip` — framework API: routing, validators, context, `start()`
- `middleware.rip` — built-in middleware
- `default.rip` — static fallback server
- `server.rip` — orchestration hub: Manager, Server, startup, request dispatch

### `edge/`

- `config.rip` — `serve.rip` loading, composition, and validation
- `forwarding.rip` — HTTP/WS proxy helpers and worker forwarding
- `metrics.rip` — diagnostics counters/gauges
- `queue.rip` — worker queue helpers
- `ratelimit.rip` — request rate limiting
- `realtime.rip` — realtime hub
- `registry.rip` — host registry and app state
- `router.rip` — host/path/method route matching
- `runtime.rip` — edge runtime lifecycle helpers
- `security.rip` — request validation and smuggling defenses
- `tls.rip` — TLS loading helpers
- `upstream.rip` — HTTP proxy backend pools, health checks, retry
- `verify.rip` — post-activate verification policy

### `control/`

- `cli.rip` — CLI parsing and subcommands
- `control.rip` — control socket handlers
- `lifecycle.rip` — shutdown hooks and event logging
- `mdns.rip` — `.local` advertising
- `watchers.rip` — code and SSE watch helpers
- `worker.rip` — worker child runtime
- `workers.rip` — worker spawn/health helpers

### `streams/`

- `config.rip` — stream route normalization
- `index.rip` — stream runtime facade and listeners
- `pipe.rip` — backpressure-safe byte piping
- `router.rip` — listen port + SNI matching
- `runtime.rip` — stream runtime metadata
- `tls_clienthello.rip` — strict ClientHello SNI extraction
- `upstream.rip` — TCP backend target selection and accounting

### `acme/`

- `client.rip`, `manager.rip`, `crypto.rip`, `store.rip`

## `serve.rip`

Canonical top-level keys:

- `version`
- `edge`
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

- request-path behavior -> `edge/*`
- HTTP proxy backend behavior -> `edge/upstream.rip` / `edge/forwarding.rip`
- verification / reload orchestration -> `edge/runtime.rip`, `edge/verify.rip`
- Layer 4 TCP/TLS routing -> `streams/*`
- CLI / app-entry resolution -> `control/cli.rip`
- orchestration / wiring -> `server.rip`

Avoid adding generic utility files.

## Testing

Primary package test command:

```bash
./bin/rip packages/server/test.rip
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
  - `docs/SERVE_REFERENCE.md`
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
