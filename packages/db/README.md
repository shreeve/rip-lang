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

### Backup & Restore

```bash
rip-db dump                      # writes <dbname>-YYYYMMDD-HHMMSS.tar.gz
rip-db dump prod-backup.tar.gz   # explicit name
rip-db load prod-backup.tar.gz   # restore into an empty rip-db instance
```

Full reference in [§Backup & Restore](#backup--restore-1) below.

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

Rip DB sits between your clients and DuckDB. One process owns the database
file; everything else talks to it over HTTP (plus a dedicated DuckDB binary
protocol for the UI). Six different clients can connect to the same running
server:

```
                            ┌──────────────────────┐    FFI    ┌────────────┐
                            │       rip-db         │◀─────────▶│   DuckDB   │
                            │       (Bun)          │           │  (native)  │
                            └──────────┬───────────┘           └────────────┘
                                       │
             ┌───────────┬─────────────┼─────────────┬───────────┐
             ▼           ▼             ▼             ▼           ▼
       ┌───────────┐ ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐
       │  Browser  │ │ duckdb  │ │  Your    │ │   curl /   │ │  MCP   │
       │ DuckDB UI │ │  CLI +  │ │  app     │ │    HTTP    │ │  (LLM) │
       │           │ │  ripdb  │ │  (Rip)   │ │   clients  │ │        │
       └───────────┘ └─────────┘ └──────────┘ └────────────┘ └────────┘
```

Writes from your Rip app are immediately visible in the browser UI, to a
`curl` script, through a stock `duckdb` CLI, and to an LLM over MCP. Zero
duplication, zero sync — every client sees the same DuckDB file.

See **[Ways to Connect](#ways-to-connect)** below for install-and-use
instructions for each client.

## Ways to Connect

### 1. Browser — Official DuckDB UI

Open `http://localhost:4213/` and you get the full DuckDB notebook
interface: SQL notebooks, syntax highlighting, tab completion, query
history, data exploration. The UI assets are proxied from `ui.duckdb.org`
and Rip DB implements the full binary serialization protocol the UI uses.

### 2. Stock `duckdb` CLI — via the `ripdb` extension

The `ripdb` DuckDB extension lets the official `duckdb` CLI attach any
running `rip-db` server as a first-class database — full SQL, catalog
browsing, tab completion, and joins against local tables.

```bash
# Start DuckDB with unsigned-extension support enabled at the CLI flag.
# (`-unsigned` is required by DuckDB for custom-repo INSTALL FROM. Don't
# also `SET allow_unsigned_extensions = true;` — that setting can only
# change at startup, and `-unsigned` already enabled it.)
duckdb -unsigned
```
```sql
-- One-time install from our GitHub Pages custom repository:
INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';

-- Every session thereafter:
LOAD ripdb;
ATTACH 'rip://localhost:4213' AS r (TYPE ripdb);
SHOW TABLES FROM r;
SELECT * FROM r.users WHERE active = true LIMIT 10;
```

Remote schemas and columns tab-complete like any other DuckDB database.
Multi-platform binaries (`osx_arm64`, `osx_amd64`, `linux_amd64`,
`linux_arm64`) are published automatically — see
[`packages/db/extension/README.md`](./extension/README.md) for details.

### 3. Rip client library — `@rip-lang/db/client`

Use from your own Rip code. Parameterized queries, an ActiveRecord-style
Model, and smart dispatch (single insert → prepared stmt, bulk insert →
Appender API).

```coffee
import { connect, query, findAll, Model } from '@rip-lang/db/client'

connect 'http://localhost:4213'   # or set DB_URL env var

User = Model 'users'
user  = User.find! 42
users = User.where(active: true).limit(10).all!
User.insert! { name: 'Alice', email: 'alice@example.com' }
```

See the [Database Client](#database-client) section for the full reference.

### 4. Plain HTTP — any language, any tool

The JSON API at `/sql` accepts parameterized queries, batch prepared
statements, or bulk-insert directives. Works from any language that
speaks HTTP. See [JSON API](#json-api) for the full contract.

```bash
curl -X POST http://localhost:4213/sql \
  -H 'Content-Type: application/json' \
  -d '{"sql":"SELECT * FROM users WHERE id = $1","params":[42]}'
```

### 5. MCP server — for LLMs (Cursor, Claude Desktop, …)

`packages/db/mcp.rip` is an MCP stdio server that exposes three tools
(`execute_query`, `list_tables`, `list_columns`) over the Model Context
Protocol. LLMs connect once and can explore your live data.

Add to `~/.cursor/mcp.json` (or equivalent for your LLM tool):

```json
{
  "mcpServers": {
    "rip-db": {
      "command": "rip",
      "args": ["/path/to/rip-lang/packages/db/mcp.rip"]
    }
  }
}
```

The MCP server's default target is `http://localhost:4213`; pass
`--url <other>` to point at a different `rip-db`.

### 6. Minimal HTTP endpoints — scripts, monitoring, ops

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check — returns `{status:"ok", version}` |
| `/tables` | GET | List all tables in the main schema |
| `/schema/:table` | GET | Column list + types (404 if the table doesn't exist) |
| `/shutdown` | POST | Graceful CHECKPOINT + exit — [token-gated on non-local binds](#security-model) |

### Which one should I use?

| Task | Best fit |
|---|---|
| Interactive exploration, ad-hoc queries | Browser UI |
| SQL power-user, scripting at the shell | Stock `duckdb` CLI + `ripdb` extension |
| Your app's data layer | Rip client (`Model`, `query!`, `findAll!`) |
| Integration from non-Rip services | Plain HTTP |
| LLM-driven debugging / analytics | MCP |
| Monitoring / health checks | Minimal endpoints |

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

## Backup & Restore

`rip-db` ships two subcommands for full-database snapshots, both backed
by DuckDB's native `EXPORT DATABASE` / `IMPORT DATABASE` over the same
`/sql` endpoint your app already uses. No new server route, no
authentication scheme to configure — just two CLI verbs.

### Quick reference

```bash
rip-db dump                       # autoname: <dbname>-YYYYMMDD-HHMMSS.tar.gz in cwd
rip-db dump my-snapshot.tar.gz    # explicit filename
rip-db dump /var/backups/medlabs  # existing directory → auto-named archive lands inside it
rip-db load my-snapshot.tar.gz    # restore archive into an empty rip-db
rip-db dump --help                # subcommand usage
rip-db load --help

# Target a non-default server with the RIPDB_URL env var:
RIPDB_URL=http://prod-host:4213 rip-db dump prod-snapshot.tar.gz
```

The `dump` path argument is resolved by these rules (no `--into` /
`-d` flag needed):

| Argument | Behavior |
|---|---|
| _omitted_ | write `<dbname>-YYYYMMDD-HHMMSS.tar.gz` in cwd |
| existing directory | write `<dbname>-YYYYMMDD-HHMMSS.tar.gz` **inside** the directory |
| ends in `.tar.gz` or `.tgz` | use the literal filename |
| anything else | rejected — must be a directory or have a tarball extension |

### How it works

`dump` runs `EXPORT DATABASE 'tmpdir' (FORMAT CSV)` against the running
server. DuckDB writes three kinds of files into the staging directory:

| File | Contents |
|---|---|
| `schema.sql` | All `CREATE SEQUENCE` / `CREATE TYPE` / `CREATE TABLE` / `CREATE VIEW` / `CREATE INDEX` statements (the DDL) |
| `load.sql` | One `COPY <table> FROM '<csv>' (...)` statement per table (the replay glue) |
| `<table>.csv` | One CSV per table, type-faithful (DECIMAL precision, TIMESTAMP precision, ENUM values, NULL handling, all preserved) |

`rip-db dump` then `tar -czf`'s the staging directory into the named (or
auto-named) archive and cleans up. `load` is the symmetric inverse: untar
into a staging directory, run `IMPORT DATABASE 'tmpdir'`, clean up.

Before tarring, `dump` also rewrites `load.sql` to strip the absolute
tmp-dir prefix from each `COPY ... FROM '<path>'` so the archive is
self-contained — `FROM 'accounts.csv'` rather than `FROM
'/tmp/ripdb-XXXXXX/accounts.csv'`. `IMPORT DATABASE` doesn't require
this (it ignores the directory and re-prepends its own at replay
time), but it makes the archive readable by humans and makes manual
replays like `cd dump-dir && duckdb new.db < load.sql` Just Work
regardless of where the dump originated.

### CSV format choice

CSV (not Parquet) is intentional. Three reasons:

- **Type-faithful**: DuckDB's CSV reader, given the column types from
  `schema.sql`, parses DECIMALs back without precision loss, parses
  TIMESTAMPs to microsecond precision, and re-casts ENUM values through
  the `CREATE TYPE` declaration. For the typical OLTP-shaped schema
  (INTEGER PKs + VARCHAR + DECIMAL + TIMESTAMP + ENUMs), CSV round-trips
  losslessly.
- **Human-readable**: you can `head`, `grep`, or `csvlook` the archive
  contents without any tooling.
- **Universally portable**: every database, language, and spreadsheet
  understands CSV.

The one caveat: VARCHAR columns can't distinguish empty string `''` from
NULL by default — both serialize as an empty CSV cell, both parse back
as NULL on import. If your schema needs that distinction, override at
the server's SQL level: `EXPORT DATABASE 'dir' (FORMAT CSV, NULLSTR
'\N')`.

For nested types (LIST / STRUCT / MAP / ARRAY) or BLOB columns you'd
want PARQUET instead — `rip-db dump` doesn't currently expose a format
flag, but you can run the underlying SQL directly via `/sql` if needed.

### Auto-naming

When you omit the archive name, the script:

1. Asks the server for `current_database()` via `/sql`.
2. Sanitizes that name to `[A-Za-z0-9._-]+` (so weird DB names produce
   safe filenames).
3. Appends a `YYYYMMDD-HHMMSS` local-time stamp.
4. Writes `<dbname>-<stamp>.tar.gz` to the current directory.

Examples:

| Server's `current_database()` | Auto-named archive |
|---|---|
| `medlabs` (file-based, `medlabs.duckdb`) | `medlabs-20260507-191123.tar.gz` |
| `memory` (`:memory:` server) | `memory-20260507-191123.tar.gz` |
| `My Customer Data!` (weird) | `My_Customer_Data_-20260507-191123.tar.gz` |

### Targeting a different server

`RIPDB_URL` is the only required configuration. Default is
`http://localhost:4213`. Examples:

```bash
# Production backup
RIPDB_URL=http://prod-host:4213 rip-db dump

# Cross-environment: dump prod, restore to a fresh staging instance
RIPDB_URL=http://prod-host:4213    rip-db dump /tmp/prod.tar.gz
RIPDB_URL=http://staging-host:4213 rip-db load /tmp/prod.tar.gz

# Dump from a non-default port (e.g. local rip-db on a different port)
RIPDB_URL=http://localhost:4299 rip-db dump test-snapshot.tar.gz
```

### Same-filesystem assumption

`rip-db dump` writes to a temp directory via `mktemp -d`, then asks the
server to `EXPORT DATABASE` to that path. **The server reads/writes the
staging directory directly** — so the script and the server must share
a filesystem. The default localhost case is automatic.

If you're running the server in a container or on a different host,
you have a few options:

- **Run `rip-db dump` inside the same container as the server**, then
  `docker cp` (or equivalent) the archive out.
- **Mount a shared volume** that both the script's container and the
  server's container can see, then point both `RIPDB_URL` at the
  server's HTTP and run `rip-db dump` from anywhere with access to the
  shared volume.
- **SSH the dump out**: run the script on the server box, archive
  arrives locally there, then `rsync` to wherever you want it.

The script catches the cross-filesystem failure mode explicitly: after
asking the server to export, it verifies that `schema.sql` and
`load.sql` actually appeared in the local temp directory. If they
didn't, you get an actionable error instead of a silently-empty archive:

```
rip-db: expected DuckDB export files (schema.sql + load.sql) not present
in /tmp/ripdb-XXX. If rip-db is running on a different host or container,
the EXPORT/IMPORT staging directory must be visible to both the script
and the server.
```

### Restore semantics

`rip-db load` is **strictly additive into an empty database**. It
refuses to load if the target server already has any tables or views in
the `main` schema:

```
rip-db: target database is not empty (3 table/view(s) in 'main' schema).
Drop them first or load into a fresh rip-db instance.
```

The reason is that `IMPORT DATABASE` runs `CREATE TABLE` followed by
`COPY`, and a naïve restore into a populated DB can fail partway
through, leaving partial data. The empty-DB precheck makes that
impossible.

If you want to restore over an existing database, the simplest path is:

1. Stop the rip-db server.
2. Move the existing `.duckdb` file out of the way (or `DROP` everything
   first).
3. Start a fresh rip-db pointing at the same path (or `:memory:` for
   testing).
4. `rip-db load <archive>`.

For automated CI / staging refreshes, point a fresh `:memory:` server at
the load and treat it as a one-shot:

```bash
# Start a fresh memory rip-db on port 4299
rip-db :memory: --port=4299 &
sleep 1
# Load production snapshot into it
RIPDB_URL=http://localhost:4299 rip-db load prod-snapshot.tar.gz
# Now query / test against it
curl http://localhost:4299/tables
```

### Safety gates

Both subcommands fail closed on a number of conditions designed to
prevent the common backup/restore footguns:

| Condition | Behavior |
|---|---|
| Output archive already exists | `dump` refuses; never silently destroys an existing archive that might be the only good copy |
| Server unreachable | Both fail with `could not reach rip-db at <url>: <reason>`; partial archives are not produced |
| Cross-filesystem export | Both fail with the actionable message shown above; no silently-empty archives |
| Target DB already populated | `load` fails with the empty-DB precheck message; no partial restores |
| Missing archive file | `load` fails with `no such file: <path>` |
| Tar archive contains `..` or absolute paths | `load` rejects with `unsafe path in archive: <name>`; basic tarball-traversal defense |
| Wrong number of arguments | Both print usage and exit non-zero |
| Embedded NUL byte in temp path | Refused upfront; NULs don't survive HTTP-as-text transport |

The script does NOT defend against:

- **Symlink/hardlink attacks in tar archives.** `rip-db load` is intended
  for archives produced by `rip-db dump` (or other trusted sources).
  Loading an archive crafted by an attacker can overwrite arbitrary
  files via system tar's symlink-following behavior. Don't load
  untrusted archives.
- **Concurrent dumps to the same file.** Two `rip-db dump foo.tar.gz`
  invocations racing on the same archive name could clobber each other
  between the existsSync check and the tar write. Not realistic in
  practice; if it matters, use the auto-naming form.
- **Network timeouts.** `rip-db dump` has no fetch timeout — a
  long-running export against a big DB will wait as long as DuckDB
  takes. Intentional: better to wait than to kill a valid restore.

### Common workflows

#### Nightly backup with rotation

```bash
# /etc/cron.d/medlabs-backup
0 3 * * * cd /var/backups/medlabs && rip-db dump && find . -mtime +7 -name '*.tar.gz' -delete
```

The auto-naming + `find -mtime +N -delete` combo gives you 7 days of
nightly snapshots for a few lines of cron config. No backup tool needed.

#### Copy production data into staging

```bash
# On a host with access to both:
RIPDB_URL=http://prod:4213    rip-db dump /tmp/prod.tar.gz
RIPDB_URL=http://staging:4213 rip-db load /tmp/prod.tar.gz
rm /tmp/prod.tar.gz
```

#### Pull a backup down to your laptop

```bash
# On your laptop
ssh prod-host "cd /tmp && rip-db dump && cat *.tar.gz" > local-snap.tar.gz
ssh prod-host "cd /tmp && rm *.tar.gz"
```

(Cleaner: have cron drop nightly archives into a fixed location, then
`rsync` from there.)

#### Snapshot before a risky migration

```bash
rip-db dump pre-migration-$(date +%F).tar.gz
# ... run migration ...
# If it goes wrong:
#   1. Stop rip-db
#   2. Move/drop the corrupted DB
#   3. Start fresh rip-db
#   4. rip-db load pre-migration-2026-05-07.tar.gz
```

#### Verify a backup round-trips

```bash
# Take the snapshot
rip-db dump snapshot.tar.gz

# Spin up a throwaway memory rip-db on a free port
rip-db :memory: --port=4299 &
sleep 1

# Load and compare row counts to production
RIPDB_URL=http://localhost:4299 rip-db load snapshot.tar.gz
diff \
  <(curl -s http://localhost:4213/tables | jq -r '.tables[]' | sort) \
  <(curl -s http://localhost:4299/tables | jq -r '.tables[]' | sort)

# Cleanup
curl -X POST http://localhost:4299/shutdown
```

### Format details

The archive is a vanilla gzipped tarball — anything that handles
`.tar.gz` can inspect it without `rip-db`:

```bash
$ tar -tzf medlabs-20260507-191123.tar.gz
./
./schema.sql
./load.sql
./accounts.csv
./orders.csv
./order_items.csv
./users.csv
...

$ tar -xzOf medlabs-20260507-191123.tar.gz ./schema.sql | head -5
CREATE SEQUENCE accounts_seq INCREMENT BY 1 ...;
CREATE TYPE order_status AS ENUM ('draft','submitted',...);
CREATE TABLE accounts(id INTEGER DEFAULT(nextval('accounts_seq')) PRIMARY KEY, ...);
...

$ tar -xzOf medlabs-20260507-191123.tar.gz ./accounts.csv | head -3
id,name,number,phone,address_street,address_city,address_state,address_zip,created_at,updated_at
10001,Acme Labs,04466500,(502) 758-8802,5908 Breckenridge Pkwy,Tampa,FL,33610,2026-04-17 12:34:56.123456,2026-04-17 12:34:56.123456
10002,Beta Health,04466501,...
```

You can also extract and replay manually if you want full control:

```bash
mkdir extracted
tar -xzf medlabs-20260507-191123.tar.gz -C extracted
duckdb new.duckdb -c "IMPORT DATABASE 'extracted'"
```

This is useful for picking individual tables out of a snapshot, or for
running ad-hoc SQL against a backup without restoring it into rip-db.

### Implementation notes

- `dump` and `load` both speak HTTP to the existing `/sql` endpoint —
  no new server-side route was added for this feature.
- All staging happens in `mktemp -d` directories with `process.on('exit'/SIGINT/SIGTERM)`
  cleanup, so interrupted operations don't leave temp files behind.
- DuckDB's `IMPORT DATABASE` rewrites the COPY paths in `load.sql` at
  replay time using only the basenames — so the absolute paths baked
  into `load.sql` by `EXPORT DATABASE` are decorative; the tarball is
  fully relocatable.
- SQL string literal escaping is applied to the temp path before
  templating it into the `EXPORT DATABASE '<path>'` query.
- The version pairing requirement: this feature works against any
  rip-db that exposes `/sql` (which is all versions). The DuckDB
  capability requirement is `EXPORT DATABASE` and `IMPORT DATABASE`,
  which have been stable since DuckDB 0.7.

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
| `/schema/:table` | GET | Table schema (404 if table doesn't exist) |
| `/shutdown` | POST | Graceful CHECKPOINT + exit — token-gated on non-local binds |

### Response Envelope

Every `/sql` response uses a single envelope shape. Successful queries:

```json
{
  "ok": true,
  "kind": "select",
  "columns": [{"name": "id", "type": "INTEGER"}, {"name": "name", "type": "VARCHAR"}],
  "data": [[1, "Alice"], [2, "Bob"]],
  "rowCount": 2,
  "timeMs": 4,

  "rows": 2,         // legacy alias — same as rowCount
  "time": 0.004      // legacy alias — same as timeMs / 1000
}
```

`kind` is `"select"` when the query produced column metadata (SELECT, DESCRIBE,
SHOW, INSERT … RETURNING …) and `"write"` otherwise (pure INSERT/UPDATE/DELETE,
DDL, bulk append).

Errors:

```json
{
  "ok": false,
  "error": "Table 'users' does not exist",    // legacy string
  "errorCode": "TABLE_NOT_FOUND",
  "timeMs": 1
}
```

`errorCode` is drawn from a small stable taxonomy so clients can branch on it:

| Code | Meaning |
|---|---|
| `SQL_ERROR` | Generic DuckDB error |
| `SQL_SYNTAX` | Parse / syntax |
| `TYPE_ERROR` | Cast, conversion, invalid input |
| `TABLE_NOT_FOUND` | Catalog miss (also drives the 404 on `/schema/:table`) |
| `IO_ERROR` | Read / permission / I/O failure |
| `BAD_REQUEST` | Malformed HTTP body |
| `FORBIDDEN` | Auth-gated route refused |
| `INTERNAL` | Uncategorised |

Status codes follow standard REST conventions — `200` success, `400` bad
request, `404` missing resource (schema lookup), `422` SQL-level user error,
`500` driver / internal failure. The JSON body uses the same shape on every
status.

**Migration note:** the `rows` and `time` fields and the top-level string
`error` field are **legacy aliases**. New clients should read `rowCount`,
`timeMs`, `ok`, and `errorCode`. Legacy fields stay populated for one major
version and will be removed in the next one. The Rip client library
(`@rip-lang/db/client`) already uses the new fields and exposes a typed
`RipDBError` exception on failures — migrations on the client side are
invisible if you use it.

## Security model

rip-db is **trusted-network software**. It is designed for:

- Local use from your own machine (the default)
- Internal services on a private network behind an already-trusted boundary

It is **not** designed to face the public internet directly. `/sql` accepts
arbitrary SQL from any client that can reach the port, including `DROP TABLE`
and `ATTACH 'some-remote' …`. There is no per-query authentication, no row-
level security, and no query allow-list.

### Defaults

- **Bind:** `127.0.0.1` — reachable only from the local machine.
- **`/shutdown`:** allowed without auth, because only local processes can
  reach it in the default configuration.

### When binding to a non-local interface

You can expose rip-db to a network with `--host 0.0.0.0` (or any non-
loopback address). When you do:

- A **loud startup warning** is printed to stderr calling out that `/sql` is
  now reachable and shutdown behaviour changed.
- **`/shutdown` is disabled** entirely unless you also pass
  `--auth-token <token>`. The token is then required as
  `Authorization: Bearer <token>` on the request.

```bash
rip-db mydb.duckdb \
  --host=0.0.0.0 \
  --port=4213 \
  --auth-token=$(openssl rand -hex 32)
```

No additional auth is applied to `/sql` or other read/write routes — it is
your responsibility to put rip-db behind a reverse proxy, a VPN, an SSH
tunnel, or equivalent when network-exposed.

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
