<img src="https://raw.githubusercontent.com/shreeve/rip-packages/main/packages/server/docs/logo.png" alt="Rip" height="75" />

# @rip-lang/server

**Fast, resilient app server for Rip applications — from dev to prod**

Rip Server runs your app with serious speed and durability. It starts instantly for local work, scales across multiple workers, survives failures, reloads gracefully, and ships with a live dashboard and clean `.local` access for phones on your LAN.

## Why Rip Server

- **High performance**: Minimal server overhead and efficient worker forwarding. Server health checks hit 100K+ RPS; app routes commonly reach tens of thousands RPS.
- **Resilient by design**: If a worker crashes, the server keeps serving with the remaining workers and the manager brings a fresh one online. Rolling restarts replace workers without dropping in-flight requests.
- **HTTPS-first**: One command brings up TLS (cert/key, mkcert, or self-signed fallback). Optional HTTP→HTTPS redirect and HSTS.
- **Instant local access**: Declare aliases like `apps/api@mobile` and get `mobile.local` on your LAN via Bonjour/mDNS. The dashboard lives at `rip.local`.
- **Developer-friendly**: Live dashboard, structured logs, smart defaults, and quick, orthogonal flags.

## Quick Start

```bash
# Start your app (HTTPS by default)
bun server apps/labs/api

# Add clean LAN aliases (great for phones/tablets)
bun server apps/labs/api@api,mobile,demo

# Prefer HTTP-only with a specific port
bun server http:5700 apps/labs/api

# See allowed hosts; stop the server
bun server list
bun server stop
```

What you get immediately:
- `rip.local` → live server dashboard
- `api.local` → your app (from the aliases above)

## Architecture

### How It Works

- Rip Server runs a server process that accepts requests and forwards them to a pool of isolated workers.
- Each worker handles one request at a time. The server picks an idle worker (LIFO) to keep caches warm and tail latencies low.
- If a worker is busy, the server retries another. If a worker dies, the server removes it and continues serving; the manager respawns a fresh one.
- Rolling restarts spin up new workers first, switch traffic to them, then retire the old ones—so you can redeploy under load without dropping requests.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| **Server** | `server.ts` | HTTP entry + per-worker selector |
| **Manager** | `manager.ts` | Process manager, spawns and monitors workers |
| **Worker** | `worker.ts` | Single-inflight request handlers with reload support |
| **CLI** | `rip-server.ts` | Command-line interface |
| **Utils** | `utils.ts` | Shared utilities and flag parsing |

### Request Flow

```
HTTP Request → Server → Select idle worker → Unix socket → Worker process → Response
```

## The @ Alias System

The `@` symbol is the universal operator for all alias operations, creating clean separation between commands and user-defined names.

```bash
# Default: app name becomes the alias
bun server apps/labs/api              # → api.local

# Explicit: @ defines exact aliases (replaces default)
bun server apps/labs/api@labs         # → ONLY labs.local
bun server apps/labs/api@labs,test    # → labs.local + test.local
```

**Why @ works:**
- **No naming conflicts**: You can have an alias called "stop" or "list"
- **Visual clarity**: The @ makes aliases jump out in commands
- **Future-proof**: New CLI features won't break existing aliases

## CLI Reference

### Basic Usage

```bash
bun server <app-path> [options]
```

### Port Configuration

```bash
# HTTPS (default) - tries 443, then probes from 5700+
bun server apps/labs/api

# HTTPS on specific port
bun server 5700 apps/labs/api
bun server https:8443 apps/labs/api

# HTTP only - tries 80, then probes from 5700+
bun server http apps/labs/api
bun server http:3000 apps/labs/api
```

### Worker Management

```bash
# Scale workers
bun server w:auto apps/labs/api    # Number of CPU cores
bun server w:half apps/labs/api    # Half of cores (default)
bun server w:8 apps/labs/api       # Specific number

# Restart budgets (whichever triggers first)
bun server r:20000 apps/labs/api              # After 20,000 requests
bun server r:20000,1800s apps/labs/api        # Or after 30 minutes
bun server r:20000,1800s,10r apps/labs/api    # Or after 10 module reloads
```

### TLS Options

```bash
# Auto TLS (mkcert → self-signed fallback)
bun server --auto-tls apps/labs/api

# Custom certificates
bun server --cert=/path/cert.pem --key=/path/key.pem apps/labs/api

# Security options
bun server --hsts apps/labs/api              # Enable HSTS
bun server --no-redirect-http apps/labs/api  # Disable HTTP→HTTPS redirect
```

### Reload Modes

```bash
# Process reload (default) - clean, deterministic
bun server apps/labs/api

# Module reload - fast development
bun server --reload=module apps/labs/api

# No reload
bun server --reload=none apps/labs/api
```

### Logging

```bash
# Human-readable logs (default)
bun server apps/labs/api

# JSON logs (for production parsing)
bun server --json-logging apps/labs/api

# Disable access logs
bun server --no-access-log apps/labs/api
```

### Performance Tuning

| Flag | Description | Default |
|------|-------------|---------|
| `--max-queue=N` | Max queued requests | 4096 |
| `--queue-timeout-ms=N` | Queue timeout | 1000ms |
| `--connect-timeout-ms=N` | Worker connect timeout | 100ms |
| `--read-timeout-ms=N` | Worker read timeout | 3000ms |

### Commands

```bash
bun server list    # Show registered hosts
bun server stop    # Stop server and all workers
```

## Mobile Development

When you declare `.local` aliases, Rip Server automatically advertises them via Bonjour/mDNS, making them instantly accessible from any device on your LAN.

```bash
# Start with mobile aliases
bun server apps/labs/api@api,mobile,demo

# Your iPhone can now access:
# http://api.local
# http://mobile.local
# http://demo.local
```

**No more:**
- ❌ "What's your IP address?"
- ❌ Typing `192.168.x.x:8080` on phone keyboards
- ❌ IP addresses changing with DHCP

**Instead:**
- ✅ Clean, memorable URLs
- ✅ Works instantly on all Apple devices
- ✅ Zero configuration on the phone

## Dashboard

Open `https://rip.local` (or `http://rip.local:<port>` in HTTP-only mode) to see:

- **Server status**: healthy / degraded / offline
- **Active workers**: current worker count
- **Live uptime**: counts up every second
- **Registered hosts**: all your `.local` aliases

The dashboard refreshes silently every 10s and handles offline/degraded states gracefully.

## Health & Status Endpoints

```bash
# Health check
curl http://localhost:<port>/server
# Response: "ok"

# Full status JSON
curl http://localhost:<port>/status
# Response: { status, app, workers, ports, uptime, hosts }
```

## Common Recipes

### Development (Fast Iteration)

```bash
bun server --auto-tls --reload=module apps/labs/api@dev
```

### Production-Like

```bash
bun server --auto-tls w:auto r:50000,3600s --hsts --json-logging apps/labs/api
```

### Mobile Testing

```bash
bun server --auto-tls apps/labs/api@api,mobile,tablet
```

### HTTP Only (Simple)

```bash
bun server http:3000 apps/labs/api
```

## App Structure

Your app needs an entry point (`index.rip` or `index.ts`):

```
apps/labs/api/
├── index.rip       ← Entry point
├── routes/
│   └── users.rip
└── db/
    └── schema.rip
```

The entry point should export a `default` or `fetch` handler:

```coffeescript
# Simple handler
export default (req) ->
  new Response 'Hello from Rip!'

# Or using Hono
import { Hono } from 'hono'
app = new Hono()
app.get '/users', (c) -> c.json { users: [] }
export default app
```

## macOS Notes (Low Ports)

On recent macOS versions, binding port 80/443 without sudo is possible when listening on all interfaces (`0.0.0.0`), which exposes your server on your LAN.

| Use Case | Best Approach |
|----------|---------------|
| 📱 Mobile testing | `0.0.0.0` on port 80/443 |
| 💻 Solo development | Port 5700+ |
| ☕ Coffee shop | `sudo` + `127.0.0.1` |

## FAQ

**Does it handle WebSockets?** Yes, sockets are forwarded end-to-end through workers.

**Why not one giant process?** Small, replaceable workers isolate failures and memory growth, and make rolling updates reliable.

**Do I have to learn a framework?** No. Start your app entrypoint and handle requests. Rip Server focuses on running it fast and safely.

## Troubleshooting

### Port Already in Use

Server auto-probes for free ports. Check what's using it:

```bash
lsof -i :443
```

### .local Domains Not Working

- **macOS**: Should work out of the box (Bonjour built-in)
- **Linux**: `sudo apt install avahi-daemon`
- **Windows**: Install Bonjour Print Services

### Browser Certificate Warnings

1. Use `--auto-tls` flag
2. Install mkcert: `brew install mkcert && mkcert -install`
3. Or click "Advanced" → "Proceed" for self-signed certs

---

Built with ❤️ for high-performance Rip applications.
