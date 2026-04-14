<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Server - @rip-lang/server

> Rip Server serves content: static sites, Rip apps, proxied HTTP services, and TCP/TLS services -- all from one Bun-native runtime.

Here, `content` means anything you want to make reachable over the network. That
may be a static site, a small Rip app, an HTTP service behind a proxy, a raw
TCP/TLS service, or a containerized tool you want to publish.

Rip Server replaces the usual app framework + process manager + reverse proxy
stack with one runtime. Start with `rip server` for a single app. Add
`serve.rip` when you want multi-host routing, shared apps, named proxy
backends, reusable certs, or TCP/TLS passthrough. The job stays the same:
take something you have and make it reachable safely, cleanly, and coherently.

Written entirely in Rip. Runs on Bun.

## Serving Modes

- Static file and website serving
- Small app serving with Sinatra-style routing and `read()` validators
- HTTP / WebSocket reverse proxy
- Layer 4 TCP / TLS passthrough

## Serving Guarantees

- Managed worker pools with rolling restarts
- HTTPS, ACME, certificate reuse, and SNI routing
- Proxy health checks, retry behavior, and upstream timeouts
- Shared-port HTTPS multiplexer
- Atomic config reload with verification and rollback
- Drain semantics, diagnostics, and control APIs
- Composable `serve.rip` config

## Quick Start

### Install

```bash
bun add @rip-lang/server
```

### Single app

```coffee
import { get, read, start } from '@rip-lang/server'

get '/' ->
  'Hello from Rip Server!'

get '/users/:id' ->
  id = read 'id', 'id!'
  { user: { id, name: "User #{id}" } }

start()
```

Run it:

```bash
rip server
```

### Add `serve.rip`

Add `serve.rip` next to your entry file when you want host routing, proxy
backends, automatic TLS, or TCP/TLS passthrough.

## `serve.rip`

`serve.rip` is the one config file. Top-level keys: `ssl`, `sites`, `apps`,
`version`, `server`.

```coffee
export default
  ssl: '/path/to/ssl'

  sites:
    dev:  'local.example.com'
    prod: 'example.com'

  apps:
    web: 'dev prod'
```

### `ssl`

Path to a directory of `.crt`/`.key` file pairs. Rip scans the directory,
parses X509 SANs, and automatically matches certificates to hostnames.

### `sites`

Named aliases mapping to hostnames:

```coffee
sites:
  dev:    'local.medlabs.health'
  prod:   'medlabs.health'
  incus:  'incus.trusthealth.com'
```

### `apps`

String-based app specs binding targets to sites:

```coffee
apps:
  medlabs: 'dev prod'
  patient: '../patient dev prod'
  incus:   'https://10.0.0.50:8443 incus'
  mysql:   'tcp://10.0.0.50:3306 db'
```

Target kind is inferred from prefix:

| Prefix | Kind | Behavior |
|--------|------|----------|
| `./`, `../`, `/` | local | Rip app at that path |
| *(none)* | local | Rip app in current directory |
| `http://`, `https://` | HTTP proxy | Reverse proxy to URL |
| `tcp://` | TCP proxy | Layer 4 SNI passthrough |

Rules:

- Each site may be bound by exactly one app
- TCP targets must include a port
- HTTP proxy routes automatically enable WebSocket upgrade
- If a TCP stream route shares the HTTPS port, Rip switches into multiplexer
  mode: matching SNI is passed through at Layer 4, everything else falls
  through to Rip's internal HTTPS server

### `server`

Optional global settings:

```coffee
server:
  hsts: true
  acme: ['example.com']
  timeouts:
    connectMs: 2000
    readMs: 30000
```

## Clean Example

```coffee
export default
  ssl: '/ssl'

  server:
    hsts: true
    acme: ['medlabs.health', 'trusthealth.com']

  sites:
    dev:      'local.medlabs.health'
    prod:     'medlabs.health'
    incus:    'incus.trusthealth.com'
    db:       'db.trusthealth.com'

  apps:
    medlabs:  'dev prod'
    patient:  '../patient dev prod'
    incus:    'https://10.0.0.50:8443 incus'
    mysql:    'tcp://10.0.0.50:3306 db'
```

## Operator Runbook

### Start with an explicit config file

```bash
rip server --file=./serve.rip
```

### Validate config without serving

```bash
rip server --check-config
rip server --check-config --file=./serve.rip
```

### Reload config safely

```bash
kill -HUP "$(cat /tmp/rip_myapp.pid)"
```

or:

```bash
curl --unix-socket /tmp/rip_myapp.ctl.sock -X POST http://localhost/reload
```

### Binding to ports 80 and 443

Ports below 1024 require elevated privileges. If you see a permission
error on startup, grant Bun the capability once:

```bash
sudo setcap cap_net_bind_service=+ep $(which bun)
```

This survives reboots but **not Bun upgrades** — re-run it after
`bun upgrade`.

### Diagnostics

```bash
curl http://localhost/diagnostics
```

The `config` section reports:

- active `serve.rip` path
- version
- counts for apps, proxies, hosts, routes, and streams
- active route descriptions
- reload history and rollback details

## Realtime

Rip Server includes built-in WebSocket pub/sub while your backend stays
HTTP-oriented.

## Security

Built-in protections include:

- conflicting `Content-Length` + `Transfer-Encoding` rejection
- multiple `Host` header rejection
- oversized URL rejection
- null-byte URL rejection
- path traversal protection for static serving

## Roadmap

- Prometheus / OpenTelemetry metrics export
- Inline edge handlers
- HTTP response caching at the edge

## License

MIT
