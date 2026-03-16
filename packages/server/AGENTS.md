# AI Agent Guide for `packages/server`

This guide is for AI assistants working inside `packages/server/`.

## Purpose

`@rip-lang/server` is a graduated Bun-native runtime:

1. **Single-app mode** — `rip server`
2. **Managed multi-app mode** — `config.rip`
3. **Edge mode** — `Edgefile.rip`

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
- `server.rip` — orchestration hub: Manager, Server, request dispatch, startup

### `edge/`

Request-path behavior and edge runtime logic.

- `config.rip` — `Edgefile.rip` and `config.rip` normalization/validation
- `forwarding.rip` — HTTP/WS proxy helpers and worker forwarding
- `metrics.rip` — diagnostics counters/gauges
- `queue.rip` — worker queue helpers
- `ratelimit.rip` — request rate limiting
- `realtime.rip` — Bam-style realtime hub
- `registry.rip` — host registry and app state
- `router.rip` — host/path/method route matching
- `runtime.rip` — edge runtime lifecycle helpers
- `security.rip` — request validation and smuggling defenses
- `tls.rip` — TLS loading helpers
- `upstream.rip` — upstream pools, health checks, retry helpers
- `verify.rip` — post-activate verification policy

### `control/`

Management/runtime plumbing.

- `cli.rip` — CLI parsing, app resolution, help/version/subcommands
- `control.rip` — control socket handlers and worker registry helpers
- `lifecycle.rip` — shutdown hooks and event logging
- `mdns.rip` — `.local` advertising
- `watchers.rip` — code and SSE watch helpers
- `worker.rip` — worker child runtime
- `workers.rip` — worker spawn/health helpers

### `streams/`

Layer 4 TCP/TLS routing.

- `config.rip` — stream config normalization and validation
- `index.rip` — public stream runtime facade and listener orchestration
- `pipe.rip` — backpressure-safe byte piping helpers
- `router.rip` — listen port + SNI route matching
- `runtime.rip` — stream runtime metadata and summaries
- `tls_clienthello.rip` — strict ClientHello SNI extraction
- `upstream.rip` — target selection and connection accounting

### `acme/`

Auto-TLS internals.

- `client.rip`, `manager.rip`, `crypto.rip`, `store.rip`

## Config modes

### `config.rip`

Legacy managed multi-app config.

- only `apps` is valid at the top level
- registers additional managed Rip apps
- no upstreams, no edge routes, no verification policy

### `Edgefile.rip`

Canonical edge config for the edge runtime. Supports v1 and v2 schemas.

v1 top-level keys: `version`, `edge`, `upstreams`, `streamUpstreams`, `apps`,
`routes`, `streams`, `sites`.

Top-level keys: `version`, `edge`, `hosts`, `upstreams`, `apps`,
`streamUpstreams`, `streams`. `hosts` is the per-domain config model.
Each server block owns `cert`, `key`, `root`, `routes`, and `timeouts`.
Per-server `cert`/`key` enable per-SNI multi-cert TLS via Bun's TLS array.

Use `Edgefile.rip` when you need:

- upstream proxy routes
- websocket proxy routes
- wildcard hosts
- staged reload + verification + rollback
- verification policy (`edge.verify`)
- stream passthrough via `streamUpstreams` and `streams`
- per-domain TLS via `hosts` blocks with `cert`/`key`
- `passthrough` shorthand for raw TLS passthrough in server blocks
- root-only server blocks with implicit static file serving
- static file serving and SPA fallback via `static`/`spa` route actions
- redirect routes via `redirect: { to, status }`

## Edge runtime lifecycle

The active edge runtime is generational:

1. parse and validate config
2. normalize and compile route table
3. stage a new runtime
4. activate atomically
5. verify according to `edge.verify`
6. rollback automatically if verification fails
7. let retired runtimes drain in-flight HTTP and websocket proxy traffic

Important objects:

- `EdgeRuntime` — active/retired generation
- `configInfo` — operator-facing status and reload history
- `upstreamPool` — proxy backends and health state
- `routeTable` — compiled host/path/method rules
- `streamRuntime` — active/retired Layer 4 stream generation
- `streamUpstreamPool` — raw TCP upstream targets and active connection counts

## Where logic belongs

- request-path behavior belongs in `edge/*`
- management/runtime plumbing belongs in `control/*`
- orchestration stays in `server.rip`
- avoid adding generic utility files

If you are adding:

- route matching -> `edge/router.rip`
- upstream proxy behavior -> `edge/upstream.rip` / `edge/forwarding.rip`
- verification rules -> `edge/verify.rip`
- reload/rollback orchestration helpers -> `edge/runtime.rip`
- Layer 4 TCP/TLS routing -> `streams/*`
- CLI or app-entry resolution -> `control/cli.rip`

## Testing

Primary package test command:

```bash
./bin/rip packages/server/test.rip
```

Repo-wide regression suite:

```bash
bun run test
```

Server package tests live in `packages/server/tests/`.

When changing:

- config parsing -> update `tests/edgefile.rip`, `tests/proxy.rip`
- routing -> update `tests/router.rip`, `tests/registry.rip`
- upstream behavior -> update `tests/upstream.rip`
- stream parsing/routing/pipe behavior -> update `tests/streams_*.rip`
- verification/rollback -> update `tests/verify.rip`, `tests/control.rip`
- watcher behavior -> update `tests/watchers.rip`

## Conventions

- Keep docs and implementation aligned. `Edgefile.rip` surface changes must update:
  - `README.md`
  - `docs/edge/EDGEFILE_CONTRACT.md`
  - `docs/edge/CONFIG_LIFECYCLE.md`
  - `docs/edge/CONTRACTS.md`
- Prefer extractions by theme, not by single function.
- Keep `server.rip` as orchestration/wiring, not a dumping ground.
- Use bare `try` when the catch body is truly a no-op.
- Preserve the graduated runtime story:
  - simple app serving must stay simple
  - edge features must remain explicit and opt-in

## Operator-facing features to protect

Be careful when changing anything that affects:

- `--edgefile`
- `--check-config`
- `POST /reload` on the control socket
- `/diagnostics`
- reload history and rollback reason reporting
- wildcard hosts
- websocket proxy routes
- stream passthrough listeners and connection drain semantics
- shared-port HTTPS multiplexer mode for `streams.listen == httpsPort`

These are now part of the runtime’s public operator contract.
