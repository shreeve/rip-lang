<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip DB - @rip-lang/db

> **DuckDB-over-HTTP client, CLI, and MCP server for Rip — talks to a [duckdb-harbor](https://github.com/shreeve/duckdb-harbor) instance**

Rip DB is the client side of a clean split: **harbor owns the database,
everything else talks HTTP.** A single harbor server exposes one port, and
this package gives your Rip code (plus your shell and your LLM) first-class
access to it — a `query()` client with an ActiveRecord-style Model layer, a
`rip-db` CLI for backup/restore/checkpoint, and an MCP server for AI tools.
Zero npm dependencies; pure Rip on native `fetch`. Runs on Bun.

```
                      ┌───────────────────────────────┐
                      │     duckdb-harbor :9494       │
                      │  (one port, every surface)    │
                      └──────────────┬────────────────┘
                                     │ POST /sql (+ UI, attach)
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        ▼              ▼             ▼             ▼              ▼
  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐
  │  Your app  │ │   rip-db   │ │ mcp.rip  │ │  Browser  │ │  duckdb   │
  │ client.rip │ │    CLI     │ │  (LLM)   │ │ DuckDB UI │ │ CLI attach│
  └────────────┘ └────────────┘ └──────────┘ └───────────┘ └───────────┘
```

The first three columns are this package. The last two come free with harbor:
point a browser at the same URL for the official DuckDB UI, or attach from a
stock `duckdb` CLI with `ATTACH 'harbor:host:port' (TYPE harbor, TOKEN ...)`
— full catalog browsing, joins, and tab completion, all over the same `/sql`
protocol this client uses.

## Quick Start

### 1. Start harbor

```sql
-- in a duckdb session (or your operator setup / systemd / container)
INSTALL harbor FROM community;
LOAD harbor;
CALL harbor_serve(bind := '127.0.0.1', port := 9494);
-- result row's auth_token column carries the auto-generated bearer token;
-- or pass token := 'my-secret', or token := NULL for explicit
-- unauthenticated local dev
```

Rip DB does **not** start the server — harbor's lifecycle is external.

### 2. Install and query

```bash
bun add @rip-lang/db
export RIP_DB_TOKEN=<token from harbor_serve>
```

```coffee
import { query, findOne, findAll, Model } from '@rip-lang/db'

# Raw SQL with positional params
result = query! 'SELECT 42 AS answer'
rows   = findAll! 'SELECT * FROM users WHERE active = ?', [true]
user   = findOne! 'SELECT * FROM users WHERE id = ?', [42]

# ActiveRecord-style models
User  = Model 'users'
alice = User.find! 42
team  = User.where(active: true).order('name').limit(20).all!
fresh = User.insert! { name: 'Alice', email: 'alice@example.com' }
User.update! 42, { last_login: new Date() }
User.destroy! 42
```

## Configuration

| Env var        | Meaning                                                        | Default                 |
|----------------|----------------------------------------------------------------|-------------------------|
| `RIP_DB_URL`   | Base URL of the harbor server                                  | `http://127.0.0.1:9494` |
| `RIP_DB_TOKEN` | Bearer token for `/sql`. Omit only when harbor was started with the explicit unauthenticated opt-in, `harbor_serve(..., token := NULL)` | unset |

`connect(url)` overrides `RIP_DB_URL` at runtime. When the schema runtime
is loaded, it also installs the full **adapter Contract v2** — `query`,
`begin`, and `capabilities: { tx: true }` — so `Model.find!`,
`Model.where(...).all!`, and `schema.transaction!` all route through the
same harbor instance automatically.

## Client API (`client.rip`)

- **`query(sql, params?, opts?)`** — execute one statement, returns harbor's
  envelope `{ ok, kind, columns, data, rowCount, timeMs }`. Options:
  `timeout` ms (default 30 000, `0` disables), `signal` (AbortSignal), and
  `sessionId` — pins the statement to a harbor session so it runs on that
  session's dedicated connection (this is how transactions ride).
- **`begin(options?)`** — open a harbor session and `BEGIN TRANSACTION` on
  it; returns a `TxHandle` `{ query(sql, params), commit(), rollback() }`.
  This is the transaction seam `schema.transaction!` uses — application
  code normally goes through the schema runtime rather than calling
  `begin()` directly. Requires an authenticated harbor (set
  `RIP_DB_TOKEN`): harbor only creates *owned* sessions, so an
  unauthenticated deployment can run plain queries but not transactions.
  `commit()`/`rollback()` always close the session, even on error.
- **`findOne(sql, params?)` / `findAll(sql, params?)`** — same, but rows come
  back as plain objects keyed by column name.
- **`materializeAll(result)`** — turn a raw envelope into row objects.
- **`Model(table, database?)`** — `find`, `all`, `where`, `or`, `not`,
  `select`, `order`, `group`, `limit`, `count`, `query`, `insert` (single or
  bulk, one multi-row `INSERT ... RETURNING *`), `update`, `upsert`
  (`{ on: 'col' }` conflict target), `destroy`.
- **QueryBuilder** (returned by `Model.where(...)` etc.) — immutable,
  chainable: `where/or/not/select/order/group/having/limit/offset`, then
  `all!`, `first!`, `count!`, `update!`, `destroy!`.
- **`ident(name)`** — SQL identifier quoting helper.
- **`RipDBError`** — thrown on every failure; carries `.code` (harbor's
  stable `errorCode`, or `TIMEOUT` / `ABORTED` / `NETWORK_ERROR`),
  `.httpStatus`, and `.details`.

### Boot-time reachability check (`embed.rip`)

```coffee
import { assertReachable } from '@rip-lang/db/embed'

assertReachable! 'http://127.0.0.1:9494'   # throws if harbor isn't healthy
```

Probes harbor's public `/ready` endpoint (no token needed) with a 5s
timeout — fail loudly at boot instead of mysteriously on the first query.

## CLI (`rip-db`)

```bash
rip-db dump [ARCHIVE.tar.gz | DIRECTORY]   # snapshot the running database
rip-db load ARCHIVE.tar.gz                 # restore into an empty database
rip-db checkpoint [--force]                # flush the WAL to the DB file
```

- **dump** — `EXPORT DATABASE` over `/sql`, bundled as a tar.gz. Auto-names
  `<dbname>-YYYYMMDD-HHMMSS.tar.gz` when the path is omitted or a directory.
  Refuses to overwrite an existing archive.
- **load** — restores a dump into a fresh database; refuses if the target
  already has user tables/views in any schema.
- **checkpoint** — issues `CHECKPOINT` (or `FORCE CHECKPOINT` with
  `--force`) via `/sql`.

Uses the same `RIP_DB_URL` / `RIP_DB_TOKEN` environment. Because dump/load
stage through a local temp directory that harbor reads/writes directly, they
require the CLI and harbor to share a filesystem (the default localhost
case) — a cross-filesystem mismatch fails loudly rather than producing an
empty archive.

## MCP server (`mcp.rip`)

A zero-dependency MCP stdio server exposing `execute_query`, `list_tables`,
and `list_columns` to AI tools. Cursor config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "duckdb": {
      "command": "rip",
      "args": ["/path/to/packages/db/mcp.rip"],
      "env": { "RIP_DB_TOKEN": "<your harbor token>" }
    }
  }
}
```

`--url http://host:9494` overrides `RIP_DB_URL` per-instance.

## Wire-format notes

Values arrive per harbor SPEC §5.4; the column schema (`duckdbType` on each
column entry, aliased as `type`) is the authority for decoding. The client
passes values through without auto-decoding:

- **BIGINT / HUGEINT / UBIGINT / UHUGEINT** — JSON number inside the JS
  safe-integer range (±2⁵³−1), JSON string outside it. Promote to `BigInt`
  at the boundary when exact arithmetic on large values matters.
- **DECIMAL** — string, preserving width/scale.
- **DATE / TIME / TIMESTAMP / TIMESTAMPTZ** — strings.
- **INTERVAL** — `{months, days, micros}` with `micros` as a string.
- **BLOB** — base64.
- **LIST / ARRAY / STRUCT / MAP / UNION / ENUM** — nested per SPEC §5.4.

## License

MIT
