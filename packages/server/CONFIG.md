# Serve Reference

This document is the reference for `serve.rip` and the runtime behavior behind
it.

Rip Server serves content. Here, `content` means anything you want to make
reachable over the network: a static site, a Rip app, a proxied HTTP service,
or a TCP/TLS service.

`serve.rip` is the operator model for publishing and routing that content.

## Canonical shape

```coffee
export default
  ssl: '/path/to/ssl'

  sites:
    dev:  'local.example.com'
    prod: 'example.com'

  apps:
    web: 'dev prod'
```

Top-level keys: `ssl`, `hsts`, `acme`, `sites`, `apps`, `version`, `server`.

## Top-level sections

### `ssl`

Path to a directory containing `.crt` and `.key` file pairs. Rip scans the
directory, pairs files by stem name, parses X509 SANs, and automatically
matches certificates to hostnames.

```coffee
ssl: '/ssl'
```

Given `/ssl/example.com.crt` and `/ssl/example.com.key`, Rip reads the SANs
from the certificate and maps each hostname to that cert/key pair.

Relative paths resolve against the config file directory.

### `hsts`

Enable `Strict-Transport-Security` headers on HTTPS responses:

```coffee
hsts: true
```

Tells browsers to always use HTTPS for this domain. Can also be set inside
`server:` if you prefer grouping settings there.

### `acme`

Automatic certificate management via Let's Encrypt:

```coffee
acme: ['example.com', 'www.example.com']
```

Or `acme: true` to enable for all configured domains. HTTP-01 challenges are
served on port 80 automatically. Can also be set inside `server:`.

### `sites`

Named aliases mapping to hostnames:

```coffee
sites:
  dev:    'local.medlabs.health'
  prod:   'medlabs.health'
  incus:  'incus.trusthealth.com'
  db:     'db.trusthealth.com'
```

Site names are short labels used in app specs. Each hostname may only appear
once across all sites.

### `apps`

String-based app specs that bind targets to sites:

```coffee
apps:
  medlabs: 'dev prod'
  patient: '../patient dev prod'
  incus:   'https://10.0.0.50:8443 incus'
  mysql:   'tcp://10.0.0.50:3306 db'
  zion:    '/home/shreeve/www zion browse'
```

Each value is a space-separated string of tokens:

- **Site names** reference entries in `sites`
- **An optional target** specifies what to serve
- **Optional flags** (`browse`, `spa`) modify static serving behavior

Target kind is inferred from prefix:

| Prefix | Kind | Behavior |
|--------|------|----------|
| `./`, `../`, `/` | local | Rip app (if `index.rip` exists) or static files |
| *(none)* | local | Rip app in current directory or static files |
| `http://`, `https://` | HTTP proxy | Reverse proxy to URL |
| `tcp://` | TCP proxy | Layer 4 SNI passthrough |

Flags:

| Flag | Effect |
|------|--------|
| `browse` | Enable directory listing for static sites |
| `spa` | Single-page app fallback (serve `index.html` for missing paths) |

Rules:

- Each site may be bound by exactly one app
- TCP targets must include a port (`tcp://host:port`)
- Local targets with `index.rip` become Rip apps; without it, static file serving
- HTTP proxy routes automatically enable WebSocket upgrade

### `server`

Optional global settings:

```coffee
server:
  hsts: true
  acme: ['example.com', 'www.example.com']
  timeouts:
    connectMs: 2000
    readMs: 30000
  verify:
    requireHealthyProxies: true
    requireReadyApps: true
```

Fields:

- `acme` (boolean or array of domains)
- `cert`, `key` (explicit TLS paths)
- `certDir` (ACME certificate storage directory)
- `hsts` (enable Strict-Transport-Security)
- `trustedProxies` (array of trusted proxy addresses)
- `timeouts` (`connectMs`, `readMs`)
- `verify` (post-activate verification policy)

## Config lifecycle

### Goal

Config updates must be:

- atomic
- reversible
- observable
- safe for in-flight HTTP and websocket proxy traffic

### Apply pipeline

1. Parse — load `serve.rip`, evaluate synchronously
2. Validate — check top-level keys, sites, apps, URLs, ports
3. Normalize — expand app specs into routes, proxies, streams
4. Stage — build new runtime generation
5. Activate — swap active runtime atomically
6. Post-activate verify — check proxy health and app readiness
7. Rollback — restore previous snapshot if verification fails

### Trigger modes

- file watch on `serve.rip`
- `SIGHUP`
- control API: `POST /reload`

### Failure behavior

- Parse or validate failure: keep serving existing config
- Post-activate verification failure: rollback automatically

### Draining behavior

- Retired runtimes remain alive while:
  - HTTP requests that started on them are still in flight
  - websocket proxy connections that started on them are still open
- Health checks stop only after a retired runtime finishes draining

## Clean Example

```coffee
export default
  ssl: '/ssl'
  hsts: true
  acme: ['medlabs.health', 'trusthealth.com']

  sites:
    dev:      'local.medlabs.health'
    prod:     'medlabs.health'
    zion:     'dev.zionlabshare.com'
    incus:    'incus.trusthealth.com'
    db:       'db.trusthealth.com'

  apps:
    medlabs:  'dev prod'
    patient:  '../patient dev prod'
    zion:     '/home/shreeve/www zion browse'
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

### Generate nginx.conf

Generate a production-ready nginx.conf from your `serve.rip`:

```bash
rip server -n > /etc/nginx/nginx.conf && nginx -s reload
rip server -n --file=./serve.rip > nginx.conf
```

This outputs a complete nginx config with TLS hardening, rate limiting, security
headers, and WebSocket support. When TCP passthrough and HTTP sites share port
443, the output uses nginx's `stream` module with `ssl_preread` for SNI routing.

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
