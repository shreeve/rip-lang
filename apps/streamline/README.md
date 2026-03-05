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
rip --version     # Should print: Rip 3.13.16 (or newer)
rip-db --version  # Should print: rip-db v1.3.x
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
├── index.rip             # Entry point — starts HTTP server on port 8304
├── config.rip            # App configuration (port, DB URL, session settings)
├── setup.rip             # Setup shim — rip serve runs this before spawning workers
├── app.schema            # Data model definitions (User, Spot, Booking)
├── .env                  # Environment variables (DB_URL, OAuth keys)
├── api/                  # Server-side logic
│   ├── db.rip            # Database connection, queries, and bootstrap (auto-starts rip-db)
│   ├── routes/
│   │   ├── auth.rip      # Authentication routes (email code, Google, Apple)
│   │   ├── bookings.rip  # Booking CRUD
│   │   ├── sessions.rip  # Session time slots
│   │   └── user.rip      # User profile
│   └── lib/
│       ├── stash.rip     # Config helper (nested dot-access)
│       ├── jwt.rip       # JWT signing and verification
│       ├── google.rip    # Google OAuth integration
│       └── apple.rip     # Apple Sign-In integration
│
└── app/                  # Client (reactive SPA served by the API)
    ├── index.html        # Shell HTML (loads Tailwind + Rip UI runtime)
    ├── app.css           # App-level styles
    ├── favicon.png       # App icon (inlined as data URL in index.html)
    ├── routes/           # File-based routing (each .rip file = a page)
    │   ├── _layout.rip   # App shell (nav bar, drawer menu)
    │   ├── index.rip     # Home page
    │   ├── auth.rip      # Sign-in page
    │   ├── bookings.rip  # My bookings list
    │   ├── profile.rip   # User profile editor
    │   ├── privacy.rip   # Privacy policy
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

From the project root:

```bash
cd demos/streamline
rip serve
```

On first run the server will:

1. Auto-start `rip-db` using `streamline.duckdb` (if not already running)
2. Create all database tables from `app.schema`
3. Seed 4 weeks of swim lesson time slots (09:00, 10:00, 11:00, 14:00)
4. Start the HTTP server on **http://localhost:8304**

You should see output like:

```
[setup] Starting rip-db streamline.duckdb...
[setup] DuckDB UI: http://localhost:4213
[setup] Tables created
[setup] Seeded 64 spots for weeks 1-4
```

No separate `rip-db` terminal is needed — the server manages it automatically.
The DuckDB UI is available at **http://localhost:4213** for running queries
directly.

### Open the App

Open **http://localhost:8304** in your browser.

To sign in, go to the auth page and use **Sign in as Test User** (no real OAuth
credentials needed for local development).

## Environment Variables

The server reads from `.env` in the streamline directory. The only required
variable for local development is `DB_URL`, which defaults to
`http://localhost:4213` if not set.

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
| Start the app | `cd demos/streamline && rip serve` |
| DuckDB UI | http://localhost:4213 |
| Streamline app | http://localhost:8304 |
| Health check | `curl http://localhost:8304/ping` |
| View config | `curl http://localhost:8304/config` |

## How It Works

The entry point (`index.rip`) does the following on startup:

1. Calls `setup()` from `api/db.rip` — auto-starts `rip-db` if needed, creates
   tables from `app.schema` if they don't exist, and seeds initial data
2. Starts an HTTP server on port 8304 using `@rip-lang/server`
3. Serves the `app/` directory as a reactive SPA using Rip UI with file-based routing
4. Provides JSON API routes for auth, bookings, sessions, and user profile

The client is a single-page app that loads the Rip UI runtime and Tailwind CSS
from `app/index.html`. Each `.rip` file in `app/routes/` becomes a route —
`routes/index.rip` maps to `/`, `routes/auth.rip` maps to `/auth`, and so on.
