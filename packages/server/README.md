<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Server - @rip-lang/server

> Rip Server serves content: static sites, Rip apps, proxied HTTP services, and TCP/TLS services from one Bun-native runtime.

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
- Composable `serve.rip` config with reusable groups and rules

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

Add `serve.rip` next to your entry file when you want host routing, shared
apps, proxy backends, reusable TLS, or TCP passthrough.

## Canonical `serve.rip`

`serve.rip` is the one config file. There are no alternate config formats.

Canonical top-level keys:

- `version`
- `server` (`edge` is a deprecated alias)
- `certs`
- `proxies`
- `apps`
- `rules`
- `groups`
- `hosts`
- `streams`

`hosts` is the canonical authoring surface. Reuse happens through:

- `certs` for reusable TLS identities
- `proxies` for named HTTP or TCP backends
- `rules` for reusable HTTP route bundles
- `groups` for reusable hostname lists

Everything normalizes into concrete hosts, resolved TLS pairs, concrete route
lists, and concrete stream routes.

### Minimal shape

```coffee
export default
  version: 1
  server: {}
  certs: {}
  proxies: {}
  apps: {}
  rules: {}
  groups: {}
  hosts: {}
  streams: []
```

## Config Reference

### `certs`

Preferred shorthand:

```coffee
certs:
  trusthealth: '/ssl/trusthealth.com'
```

This expands to:

- `cert: '/ssl/trusthealth.com.crt'`
- `key: '/ssl/trusthealth.com.key'`

Explicit object form is also allowed.

### `proxies`

Named backend proxy targets. Transport is inferred from URL scheme:

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

Mixed scheme families in one proxy are invalid.

### `apps`

Named managed Rip apps with worker and queue settings.

### `rules`

Reusable HTTP rule bundles:

```coffee
rules:
  web: [
    { path: '/api/*', proxy: 'api' }
    { path: '/*', app: 'web' }
  ]
```

You do not have to use `rules`. Hosts may also define inline rules.

### `groups`

Reusable hostname lists.

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

- host rules use `proxy`, not `upstream`
- rule arrays can be inline, reusable, or mixed
- rules inside a host block must not specify `host`
- `proxy` shorthand can target HTTP or TCP proxies
- if host-level `proxy` points to a TCP proxy, Rip creates the default `:443` SNI stream route for that host

### `streams`

Explicit Layer 4 routes:

```coffee
streams: [
  { listen: 443, sni: ['db.example.com'], proxy: 'db' }
]
```

If a stream route shares the HTTPS port, Rip switches that port into shared
multiplexer mode: matching SNI is passed through at Layer 4, and everything
else falls through to Rip's internal HTTPS server.

## Clean Example

```coffee
export default
  version: 1

  server:
    hsts: true
    trustedProxies: ['10.0.0.0/8', '127.0.0.1']
    timeouts:
      connectMs: 2000
      readMs: 30000
    verify:
      requireHealthyProxies: true
      requireReadyApps: true
      includeUnroutedManagedApps: false
      minHealthyTargetsPerProxy: 1

  certs:
    trusthealth: '/ssl/trusthealth.com'
    zion: '/ssl/zionlabshare.com'

  proxies:
    api:
      hosts: ['http://127.0.0.1:7201']
      check:
        path: '/health'
        intervalMs: 5000
        timeoutMs: 2000

    redmine:
      hosts: ['http://127.0.0.1:7101']
      check:
        path: '/'
        intervalMs: 5000
        timeoutMs: 2000

    incus:
      hosts: ['tcp://127.0.0.1:8443']

  apps:
    web:
      entry: './apps/web/index.rip'
      workers: 4

    admin:
      entry: './apps/admin/index.rip'
      workers: 2

  rules:
    web: [
      { path: '/api/*', proxy: 'api' }
      { path: '/*', app: 'web' }
    ]

    admin: [
      { path: '/api/*', proxy: 'api' }
      { path: '/*', app: 'admin' }
    ]

    redmine: [
      { path: '/*', proxy: 'redmine' }
    ]

  groups:
    trustSites: ['trusthealth.com', 'www.trusthealth.com']
    zionSites: ['zionlabshare.com', 'www.zionlabshare.com']

  hosts:
    trustSites:
      hosts: 'trustSites'
      cert: 'trusthealth'
      rules: 'web'

    zionSites:
      hosts: 'zionSites'
      cert: 'zion'
      rules: 'web'

    'admin.trusthealth.com':
      cert: 'trusthealth'
      rules: 'admin'

    'projects.trusthealth.com':
      cert: 'trusthealth'
      rules: 'redmine'

    'incus.trusthealth.com':
      proxy: 'incus'
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
