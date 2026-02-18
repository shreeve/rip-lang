# Streamline Swim School

A full-stack demo app built with Rip — reactive UI, file-based routing, DuckDB
database, and session-based auth. This guide walks through everything needed to
run it locally from scratch.

## Prerequisites

Install [Bun](https://bun.sh) (JavaScript runtime) and [DuckDB](https://duckdb.org)
(embedded analytics database):

```bash
# Bun (required — Rip runs on Bun)
curl -fsSL https://bun.sh/install | bash

# DuckDB (required — the native library, used via Bun FFI)
brew install duckdb
```

## Install Rip and Rip DB

```bash
# Install rip-lang (the compiler) and rip-db (DuckDB HTTP server) globally
bun add -g rip-lang @rip-lang/db
```

Verify both are installed:

```bash
rip --version     # Should print: Rip 3.9.1 (or newer)
rip-db --version  # Should print: rip-db v1.1.x
```

## Clone the Repo

```bash
git clone https://github.com/shreeve/rip-lang.git
cd rip-lang
bun install
```

## Directory Structure

```
demos/streamline/
├── api/                  # Server (runs on Bun via Rip)
│   ├── index.rip         # Entry point — starts HTTP server on port 8304
│   ├── config.rip        # App configuration (port, DB URL, session settings)
│   ├── setup.rip         # Database bootstrap — creates tables and seeds data
│   ├── app.schema        # Data model definitions (User, Spot, Booking)
│   ├── .env              # Environment variables (DB_URL, OAuth keys)
│   ├── routes/
│   │   ├── auth.rip      # Authentication routes (email code, Google, Apple)
│   │   ├── bookings.rip  # Booking CRUD
│   │   ├── sessions.rip  # Session time slots
│   │   └── user.rip      # User profile
│   └── lib/
│       ├── stash.rip     # Config helper (nested dot-access)
│       ├── google.rip    # Google OAuth integration
│       └── apple.rip     # Apple Sign-In integration
│
└── app/                  # Client (reactive SPA served by the API)
    ├── index.html        # Shell HTML (loads Tailwind + Rip UI runtime)
    ├── routes/           # File-based routing (each .rip file = a page)
    │   ├── _layout.rip   # App shell (nav bar, drawer menu)
    │   ├── index.rip     # Home page
    │   ├── auth.rip      # Sign-in page
    │   ├── bookings.rip  # My bookings list
    │   ├── profile.rip   # User profile editor
    │   └── booking/
    │       ├── _layout.rip    # Booking flow layout (breadcrumb)
    │       ├── time.rip       # Step 1: Pick a week + time slot
    │       └── confirm.rip    # Step 2: Review and confirm
    └── components/       # Shared UI components
        ├── logo.rip
        ├── drawer.rip
        ├── container.rip
        ├── checkbox.rip
        ├── icon-button.rip
        ├── booking-info.rip
        ├── week-picker.rip
        └── not-found.rip
```

## Running the App

You need two processes: the DuckDB server and the Streamline API server.

### Terminal 1 — Start rip-db (DuckDB server)

```bash
rip-db
```

This starts an in-memory DuckDB instance on **http://localhost:4213**. You can
optionally open that URL in a browser to see the official DuckDB UI for running
queries directly.

To use a persistent database file instead of in-memory:

```bash
rip-db streamline.duckdb
```

### Terminal 2 — Start the Streamline server

```bash
cd demos/streamline/api
rip index.rip
```

You should see:

```
[setup] Database tables created
[setup] Seeded spots for weeks 1-4
rip-api listening on http://0.0.0.0:8304
```

The server automatically creates all database tables and seeds initial data on
every startup (it drops and recreates them fresh each time).

### Open the App

Open **http://localhost:8304** in your browser.

To sign in, go to the auth page and use **Sign in as Test User** (no real OAuth
credentials needed for local development).

## Environment Variables

The API reads from `api/.env`. The only required variable for local development
is `DB_URL`, which defaults to `http://localhost:4213` if not set.

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `http://localhost:4213` | rip-db server URL |
| `GOOGLE_CLIENT_ID` | _(empty)_ | Google OAuth client ID (optional) |
| `GOOGLE_CLIENT_SECRET` | _(empty)_ | Google OAuth secret (optional) |
| `APPLE_CLIENT_ID` | _(empty)_ | Apple Sign-In ID (optional) |

For local development, you don't need any OAuth credentials — just use the test
user sign-in.

## Quick Reference

| What | Command |
|------|---------|
| Start DuckDB server | `rip-db` |
| Start app server | `cd demos/streamline/api && rip index.rip` |
| DuckDB UI | http://localhost:4213 |
| Streamline app | http://localhost:8304 |
| Health check | `curl http://localhost:8304/ping` |
| View config | `curl http://localhost:8304/config` |
| List tables | `curl http://localhost:4213/tables` |

## How It Works

The Streamline server (`api/index.rip`) does the following on startup:

1. Connects to rip-db at the configured `DB_URL`
2. Drops and recreates all tables from `app.schema` (User, Spot, Booking)
3. Seeds 4 weeks of swim lesson time slots (09:00, 10:00, 11:00, 14:00)
4. Starts an HTTP server on port 8304
5. Serves the `app/` directory as a reactive SPA using Rip UI with file-based routing
6. Provides JSON API routes for auth, bookings, sessions, and user profile

The client is a single-page app that loads the Rip UI runtime and Tailwind CSS
from `app/index.html`. Each `.rip` file in `app/routes/` becomes a route —
`routes/index.rip` maps to `/`, `routes/auth.rip` maps to `/auth`, and so on.
