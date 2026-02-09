<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip DB - @rip-lang/db

> **A lightweight DuckDB HTTP server with the official DuckDB UI built in**

Rip DB turns any DuckDB database into a full-featured HTTP server — complete
with the official DuckDB UI for interactive queries, notebooks, and data
exploration. It connects to DuckDB via pure Bun FFI (no npm packages, no
native build step) and implements DuckDB's binary serialization protocol
to power the UI with native-speed data transfer.

## Quick Start

```bash
# Install DuckDB and Rip DB
brew install duckdb            # macOS (or see duckdb.org for Linux)
bun add -g @rip-lang/db        # Installs rip-db command

# Start the server
rip-db                          # In-memory database
rip-db mydata.duckdb            # File-based database
rip-db mydata.duckdb --port 8080
```

Open **http://localhost:4213** for the official DuckDB UI.

## What It Does

Rip DB sits between your clients and DuckDB, providing two interfaces:

```
┌─────────────┐          ┌─────────────┐          ┌─────────────┐
│  DuckDB UI  │  binary  │   rip-db    │   FFI    │   DuckDB    │
│  (Browser)  │◀────────▶│   (Bun)     │◀────────▶│  (native)   │
└─────────────┘          └─────────────┘          └─────────────┘
                               ▲
                               │ HTTP/S
                               │ (JSON)
                               ▼
                      ┌─────────────────┐
                      │  HTTP Clients   │
                      │  (curl, apps)   │
                      └─────────────────┘
```

**DuckDB UI** — The official DuckDB notebook interface loads instantly in your
browser. Rip DB proxies the UI assets from ui.duckdb.org and implements the
full binary serialization protocol that the UI uses to communicate with DuckDB.
This includes query execution, SQL tokenization for syntax highlighting, and
Server-Sent Events for real-time catalog updates.

**JSON API** — Any HTTP client can execute SQL queries and receive JSON
responses. Use it from curl, your application code, or any language that
speaks HTTP.

## Features

- **Official DuckDB UI** — Interactive notebooks, syntax highlighting, data exploration
- **Full binary protocol** — Native DuckDB UI serialization implemented in Rip
- **Pure Bun FFI** — Direct calls to DuckDB's C API using the modern chunk-based interface
- **Zero npm dependencies for DuckDB** — Uses the system-installed DuckDB library
- **Parameterized queries** — Prepared statements with type-safe parameter binding
- **Complete type support** — All DuckDB types handled natively, including UUID, DECIMAL, TIMESTAMP, LIST, STRUCT, MAP
- **DECIMAL precision preserved** — Exact string representation, never converted to floating point
- **Timestamps as UTC** — All timestamps returned as JavaScript Date objects (UTC)
- **Powered by @rip-lang/api** — Fast, lightweight HTTP server framework
- **Single binary** — One `rip-db` command, one process, one database

## JSON API

For programmatic access from any HTTP client.

### POST /sql

Execute SQL with optional parameters:

```bash
curl -X POST http://localhost:4213/sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM users WHERE id = $1", "params": [1]}'
```

### POST /

Execute raw SQL (body is the query):

```bash
curl -X POST http://localhost:4213/ -d "SELECT 42 as answer"
```

Response format:

```json
{
  "meta": [{"name": "answer", "type": "INTEGER"}],
  "data": [[42]],
  "rows": 1,
  "time": 0.001
}
```

### Other Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tables` | GET | List all tables |
| `/schema/:table` | GET | Table schema |

## DuckDB UI

The official DuckDB UI is available at the root URL. It provides:

- **SQL Notebooks** — Write and execute queries in a notebook interface
- **Syntax Highlighting** — Real-time SQL tokenization as you type
- **Data Exploration** — Browse tables, schemas, and query results
- **Multiple Databases** — Attach and query across databases

The UI communicates with Rip DB using DuckDB's binary serialization protocol,
which Rip DB implements in full. This means the UI works exactly as it does
with the official `duckdb -ui` command — same features, same performance.

## How It Works

Rip DB is built from three files:

| File | Lines | Role |
|------|-------|------|
| `db.rip` | ~390 | HTTP server — routes, middleware, UI proxy |
| `lib/duckdb.mjs` | ~800 | FFI driver — modern chunk-based DuckDB C API |
| `lib/duckdb-binary.rip` | ~550 | Binary serializer — DuckDB UI protocol |

The FFI driver uses DuckDB's modern chunk-based API (`duckdb_fetch_chunk`,
`duckdb_vector_get_data`) to read query results directly from columnar memory.
No deprecated per-value functions, no intermediate copies. For complex types
like DECIMAL, ENUM, LIST, and STRUCT, it uses DuckDB's logical type
introspection to read values with full fidelity.

The binary serializer implements the same wire protocol that DuckDB's official
UI extension uses. It handles all DuckDB types including native 16-byte UUID
serialization, uint64-aligned validity bitmaps, and proper timestamp encoding.

## Requirements

- **Bun** 1.0+
- **DuckDB** library installed on the system
  - macOS: `brew install duckdb`
  - Linux: Install from [duckdb.org](https://duckdb.org/docs/installation)
- **rip-lang** 2.8+ (installed automatically as a dependency)

Set `DUCKDB_LIB_PATH` if DuckDB is not in a standard location:

```bash
DUCKDB_LIB_PATH=/path/to/libduckdb.dylib rip-db
```

## License

MIT
