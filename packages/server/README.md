<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Server - @rip-lang/server

> **A production-grade application server with multi-worker processes, hot reload, HTTPS, and mDNS — written entirely in Rip**

Rip Server is a self-contained application server that turns any
[@rip-lang/api](https://github.com/shreeve/rip-lang/tree/main/packages/api)
app into a production-ready service. It handles multi-worker process management,
rolling restarts, automatic TLS certificates, mDNS service discovery, and
request load balancing — all in a single 1,200-line file with zero external
dependencies.

## Features

- **Multi-worker architecture** — Automatic worker spawning based on CPU cores
- **Hot module reloading** — File-watch based reloading with `-w` flag
- **Rolling restarts** — Zero-downtime deployments
- **Automatic HTTPS** — TLS with mkcert or self-signed certificates
- **mDNS discovery** — `.local` hostname advertisement
- **Request queue** — Built-in request buffering and load balancing
- **Built-in dashboard** — Server status UI at `rip.local`
- **Powered by @rip-lang/api** — Runs any Rip API app

| File | Lines | Role |
|------|-------|------|
| `server.rip` | ~1,210 | Complete server: CLI, workers, load balancing, TLS, mDNS |
| `server.html` | ~420 | Built-in dashboard UI |

> **See Also**: For the API framework, see [@rip-lang/api](../api/README.md). For the DuckDB server, see [@rip-lang/db](../db/README.md).

## Quick Start

### Installation

```bash
# Local (per-project)
bun add @rip-lang/server

# Global (use rip-server from anywhere)
bun add -g rip-lang @rip-lang/server
```

### Running Your App

```bash
# From your app directory (uses ./index.rip by default)
rip-server

# With file watching (recommended for development)
rip-server -w

# Name your app (for mDNS: myapp.local)
rip-server myapp

# Explicit entry file
rip-server ./app.rip

# HTTP only mode
rip-server http
```

### Example App

Create `index.rip`:

```coffee
import { get, read, start } from '@rip-lang/api'

get '/', ->
  'Hello from Rip Server!'

get '/json', ->
  { message: 'It works!', timestamp: Date.now() }

get '/users/:id', ->
  id = read 'id', 'id!'
  { user: { id, name: "User #{id}" } }

start()
```

Run it:

```bash
rip-server -w
```

Test it:

```bash
curl http://localhost/
# Hello from Rip Server!

curl http://localhost/json
# {"message":"It works!","timestamp":1234567890}

curl http://localhost/users/42
# {"user":{"id":42,"name":"User 42"}}

curl http://localhost/status
# {"status":"healthy","app":"myapp","workers":5,"ports":{"https":443}}
```

## App Path & Naming

### Entry File Resolution

When you run `rip-server`, it looks for your app's entry file:

```bash
# No arguments: looks for index.rip (or index.ts) in current directory
rip-server

# Directory path: looks for index.rip (or index.ts) in that directory
rip-server ./myapp/

# Explicit file: uses that file directly
rip-server ./app.rip
rip-server ./src/server.ts
```

### App Naming

The **app name** is used for mDNS discovery (e.g., `myapp.local`) and logging. It's determined by:

```bash
# Default: current directory name becomes app name
~/projects/api$ rip-server        # app name = "api"

# Explicit name: pass a name that's not a file path
rip-server myapp                  # app name = "myapp"

# With aliases: name@alias1,alias2
rip-server myapp@api,backend      # accessible at myapp.local, api.local, backend.local

# Path with alias
rip-server ./app.rip@myapp        # explicit file + custom app name
```

**Examples:**

```bash
# In ~/projects/api/ with index.rip
rip-server                        # app = "api", entry = ./index.rip
rip-server -w                     # same, with file watching
rip-server myapp                  # app = "myapp", entry = ./index.rip
rip-server myapp -w               # same, with file watching
rip-server ./server.rip           # app = "api", entry = ./server.rip
rip-server ./server.rip@myapp     # app = "myapp", entry = ./server.rip
```

## File Watching

### Development Mode with `-w`/`--watch`

The `-w` flag enables **directory watching** — any `.rip` file change in your app directory triggers an automatic hot reload:

```bash
# Watch all .rip files (default pattern: *.rip)
rip-server -w
rip-server --watch

# Watch a custom pattern
rip-server -w=*.ts
rip-server --watch=*.tsx
```

**How it works:**

1. Uses OS-native file watching (FSEvents on macOS, inotify on Linux)
2. Watches the entire app directory recursively
3. When a matching file changes, touches the entry file
4. The existing hot-reload mechanism detects the change and does a rolling restart

**This is efficient:**

- Single watcher in the main process (not per-worker)
- No polling — OS notifies on changes
- Zero overhead when files aren't changing

**Examples:**

```bash
# Typical development setup
rip-server -w                     # Watch *.rip files

# TypeScript project
rip-server -w=*.ts                # Watch *.ts files

# React/frontend project
rip-server -w=*.tsx               # Watch *.tsx files

# Multiple concerns? Just use the broader pattern
rip-server -w=*.rip               # Only Rip files (default)
```

**Without `-w`:** Only the entry file (`index.rip`) is watched. Changes to imported files won't trigger reload unless you also touch the entry file.

## CLI Reference

### Basic Syntax

```bash
rip-server [flags] [app-path] [app-name]
rip-server [flags] [app-path]@<alias1>,<alias2>,...
```

### Getting Help

```bash
rip-server -h          # Show help
rip-server --help      # Show help
rip-server -v          # Show version
rip-server --version   # Show version
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-h`, `--help` | Show help and exit | — |
| `-v`, `--version` | Show version and exit | — |
| `-w`, `--watch` | Watch `*.rip` files for changes | Disabled |
| `-w=<glob>`, `--watch=<glob>` | Watch custom pattern (e.g., `*.ts`) | — |
| `--env=<mode>` | Environment mode (`dev`, `prod`) | `development` |
| `--debug` | Enable debug logging | Disabled |
| `--static` | Disable hot reload (production) | Hot reload enabled |
| `http` | HTTP-only mode (no HTTPS) | HTTPS enabled |
| `https` | HTTPS mode (explicit) | Auto |
| `http:<port>` | Set HTTP port | 80 or 5700 |
| `https:<port>` | Set HTTPS port | 443 or 5700 |
| `w:<n>` | Worker count (`auto`, `half`, `2x`, `3x`, or number) | `half` of cores |
| `r:<reqs>,<secs>s` | Restart policy: requests, seconds (e.g., `5000,3600s`) | `10000,3600s` |
| `--cert=<path>` | TLS certificate path | Auto-generated |
| `--key=<path>` | TLS private key path | Auto-generated |
| `--auto-tls` | Try mkcert first, then self-signed | Self-signed only |
| `--hsts` | Enable HSTS headers | Disabled |
| `--no-redirect-http` | Don't redirect HTTP to HTTPS | Redirects enabled |
| `--json-logging` | Output JSON access logs | Human-readable |
| `--no-access-log` | Disable access logging | Enabled |

### Subcommands

```bash
# Stop running server
rip-server stop

# List registered hosts
rip-server list
```

### Examples

```bash
# Development with file watching (recommended)
rip-server -w

# Development: HTTP on any available port
rip-server http

# Development: HTTPS with mkcert
rip-server --auto-tls

# Production: 8 workers, HTTPS, no hot reload
rip-server --env=prod --static w:8

# Custom port
rip-server http:3000

# With mDNS aliases (accessible as myapp.local and api.local)
rip-server myapp@api

# Watch TypeScript files
rip-server -w=*.ts

# Debug mode to troubleshoot issues
rip-server --debug -w

# Restart workers after 5000 requests or 1 hour
rip-server r:5000,3600s
```

## Architecture

### Self-Spawning Design

The server uses a single-file, self-spawning architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Server    │  │   Manager   │  │  Control Socket │  │
│  │ (HTTP/HTTPS)│  │  (Workers)  │  │   (Commands)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
└─────────┼────────────────┼──────────────────┼───────────┘
          │                │                  │
          ▼                ▼                  │
    ┌──────────┐    ┌──────────────┐          │
    │ Requests │    │ Spawn/Monitor│          │
    └────┬─────┘    └──────┬───────┘          │
         │                 │                  │
         ▼                 ▼                  │
┌─────────────────────────────────────────────│───┐
│              Worker Processes               │   │
│  ┌────────┐ ┌────────┐ ┌────────┐           │   │
│  │Worker 0│ │Worker 1│ │Worker N│  ◄────────┘   │
│  │(Unix)  │ │(Unix)  │ │(Unix)  │               │
│  └────────┘ └────────┘ └────────┘               │
└─────────────────────────────────────────────────┘
```

When `RIP_SETUP_MODE=1` is set, the same file runs the one-time setup phase. When `RIP_WORKER_MODE=1` is set, it runs as a worker.

### Startup Lifecycle

1. **Setup** — If `setup.rip` exists next to the entry file, it runs once in a temporary process before any workers spawn. Use this for database migrations, table creation, and seeding.
2. **Workers** — N worker processes are spawned, each loading the entry file and serving requests.

### Request Flow

1. **Main Process** receives HTTP/HTTPS request
2. **Server** selects available worker from pool
3. **Request** forwarded via Unix socket
4. **Worker** processes request, returns response
5. **Server** forwards response to client

### Hot Reloading

Two layers of hot reload work together in development:

- **API changes** (`-w` flag) — The Manager watches for `.rip` file changes in the API directory and triggers rolling worker restarts (zero downtime, server-side).
- **UI changes** (`watch: true` in `serve`) — Workers register their app's component directories with the Manager via the control socket. The Manager watches those directories and broadcasts SSE reload events to connected browsers (client-side). SSE connections are held by the long-lived Server process, not by workers.

Use `--static` in production to disable hot reload entirely.

### Worker Lifecycle

Workers are automatically recycled to prevent memory leaks and ensure reliability:

- **maxRequests**: Restart worker after N requests (default: 10,000)
- **maxSeconds**: Restart worker after N seconds (default: 3,600)

## Built-in Endpoints

The server provides these endpoints automatically:

| Endpoint | Description |
|----------|-------------|
| `/status` | Health check with worker count and uptime |
| `/server` | Simple "ok" response for load balancer probes |

## TLS Certificates

### Automatic Certificate Generation

When HTTPS is enabled without explicit certificates, the server will:

1. Try **mkcert** (if installed and `--auto-tls` flag used)
2. Fall back to **self-signed** certificate via OpenSSL

Certificates are stored in `~/.rip/certs/`.

### Custom Certificates

```bash
rip-server --cert=/path/to/cert.pem --key=/path/to/key.pem
```

## mDNS Service Discovery

The server automatically advertises itself via mDNS (Bonjour/Zeroconf):

```bash
# App accessible at myapp.local
rip-server myapp

# Multiple aliases
rip-server myapp@api,backend
```

Requires `dns-sd` (available on macOS by default).

## App Requirements

Your app must provide a fetch handler. Three patterns are supported:

### Pattern 1: Use `@rip-lang/api` with `start()` (Recommended)

```coffee
import { get, start } from '@rip-lang/api'

get '/', -> 'Hello!'

start()
```

The `start()` function automatically detects when running under `rip-server` and registers the handler.

### Pattern 2: Export fetch function directly

```coffee
export default (req) ->
  new Response('Hello!')
```

### Pattern 3: Export object with fetch method

```coffee
export default
  fetch: (req) -> new Response('Hello!')
```

## One-Time Setup

If a `setup.rip` file exists next to your entry file, rip-server runs it
automatically **once** before spawning any workers. This is ideal for database
migrations, table creation, and seeding.

```coffee
# setup.rip — runs once before workers start
export setup = ->
  await createTables()
  await seedData()
  console.log 'Database ready'
```

The setup function can export as `setup` or `default`. If the file doesn't
exist, the setup phase is skipped entirely (no overhead). If setup fails,
the server exits immediately.

## Environment Variables

Most settings are configured via CLI flags, but environment variables provide an alternative for containers, CI/CD, or system-wide defaults.

**Essential:**

| Variable | CLI Equivalent | Default | Description |
|----------|----------------|---------|-------------|
| `NODE_ENV` | `--env=` | `development` | Environment mode (`development` or `production`) |
| `RIP_DEBUG` | `--debug` | — | Enable debug logging |
| `RIP_STATIC` | `--static` | `0` | Set to `1` to disable hot reload |

**Advanced (rarely needed):**

| Variable | CLI Equivalent | Default | Description |
|----------|----------------|---------|-------------|
| `RIP_MAX_REQUESTS` | `r:N,...` | `10000` | Max requests before worker recycle |
| `RIP_MAX_SECONDS` | `r:...,Ns` | `3600` | Max seconds before worker recycle |
| `RIP_MAX_QUEUE` | `--max-queue=` | `512` | Request queue limit |
| `RIP_QUEUE_TIMEOUT_MS` | `--queue-timeout-ms=` | `30000` | Queue wait timeout (ms) |
| `RIP_CONNECT_TIMEOUT_MS` | `--connect-timeout-ms=` | `2000` | Reserved for future use |
| `RIP_READ_TIMEOUT_MS` | `--read-timeout-ms=` | `30000` | Worker read timeout (ms) |

## Dashboard

The server includes a built-in dashboard accessible at `http://rip.local/` (when mDNS is active). This is a **meta-UI for the server itself**, not your application.

**Dashboard Features:**

- **Server Status** — Health status and uptime
- **Worker Overview** — Active worker count
- **Registered Hosts** — All mDNS aliases being advertised
- **Server Ports** — HTTP/HTTPS port configuration

The dashboard uses the same mDNS infrastructure as your app, so it's always available at `rip.local` when any rip-server instance is running.

## Troubleshooting

**Port 80/443 requires sudo**: Use `http:3000` or another high port, or run with sudo.

**mDNS not working**: Ensure `dns-sd` is available (built into macOS). On Linux, install Avahi.

**Workers keep restarting**: Use `--debug` (or `RIP_DEBUG=1`) to see import errors in your app.

**Changes not triggering reload**: Make sure you're using `-w` flag for directory watching, or touch your entry file manually.

## Serving Rip UI Apps

Rip Server works seamlessly with the `serve` middleware for serving
reactive web applications with hot reload. The `serve` middleware handles
framework files, page manifests, and SSE hot-reload — rip-server adds HTTPS,
mDNS, multi-worker load balancing, and rolling restarts on top.

### Example: Rip UI App

Create `index.rip`:

```coffee
import { get, use, start, notFound } from '@rip-lang/api'
import { serve } from '@rip-lang/api/serve'

dir = import.meta.dir

use serve dir: dir, title: 'My App', watch: true

get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"

notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'

start()
```

Run it:

```bash
rip-server -w
```

This gives you:

- **Framework bundle** served at `/rip/rip.min.js`
- **App bundle** auto-generated at `/{app}/bundle`
- **Hot reload** via SSE at `/{app}/watch` — save a `.rip` file and the browser
  updates instantly
- **HTTPS + mDNS** — access at `https://myapp.local`
- **Multi-worker** — load balanced across CPU cores
- **Rolling restarts** — zero-downtime file-watch reloading

### How Hot Reload Works with rip-server

When running with `-w`, two layers of hot reload work together:

1. **API hot reload** (`-w` flag) — The Manager watches for `.rip` file changes
   in the API directory and triggers rolling worker restarts (server-side).
2. **UI hot reload** (`watch: true`) — Workers register their component
   directories with the Manager via the control socket. The Manager watches
   those directories and tells the Server to broadcast SSE reload events to
   connected browsers (client-side).

SSE connections are held by the long-lived Server process, not by recyclable
workers, ensuring stable hot-reload connections. Each app prefix gets its own
SSE pool for multi-app isolation.

## Comparison with Other Servers

| Feature | rip-server | PM2 | Nginx |
|---------|------------|-----|-------|
| Pure Rip | ✅ | ❌ | ❌ |
| Single File | ✅ (~1,200 lines) | ❌ | ❌ |
| Hot Reload | ✅ | ✅ | ❌ |
| Directory Watch | ✅ (`-w` flag) | ✅ | ❌ |
| Multi-Worker | ✅ | ✅ | ✅ |
| Auto HTTPS | ✅ | ❌ | ❌ |
| mDNS | ✅ | ❌ | ❌ |
| Zero Config | ✅ | ❌ | ❌ |
| Built-in LB | ✅ | ❌ | ✅ |

## Roadmap

> *Planned improvements for future releases:*

- [ ] Request ID tracing for debugging
- [ ] Metrics endpoint (Prometheus format)
- [ ] Static file serving
- [ ] Rate limiting
- [ ] Performance benchmarks

## License

MIT

## Links

- [Rip Language](https://github.com/shreeve/rip-lang)
- [@rip-lang/api](../api/README.md) — API framework (routing, middleware, `@send`)
- [Rip](https://github.com/shreeve/rip-lang) — Compiler + reactive UI framework
- [Report Issues](https://github.com/shreeve/rip-lang/issues)
