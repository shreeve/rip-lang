<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip DB - @rip-lang/db

> **A lightweight DuckDB HTTP server with bulk inserts, an ActiveRecord-style client, and the official DuckDB UI built in**

Rip DB turns any DuckDB database into a full-featured HTTP server — complete
with the official DuckDB UI for interactive queries, bulk insert via DuckDB's
Appender API (~200K rows/sec), and a clean Model interface that picks the
optimal strategy automatically. Pure Bun FFI, zero npm dependencies for DuckDB.

## Quick Start

```bash
# Install DuckDB and Rip DB
brew install duckdb            # macOS (or see duckdb.org for Linux)
bun add -g @rip-lang/db        # Installs rip-db command

# Start the server
rip-db                          # Auto-detects *.duckdb file, or :memory:
rip-db mydata.duckdb            # Explicit file
rip-db mydata.duckdb --port 8080
```

```
rip-db: DuckDB v1.4.4
rip-db: rip-db v1.3.6
rip-db: source mydata.duckdb
rip-db: server http://localhost:4213
```

Open **http://localhost:4213** for the official DuckDB UI.

### Source Selection

When no filename is given, `rip-db` looks for exactly one `*.duckdb` file in
the current directory and uses it automatically. If zero or multiple are found,
it falls back to `:memory:`. This means `cd my-project && rip-db` just works
when there's a single database file present.

The `source` line shows the active data source — today that's a local DuckDB
file or `:memory:`, but the architecture supports any source DuckDB can attach:
S3 buckets, PostgreSQL, MySQL, SQLite, Parquet files, CSV, and more via
DuckDB's extension system.

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

**JSON API** — Any HTTP client can execute SQL queries and receive JSON
responses. Three execution strategies are selected automatically based on the
request shape — the caller never needs to think about it.

## Features

- **Official DuckDB UI** — Interactive notebooks, syntax highlighting, data exploration
- **Bulk insert via Appender API** — ~200K rows/sec, bypasses SQL parsing entirely
- **Batch prepared statements** — Prepare once, execute N times with different params
- **ActiveRecord-style Model** — `User.find!`, `User.insert!`, `User.where(...).all!`
- **Smart dispatch** — `Model.insert!` picks Appender for arrays, prepared statements for singles
- **Full binary protocol** — Native DuckDB UI serialization implemented in Rip
- **Pure Bun FFI** — Direct calls to DuckDB's C API using the modern chunk-based interface
- **Zero npm dependencies for DuckDB** — Uses the system-installed DuckDB library
- **Parameterized queries** — Prepared statements with type-safe parameter binding
- **Complete type support** — All DuckDB types handled natively, including UUID, DECIMAL, TIMESTAMP, LIST, STRUCT, MAP
- **Single binary** — One `rip-db` command, one process, one database

## Database Client

The real power of Rip DB is its client library. Import it from
`@rip-lang/db/client` — it talks to a running `rip-db` server over HTTP.

```coffee
import { query, findOne, findAll, Model } from '@rip-lang/db/client'
```

### The Balance: Model vs Raw SQL

Not every query needs an ORM, and not every query benefits from raw SQL.
Rip DB gives you both and lets you choose the right tool:

**Use the Model** for simple and medium queries — CRUD, where clauses,
counts, upserts. The Model is shorter, safer, and handles parameterization
automatically:

```coffee
User = Model 'users'

# These are cleaner than raw SQL
user    = User.find! 42
count   = User.count!
active  = User.where(active: true).order('name').limit(10).all!
created = User.insert! { name: 'Alice', email: 'alice@example.com' }
User.upsert! { email: 'alice@example.com', name: 'Alice' }, on: 'email'
```

**Use raw SQL** for complex queries — JOINs, GROUP BY, aggregates, subqueries.
SQL is the most direct, readable expression for these. No ORM improves on it:

```coffee
users = findAll! """
  SELECT u.id, u.name, count(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE u.active = true
  GROUP BY u.id, u.name
  ORDER BY order_count DESC
  """
```

This isn't a compromise — it's the optimal approach. Simple queries get
shorter with the Model. Complex queries stay clear with SQL. You never
fight the abstraction.

### Bulk Insert (Appender API)

Pass an array to `Model.insert!` and it automatically uses DuckDB's Appender
API — the fastest possible insert path (~200K rows/sec). The Appender bypasses
SQL parsing entirely, writing directly to DuckDB's columnar storage.

```coffee
# Single insert — uses prepared statement, returns the row
user = User.insert! { name: 'Alice', email: 'alice@example.com' }

# Bulk insert — uses Appender API, fastest path
User.insert! [
  { name: 'Alice', email: 'alice@example.com' }
  { name: 'Bob', email: 'bob@example.com' }
  { name: 'Charlie', email: 'charlie@example.com' }
]
```

The caller writes the same `insert!` — the Model detects the array and
picks the optimal strategy. Column subsets work too; missing columns get
their default values.

### Bulk Upsert (Multi-Row VALUES)

For upserts (INSERT ... ON CONFLICT), the Appender can't be used. The Model
builds a multi-row VALUES statement with proper parameterization:

```coffee
# Single upsert
Response.upsert! { email: 'alice@example.com', name: 'Alice' }, on: 'email'

# Bulk upsert — one SQL statement with N value tuples
Response.upsert! responses, on: 'email'
```

### Batch Queries (Prepared Statement Reuse)

Pass an array of param arrays to `query!` and it reuses one prepared
statement for all executions — one prepare, N bind-and-execute cycles:

```coffee
# Execute the same UPDATE 3 times with different params
query! "UPDATE reviews SET completed_at = $1 WHERE id = $2", [
  [now, 1]
  [now, 2]
  [now, 3]
]
```

### Low-Level Queries

Every query uses parameterized placeholders (`$1`, `$2`, ...) to prevent SQL
injection. Results are automatically materialized into plain objects.

```coffee
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

```coffee
User = Model 'users'
```

#### Find & Count

```coffee
user  = User.find! 42           # SELECT * FROM "users" WHERE id = $1
count = User.count!              # SELECT COUNT(*) ...
users = User.all!                # SELECT * FROM "users"
users = User.all! 10             # SELECT * FROM "users" LIMIT 10
```

#### Chainable Queries

All query methods return a new builder — chains are immutable and reusable.

```coffee
User.where(active: true).order('name').limit(10).all!
User.where(active: true).offset(20).limit(10).all!
User.where('age > $1', [21]).all!
User.select('id, name').where(role: 'admin').first!
```

#### Where, Or, Not

```coffee
# Object-style (null-aware — generates IS NULL / IS NOT NULL)
User.where(role: 'admin').all!
User.where(deleted_at: null).all!          # WHERE "deleted_at" IS NULL

# String-style with params
User.where('age > $1', [21]).all!

# OR conditions
User.where(active: true).or(role: 'admin').all!

# NOT conditions
User.where(active: true).not(role: 'banned').all!
```

#### Group & Having

```coffee
User.group('role').select('role, count(*) as n').all!
User.group('role').having('count(*) > $1', [5]).select('role, count(*) as n').all!
```

#### Insert, Update, Upsert, Destroy

All mutations return the affected row(s) via `RETURNING *`.

```coffee
# Insert single — returns the new record
user = User.insert! { first_name: 'Alice', email: 'alice@example.com' }

# Insert bulk — uses Appender API (~200K rows/sec)
User.insert! rows

# Update by id — returns the updated record
user = User.update! 42, { email: 'newemail@example.com' }

# Upsert — insert or update on conflict (single or bulk)
user = User.upsert! { email: 'alice@example.com', name: 'Alice' }, on: 'email'

# Destroy by id — returns the deleted record
user = User.destroy! 42
```

#### Bulk Update & Destroy via Query Builder

Chain `.where()` with `.update!` or `.destroy!` for bulk operations.

```coffee
# Update all matching rows
User.where(role: 'guest').update! { role: 'member' }

# Delete all matching rows
User.where(active: false).destroy!
```

#### Raw Parameterized Queries

For anything the builder doesn't cover, drop down to raw SQL.

```coffee
users = User.query! "SELECT * FROM users WHERE dob > $1", ['2000-01-01']
```

#### Cross-Database Queries

Pass a database name to query attached DuckDB databases.

```coffee
Archive = Model 'orders', 'archive_db'
order = Archive.find! 99    # SELECT * FROM "archive_db"."orders" WHERE id = $1
```

### Execution Strategy Summary

The client picks the optimal execution path automatically:

| Caller writes | Strategy | Speed |
|---------------|----------|-------|
| `Model.insert!(object)` | Prepared statement | Fast |
| `Model.insert!(array)` | DuckDB Appender API | ~200K rows/sec |
| `Model.upsert!(object)` | Prepared statement | Fast |
| `Model.upsert!(array)` | Multi-row VALUES SQL | Fast (batch) |
| `query!(sql, params)` | Prepared statement | Fast |
| `query!(sql, [params...])` | Prepared stmt reuse | Fast (batch) |
| `findOne!(sql)` / `findAll!(sql)` | Direct execution | Fast |

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
| `Model.insert!(data)` | Insert single object or bulk array |
| `Model.update!(id, data)` | Update by id and return row |
| `Model.upsert!(data, on:)` | Insert or update on conflict (single or bulk) |
| `Model.destroy!(id)` | Delete by id and return row |
| `Model.query!(sql, params)` | Raw parameterized query |

## JSON API

For programmatic access from any HTTP client.

### POST /sql

The `/sql` endpoint accepts four shapes and dispatches automatically:

```bash
# Standard query
curl -X POST http://localhost:4213/sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM users WHERE id = $1", "params": [1]}'

# Bulk insert (Appender API)
curl -X POST http://localhost:4213/sql \
  -H "Content-Type: application/json" \
  -d '{"table": "users", "columns": ["name", "email"], "rows": [["Alice", "a@b.com"], ["Bob", "b@b.com"]]}'

# Batch prepared statement
curl -X POST http://localhost:4213/sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "INSERT INTO t (a, b) VALUES ($1, $2)", "params": [[1, "x"], [2, "y"]]}'
```

| Shape | Dispatches to |
|-------|---------------|
| `{ sql }` | Raw execution |
| `{ sql, params: [...] }` | Prepared statement |
| `{ sql, params: [[...], ...] }` | Batch prepared (reuse stmt) |
| `{ table, columns, rows }` | Appender API (fastest insert) |

### POST /

Execute raw SQL (body is the query):

```bash
curl -X POST http://localhost:4213/ -d "SELECT 42 as answer"
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
| `db.rip` | ~430 | HTTP server — routes, middleware, UI proxy, bulk dispatch |
| `lib/duckdb.mjs` | ~960 | FFI driver — chunk-based API, Appender, batch prepared |
| `lib/duckdb-binary.rip` | ~550 | Binary serializer — DuckDB UI protocol |
| `client.rip` | ~320 | HTTP client — Model factory, query builder, bulk insert |

The FFI driver uses DuckDB's modern chunk-based API (`duckdb_fetch_chunk`,
`duckdb_vector_get_data`) to read query results directly from columnar memory.
For bulk inserts, it uses the Appender API (`duckdb_appender_create`,
`duckdb_append_*`) which writes directly to DuckDB's storage engine, bypassing
SQL parsing for maximum throughput. Prepared statement reuse
(`duckdb_prepare` once, `duckdb_execute_prepared` N times) handles batch
operations efficiently.

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

### Linux: FFI Shim Required

Bun's FFI on Linux x64 cannot pass the 48-byte `duckdb_result` struct by value
(required by `duckdb_fetch_chunk`). A tiny C shim is required — it wraps the
by-value call and accepts a pointer instead.

You need two `.so` files on Linux:

| File | Size | Purpose |
|------|------|---------|
| `libduckdb.so` | ~68 MB | DuckDB itself |
| `libduckdb-shim.so` | ~16 KB | Struct-by-value wrapper |

Build the shim and place it next to `libduckdb.so`:

```bash
gcc -shared -fPIC -o /usr/local/lib/libduckdb-shim.so \
  lib/duckdb-shim.c -L /usr/local/lib -lduckdb
```

or

```bash
gcc -shared -fPIC -o ~/.duckdb/latest/libduckdb-shim.so \
  packages/db/lib/duckdb-shim.c -L ~/.duckdb/latest -lduckdb
```

The FFI driver resolves symlinks when searching, so if
`/usr/local/lib/libduckdb.so` is a symlink to (e.g.) `~/.duckdb/latest/`,
place the shim in the symlink target directory alongside the real
`libduckdb.so`. To override, set `DUCKDB_SHIM_PATH`.

## License

MIT
