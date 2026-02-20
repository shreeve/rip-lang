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

## Database Client

Rip DB includes an ActiveRecord-style database client for use in Rip
applications. Import it from `@rip-lang/db/client` — it talks to a running
`rip-db` server over HTTP with parameterized queries.

```rip
import { connect, query, findOne, findAll, Model } from '@rip-lang/db/client'

connect 'http://localhost:4213'   # optional — defaults to DB_URL env or localhost:4213
```

### Low-Level Queries

Every query uses parameterized placeholders (`$1`, `$2`, ...) to prevent SQL
injection. Results are automatically materialized into plain objects.

```rip
# Raw result (meta + data arrays)
result = query! "SELECT * FROM users WHERE active = $1", [true]

# Single object or null
user = findOne! "SELECT * FROM users WHERE id = $1", [42]

# Array of objects
users = findAll! "SELECT * FROM users WHERE role = $1", ['admin']
```

### Model Factory

Create a Model for any table to get a full set of CRUD operations and a
chainable query builder.

```rip
User = Model 'users'
```

#### Find & Count

```rip
user  = User.find! 42           # SELECT * FROM "users" WHERE id = $1
count = User.count!              # SELECT COUNT(*) ...
users = User.all!                # SELECT * FROM "users"
users = User.all! 10             # SELECT * FROM "users" LIMIT 10
```

#### Chainable Queries

All query methods return a new builder — chains are immutable and reusable.

```rip
User.where(active: true).order('name').limit(10).all!
User.where(active: true).offset(20).limit(10).all!
User.where('age > $1', [21]).all!
User.select('id, name').where(role: 'admin').first!
```

#### Where, Or, Not

```rip
# Object-style (null-aware — generates IS NULL / IS NOT NULL)
User.where(role: 'admin').all!
User.where(deleted_at: null).all!          # WHERE "deleted_at" IS NULL

# String-style with params
User.where('age > $1', [21]).all!

# OR conditions
User.where(active: true).or(role: 'admin').all!
User.where(active: true).or('role = $1', ['admin']).all!

# NOT conditions
User.where(active: true).not(role: 'banned').all!
User.not(deleted_at: null).all!            # WHERE "deleted_at" IS NOT NULL
```

#### Group & Having

```rip
User.group('role').select('role, count(*) as n').all!
User.group('role').having('count(*) > $1', [5]).select('role, count(*) as n').all!
```

#### Insert, Update, Upsert, Destroy

All mutations return the affected row(s) via `RETURNING *`.

```rip
# Insert — returns the new record
user = User.insert! { first_name: 'Alice', email: 'alice@example.com' }

# Update by id — returns the updated record
user = User.update! 42, { email: 'newemail@example.com' }

# Upsert — insert or update on conflict
user = User.upsert! { email: 'alice@example.com', name: 'Alice' }, on: 'email'

# Destroy by id — returns the deleted record
user = User.destroy! 42
```

#### Bulk Update & Destroy via Query Builder

Chain `.where()` with `.update!` or `.destroy!` for bulk operations.

```rip
# Update all matching rows
User.where(role: 'guest').update! { role: 'member' }

# Delete all matching rows
User.where(active: false).destroy!
```

#### Raw Parameterized Queries

For anything the builder doesn't cover, drop down to raw SQL.

```rip
users = User.query! "SELECT * FROM users WHERE dob > $1", ['2000-01-01']
```

#### Cross-Database Queries

Pass a database name to query attached DuckDB databases.

```rip
Archive = Model 'orders', 'archive_db'
order = Archive.find! 99    # SELECT * FROM "archive_db"."orders" WHERE id = $1
```

### Query Builder Reference

| Method | Description |
|--------|-------------|
| `.where(obj)` | AND conditions from object (`null` becomes `IS NULL`) |
| `.where(sql, params)` | AND with raw SQL fragment |
| `.or(obj)` | OR conditions from object |
| `.or(sql, params)` | OR with raw SQL fragment |
| `.not(obj)` | AND NOT conditions (`null` becomes `IS NOT NULL`) |
| `.not(sql, params)` | AND NOT with raw SQL fragment |
| `.select(cols)` | Columns to select (string or array) |
| `.order(expr)` | ORDER BY expression |
| `.group(expr)` | GROUP BY expression |
| `.having(sql, params)` | HAVING clause with params |
| `.limit(n)` | LIMIT |
| `.offset(n)` | OFFSET |
| `.all!` | Execute, return array of objects |
| `.first!` | Execute with LIMIT 1, return object or null |
| `.count!` | Execute COUNT(*), return number |
| `.update!(data)` | Bulk UPDATE matching rows, return array |
| `.destroy!` | Bulk DELETE matching rows, return array |

### Model Reference

| Method | Description |
|--------|-------------|
| `Model.find!(id)` | Find by primary key |
| `Model.all!(limit?)` | All rows, optional limit |
| `Model.count!` | Count all rows |
| `Model.where(...)` | Start a query chain |
| `Model.or(...)` | Start a chain with OR |
| `Model.not(...)` | Start a chain with NOT |
| `Model.select(...)` | Start a chain with SELECT |
| `Model.order(...)` | Start a chain with ORDER BY |
| `Model.group(...)` | Start a chain with GROUP BY |
| `Model.limit(n)` | Start a chain with LIMIT |
| `Model.insert!(data)` | Insert and return new row |
| `Model.update!(id, data)` | Update by id and return row |
| `Model.upsert!(data, on:)` | Insert or update on conflict |
| `Model.destroy!(id)` | Delete by id and return row |
| `Model.query!(sql, params)` | Raw parameterized query |

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
- **rip-lang** 3.x (installed automatically as a dependency)

Set `DUCKDB_LIB_PATH` if DuckDB is not in a standard location:

```bash
DUCKDB_LIB_PATH=/path/to/libduckdb.dylib rip-db
```

## License

MIT
