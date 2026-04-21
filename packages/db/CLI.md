<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# ripdb

`ripdb` is a DuckDB storage extension that exposes a running `rip-db` HTTP server as an attachable DuckDB database. In the stock `duckdb` CLI, it enables:

```
ATTACH 'rip://host:port' AS r (TYPE ripdb);
```

`r.t` then participates in DuckDB's standard catalog interface — queried, described, tab-completed, and joined with other attached databases like any local table. Catalog and scan operations are served over HTTP, and result data is materialized as DuckDB `DataChunk`s.

---

## Problem it solves

A running `rip-db` server owns the underlying `.duckdb` file, so the stock `duckdb` CLI cannot open that file directly at the same time. `ripdb` exposes the running server as a DuckDB `StorageExtension`, allowing `ATTACH 'rip://host:port' AS r (TYPE ripdb)` to present the remote database through DuckDB's catalog and scan interfaces.

---

## Contract

With ripdb loaded in the stock `duckdb` CLI:

1. **You can connect to a running `rip-db` server** without the server having to release its `.duckdb` file. No coordination beyond the URL.
2. **Tab completion** works for remote schemas, tables, and columns because ripdb exposes remote metadata through DuckDB's standard catalog interface.
3. **Syntax highlighting** for database, schema, table, and column names works through the stock CLI's existing catalog-aware highlighting.
4. **Read queries work through normal DuckDB execution.** `SELECT`, `DESCRIBE`, and `SHOW TABLES` are supported; attached ripdb tables participate in DuckDB query plans alongside local tables, including joins, grouping, ordering, and aggregation. Results render through the CLI's standard table output.
5. **Query transport is efficient.** ripdb uses HTTP with a binary result format, projects only referenced columns, and pushes down supported scalar `WHERE` clauses (defined in [Performance characteristics](#performance-characteristics)).
6. **Exiting the CLI does not affect the rip-db server process.**

---

## Quick start

```bash
# one terminal: run rip-db against a database file
$ rip-db database.duckdb                    # serves on :4213

# another terminal: stock duckdb CLI, -unsigned permits unsigned extensions
$ duckdb -unsigned
D LOAD '/path/to/ripdb.duckdb_extension';
D ATTACH 'rip://localhost:4213' AS r (TYPE ripdb);
D SHOW TABLES FROM r;
D DESCRIBE r.patients;
D SELECT * FROM r.patients WHERE age > 40 ORDER BY id LIMIT 20;
D .quit                                     -- rip-db keeps running
```

`rip-refresh('r')` picks up remote schema changes without a detach/attach cycle:

```sql
D CALL rip_refresh('r');
┌─────────┬───────────────┬────────────────┐
│ catalog │ tables_loaded │ tables_refused │
├─────────┼───────────────┼────────────────┤
│ r       │             8 │              0 │
└─────────┴───────────────┴────────────────┘
```

---

## User-visible behavior

### ATTACH

Three equivalent URL forms are accepted:

- `'rip://host[:port]'` — the recommended form. Does not trigger DuckDB's httpfs autoload (see [Maintenance notes](#maintenance-notes)).
- `'http://host[:port]'` — works on DuckDB builds that have httpfs loaded.
- `'host[:port]'` — bare form, treated identically to `rip://`.

Any of the three accept `?query` or `#fragment` suffixes and trailing path segments; all are stripped at parse time. An unreachable URL at attach time throws `IOException`.

Any other scheme (`https://`, `ftp://`, etc.) throws `InvalidInputException`.

### Remote catalog

A ripdb attachment exposes a single schema, `main`, containing one `TableCatalogEntry` per table visible to rip-db. Catalog population is eager: `GET /tables` plus one `GET /schema/:t` per table, all at ATTACH time. Populated entries have stable pointers for the lifetime of the attach; DuckDB's binder, planner, and autocomplete rely on this.

Lookup is case-insensitive; the original remote identifier casing is preserved for SQL emission.

### Queries

Each top-level `SELECT` against `r.*` triggers exactly one `POST /ddb/run` to rip-db carrying the pushdown-optimized SQL ripdb built, receiving a binary response body. DuckDB's local planner handles joins, aggregates, ordering, grouping, and window functions; the remote side scans and streams rows.

### Autocomplete

Three completion forms work:

| Input | Completions |
|---|---|
| `r.smok<TAB>` | `smoke_orders`, `smoke_people` |
| `r.main.smok<TAB>` | same, via fully-qualified schema |
| `r.smoke_people.fu<TAB>` | `full`, `full_name` |
| `ORDER BY am<TAB>` after `FROM r.smoke_orders` | `amount` |

The fourth standard form — `SELECT <partial> FROM r.t` — completes keywords rather than columns. This is a DuckDB autocomplete-extension limitation that affects local tables identically and is not ripdb-specific.

### Read-only

All DDL and DML are rejected at bind time with:

```
Permission Error: ripdb: remote database attached read-only — <X> is not supported
```

Where `<X>` is the specific operation (`INSERT`, `UPDATE`, `DELETE`, `CREATE TABLE`, `ALTER`, `DROP`, etc.). The `StorageExtension`'s `Plan*` virtuals throw explicitly rather than stubbing to bogus operators.

### Refresh

```sql
CALL rip_refresh('r');
-- or
SELECT * FROM rip_refresh('r');
```

Re-runs `GET /tables` + `GET /schema/:t`, builds a new `SchemaCatalogEntry`, and swaps it in atomically. Returns a single row `(catalog VARCHAR, tables_loaded BIGINT, tables_refused BIGINT)`.

Refresh invalidates any `optional_ptr<CatalogEntry>` the binder cached from earlier queries — which is the point. In-flight scans keep running against their bind-time data (self-contained). Subsequent queries rebind against the fresh catalog.

Cooperative, not transactional: if the remote calls throw during refresh, the swap does not happen and the existing catalog remains valid.

### Consistency

Each HTTP request is independent server-side — rip-db does not hold a shared snapshot across requests. Concrete implications:

- The remote schema or data may change between two CLI statements. `rip_refresh('r')` reloads the catalog on demand.
- A single DuckDB query plan that issues multiple scans against the same remote table sends each scan as a separate request and could in principle observe drift mid-execution. rip-db serves queries serially on one DuckDB instance, so observed drift within a single plan is extremely rare.
- Catalog-load (at ATTACH) and first query are separate requests; the schema can change between them. ripdb validates wire-level type metadata against the catalog's expectation (see [Maintenance notes](#maintenance-notes)) and throws with a `rip_refresh`-to-reload suggestion on mismatch, rather than mis-writing data.

---

## Limitations

- **Read-only.** `INSERT` / `UPDATE` / `DELETE` / DDL all throw at bind time.
- **Single-threaded scans.** Each scan runs on one thread; DuckDB's parallel planner does not fan out a single ripdb scan across multiple HTTP requests.
- **Full response buffering.** No per-chunk streaming decode. A query returning millions of rows holds the whole response in memory before DuckDB sees any.
- **No query cancellation to the server.** Ctrl-C in the CLI returns control to DuckDB and closes the local socket; rip-db continues running the query to completion, and its result is discarded on arrival.
- **Complex types fall back to VARCHAR.** `LIST`, `STRUCT`, `MAP`, `ARRAY`, `UNION`, `ENUM`, `BIT`, `BITSTRING`, `JSON`, `VARIANT`, `GEOMETRY` are exposed as `VARCHAR` in the catalog; the wire carries their textual representation. DuckDB's JSON operators (`->>`, `json_extract`, `json_keys`, `json_array_length`, …) work directly on the VARCHAR for JSON-shaped data.
- **`BLOB` is refused at catalog population.** A table containing `BLOB` / `BYTEA` / `BINARY` / `VARBINARY` is skipped at ATTACH time with an explanation. Silent byte-mangling through textual encoding is worse than a clear error.
- **No cross-statement transactions.** rip-db sees each request as an independent query; there is no snapshot isolation across multiple CLI statements.
- **No HTTPS.** Transport is plain HTTP; assume localhost or a trusted network.

---

## Performance characteristics

**Transport.** HTTP/1.1 with `Content-Length` framing. `Transfer-Encoding: chunked` is not accepted. No TLS.

**Wire format.** Binary. Per-column payloads match DuckDB's physical storage where possible (e.g. `HUGEINT` as raw 16-byte little-endian `(lo, hi)`, `VARCHAR` as varint-length + UTF-8 bytes) so decode is a bounded per-row dispatch with no string parsing on the scalar hot path. See [Protocol and HTTP API](#protocol-and-http-api).

**Projection pushdown.** The extension requests only columns in the query's `ColumnIndex` set; unreferenced columns never leave rip-db. If DuckDB projects a synthetic rowid (`count(*)`, planner-injected), column 0 is requested as a harmless row-count probe.

**Predicate pushdown.** Filters arrive via `table_function_pushdown_complex_filter_t`. Expressions matching the supported subset below are translated to a remote `WHERE` clause and removed from DuckDB's local plan; the rest stay local.

- **Translated**: `=`, `!=`, `<`, `<=`, `>`, `>=` (column-vs-literal, operands swappable), `IS NULL`, `IS NOT NULL`, `AND` of any translatable children.
- **Column types translated**: integer family (`TINYINT`..`BIGINT` + unsigned variants), `BOOLEAN`, `VARCHAR`.
- **Not translated** (evaluated locally by DuckDB after the scan):
  - `OR` — partial-OR pushdown is unsound; full-OR carries NULL 3VL risk across the client/server boundary.
  - column-vs-column, function calls, non-literal RHS, implicit-cast-wrapped columns.
  - `LIKE`, `ILIKE`, regex, collation-dependent operators.
  - `FLOAT`, `DOUBLE`, `DATE`, `TIME`, `TIMESTAMP*`, `DECIMAL` — remote literal semantics for these types aren't provably equivalent to DuckDB's own, so they stay local rather than risk silent divergence.

**Literal formatting.** Type-gated. Integers as decimal text; booleans as `TRUE` / `FALSE`; `VARCHAR` single-quoted with `''` escape for embedded quotes. No format-string interpolation; SQL injection via pushed literals is not possible.

**Buffering.** Each scan reads the full HTTP response body, decodes it once, then streams `DataChunk`s to DuckDB. Peak memory during a scan is approximately `response size + (result rows × column count × per-value cost)`.

**Concurrency.** `MaxThreads() = 1`. Each scan runs on a single thread.

---

## Architecture

```
┌───────────────────────────────┐
│         duckdb CLI            │   stock binary, unmodified
│   (shell highlighting and     │
│    autocomplete built in)     │
└────────────┬──────────────────┘
             │ in-process C++
             ▼
┌───────────────────────────────┐
│     ripdb.duckdb_extension    │
│                               │
│  RipCatalog                   │   ATTACH target
│   └─ RipSchemaEntry 'main'    │
│       └─ RipTableEntry × N    │   one per remote table
│                               │
│  RipHttpClient                │   BSD-sockets HTTP/1.1
│  (decoder)                    │   inverse of server's encoder
│                               │
│  rip_refresh()                │   registered TableFunction
│  RipScanFunction              │   projection/predicate pushdown
└────────────┬──────────────────┘
             │ HTTP/1.1 + binary body
             ▼
┌───────────────────────────────┐
│           rip-db              │
│   (Bun server + DuckDB FFI)   │
└───────────────────────────────┘
```

The extension owns the client half of an HTTP contract with rip-db. Catalog operations (ATTACH, DESCRIBE, SHOW TABLES) map to lightweight JSON endpoints; scans map to a single binary endpoint. DuckDB's own planner and executor run unchanged on the ripdb-provided data.

---

## Protocol and HTTP API

### Endpoints consumed

| Method + path | Used for | Request | Response |
|---|---|---|---|
| `GET /tables` | Catalog population | — | `{"tables": [...]}` JSON |
| `GET /schema/:t` | Per-table column info | — | `{"schema": [{column_name, column_type}, ...]}` JSON |
| `POST /ddb/run` | Query execution | `text/plain` SQL body | binary response (see below) |
| `GET /health` | Liveness / probe | — | `{"ok": true}` |

### Binary response format (`POST /ddb/run`)

The body is a framed binary stream. Each logical element is a field id (little-endian u16) plus its payload; a record terminator is `0xFFFF`. Top level:

```
envelope:
  field 100 (u8):    success_flag  (0 = error, 1 = success)
  if success_flag == 0:
    field 101:       error message (varint length + UTF-8 bytes)
    0xFFFF
  if success_flag == 1:
    field 101:       ColumnNamesAndTypes record
    field 102:       list<DataChunk>
    0xFFFF
```

Column type records are flat for scalar types (`field 100` = typeId u8, `field 101` = legacy-extra u8). `DECIMAL` carries `field 102` (width u8) and `field 103` (scale u8) before the record terminator. `DataChunk` payloads are per-column validity bitmaps plus fixed-width raw blobs for scalar types, variable-length strings for `VARCHAR`, unscaled signed integers at the appropriate physical width for `DECIMAL`.

For the exact decoder, see `packages/db/extension/decoder.{h,cpp}`. The encoder is `packages/db/lib/duckdb-binary.rip`. Any change to the format bumps `fixtureFormatVersion` and requires a coordinated update on both sides plus golden fixtures.

### Multi-chunk framing

Responses may contain multiple `DataChunk`s (the list in `field 102`). rip-db emits a single chunk by default; clients can request smaller chunks via the `X-Rip-DB-Chunk-Size` request header. The decoder handles any chunk count uniformly.

### Error envelope

A `success_flag == 0` envelope carries the server's error message verbatim. ripdb rethrows it as `IOException` with the server message preserved, prefixed with the request's verb and path for context.

### Versioning

The wire format is versioned by `fixtureFormatVersion` in rip-db's encoder and validated implicitly by the golden-fixture matrix in `packages/db/extension/test/fixtures/`. ripdb and rip-db are developed in lockstep; mismatched versions surface as `DecodeError` with a recognizable substring (`"unknown typeId"`, `"unexpected end of buffer"`, `"expected end marker"`, `"string length"`, `"bitmap"`, `"boolean"`).

---

## Type mapping

### Native (round-trip preserves full precision)

| DuckDB type | Wire representation |
|---|---|
| `BOOLEAN` | 1 byte per row |
| `TINYINT` / `SMALLINT` / `INTEGER` / `BIGINT` | fixed-width little-endian signed |
| `UTINYINT` / `USMALLINT` / `UINTEGER` / `UBIGINT` | fixed-width little-endian unsigned |
| `HUGEINT` / `UHUGEINT` | 16 bytes: `(lo u64, hi int64/u64)` little-endian |
| `FLOAT` / `DOUBLE` | IEEE-754 little-endian bits |
| `DATE` | int32 days since 1970-01-01 |
| `TIME` / `TIME_NS` | int64 (micros / nanos of day) |
| `TIME_TZ` | uint64 packed `(micros << 24) \| (offset + 86399)` |
| `TIMESTAMP` / `TIMESTAMP_TZ` / `TIMESTAMP_SEC` / `TIMESTAMP_MS` / `TIMESTAMP_NS` | int64 in the indicated unit |
| `INTERVAL` | 16 bytes: int32 months + int32 days + int64 micros |
| `UUID` | 16 bytes: `(lo u64, hi int64 with MSB XOR-flipped for sort stability)` |
| `VARCHAR` / `CHAR` | varint length + UTF-8 bytes |
| `DECIMAL(W,S)` | unscaled signed integer at DuckDB's physical width (int16/int32/int64/int128 by precision class); `W`/`S` carried in the type record |

### VARCHAR fallback (client sees UTF-8 text)

`ENUM`, `LIST`, `STRUCT`, `MAP`, `UNION`, `ARRAY`, `BIT`, `BITSTRING`, `JSON`, `VARIANT`, `GEOMETRY`.

For JSON-shaped data, DuckDB's scalar JSON operators (`->>`, `json_extract`, `json_extract_string`, `json_array_length`, `json_keys`) work directly on the VARCHAR — no native STRUCT round-trip required.

### Refused at catalog population

`BLOB`, `BYTEA`, `BINARY`, `VARBINARY`. Tables containing any of these are skipped at ATTACH time with an explanatory message printed via DuckDB's `Printer`. Silent byte-mangling through textual encoding is worse than a clear error.

---

## Compatibility and trust assumptions

- **DuckDB version coupling.** The extension is ABI-coupled to a specific DuckDB build. Rebuild after each DuckDB upgrade. `build-loadable.sh` writes a 534-byte metadata footer (`magic="4"`, `platform`, `duckdb_version`, `extension_version`, `abi_type=CPP`); a mismatched CLI refuses to `LOAD` the extension with a version-mismatch error.
- **rip-db version coupling.** ripdb and rip-db are developed together. Mismatched wire versions surface as `DecodeError` from the first `POST /ddb/run`.
- **Transport.** Plain HTTP. No auth. No TLS. Designed for localhost or trusted-network use. Running ripdb against an untrusted network endpoint is out of scope.
- **Extension signing.** The built `.duckdb_extension` file is unsigned. The stock CLI requires `-unsigned` (or an equivalent setting) to `LOAD` it. Users in environments that require signed extensions need a private signing key.
- **Supported platforms.** Whatever DuckDB itself supports as a C++ extension target. Build scripts are written for macOS and Linux.

---

## Build and packaging

### Prerequisites

1. Clone DuckDB at a compatible commit into `misc/duckdb/`.
2. `cd misc/duckdb && make release` — produces `libduckdb.dylib` (or `.so` / `.dll`) and the `duckdb` CLI.
3. For tab completion to include remote tables, ensure the DuckDB build includes the in-tree `autocomplete` extension. `packages/db/extension/scripts/duckdb-extension-config.cmake` is a drop-in for `misc/duckdb/extension/extension_config_local.cmake` that enables it.

### In-process test driver (fast iteration)

```bash
cd packages/db/extension
./build-extension.sh                     # compile + run 48-case smoke test
./build-extension.sh --no-run            # compile only
```

Links `decoder.cpp + ripdb.cpp + extension_test.cpp` against `libduckdb`, calls `Load(loader)` directly (no dlopen, no metadata footer, no `LOAD` statement), runs ATTACH / SELECT / refresh / pushdown scenarios against a live rip-db on `:4214`. Fast; no loadable-extension overhead.

### Loadable `.duckdb_extension`

```bash
cd packages/db/extension
./build-loadable.sh
```

Produces `ripdb.duckdb_extension`: a shared object plus a 534-byte DuckDB metadata footer (22-byte WASM prefix + 256-byte metadata + 256-byte signature). This is the file the stock CLI `LOAD`s.

### rip-db smoke server

```bash
rip packages/db/extension/scripts/smoke-server.rip
```

Starts a `:memory:` rip-db on `:4214` and seeds two tables for the extension tests: `smoke_people` (10 rows, includes a mix of NULL and non-NULL `birthdate` TIMESTAMPs) and `smoke_orders` (20 rows, includes a `DECIMAL(10,2) price` column).

Idempotent subprocess lifecycle: the script spawns rip-db in a detached process group and tears it down via group-signaling on any exit path — `SIGINT`, `SIGTERM`, `EPIPE` on stdout/stderr, uncaught exceptions, pipe-reader exit. Safe to run as `| head -N` without orphaning rip-db.

### Decoder golden tests (no DuckDB linkage)

```bash
cd packages/db/extension
./build.sh                               # compile + run 200-fixture matrix
```

Runs the decoder against captured `.bin` fixtures in `test/fixtures/` — every null pattern (all_valid, all_null, alternating, every_64th, partial_word, bursty) crossed with every native type, plus envelope shapes and malformed-input rejection cases.

Regenerate fixtures via `packages/db/extension/scripts/capture-fixtures.rip` (idempotent; re-running produces byte-identical output). Any diff in regenerated fixtures is a wire-format change and must be paired with a decoder update plus a `fixtureFormatVersion` bump.

---

## Maintenance notes

Durable facts about how this extension binds to DuckDB that aren't obvious from reading DuckDB's public headers.

### Catalog integration

`RipCatalog` extends `duckdb::Catalog`. `RipSchemaEntry` extends `SchemaCatalogEntry`. `RipTableEntry` extends `TableCatalogEntry`. All three own their children via `unique_ptr`; pointers returned to DuckDB are stable for the life of the attach (except across `rip_refresh`, which swaps the schema atomically and invalidates any cached `optional_ptr<CatalogEntry>` the binder was holding).

Schema lookup is case-insensitive (`case_insensitive_map_t`), but the original remote identifier casing is preserved for SQL emission. Every SQL-building site uses `QuoteIdentifier` to handle embedded double-quotes and reserved words.

`Catalog::DropSchema` is a **private** pure virtual; overriding it is necessary to satisfy the vtable. We do so with a no-op that throws `PermissionException`.

`RipTableEntry::GetScanFunction` is called once per query bind and returns a freshly-constructed `TableFunction` whose `RipScanBindData` is self-contained — no back-pointers into the catalog. In-flight scans therefore survive `rip_refresh`: the scan has everything it needs from bind time.

### Completion

Tab completion in the stock `duckdb` CLI is driven by the built-in autocomplete extension, which calls `Catalog::GetAllSchemas(context)` → `schema.Scan(TABLE_ENTRY, callback)` → `entry.name` / `entry.GetColumns()`. No completion-specific registration is needed from ripdb; implementing the standard `Scan` / `LookupEntry` virtuals is sufficient.

Syntax highlighting in the CLI uses a separate element taxonomy (`DATABASE_NAME`, `SCHEMA_NAME`, `TABLE_NAME`, `COLUMN_NAME`, plus many others for constants / operators / comments). The shell reads catalog identifiers through the same interface to decide what to color — meaning ripdb's catalog contributions feed highlighting for free.

### Filter pushdown API

The extension uses `table_function_pushdown_complex_filter_t` (the "consume what you can, leave the rest" contract) rather than `filter_pushdown = true` (which would claim DuckDB won't re-apply the filter). The complex-filter callback is the only contract under which partial pushdown is sound.

Adding a new filter type = adding a case to `TryTranslateExpression`. Each new case must round-trip through the equivalence-gated tests in `extension_test.cpp`: a query produced with pushdown and a query produced without it must return identical rows.

`BoundColumnRefExpression::binding.column_index` is a `LogicalGet`-projection index, **not** a table-column index. Map it through `LogicalGet::GetColumnIndex(binding).GetPrimaryIndex()` to reach `RipScanBindData::all_column_names`. Using the raw `binding.column_index` mis-addresses columns silently; the equivalence tests catch it immediately.

### HTTP client choice

The extension uses a ~140-line BSD-sockets HTTP/1.1 client rather than DuckDB's `HTTPUtil`. Reason: `HTTPUtil` requires the httpfs extension to be loaded at runtime, and `DatabaseManager::AttachDatabase` resolves `IsRemoteFile(info.path)` *before* the `(TYPE ripdb)` clause is considered. An `ATTACH 'http://...'` that hits DuckDB's extension-file-prefix map tries to autoload httpfs even though the user wanted the ripdb path. A bundled HTTP client avoids that dependency entirely.

The `rip://` URL scheme exists precisely because it isn't in DuckDB's prefix map, so `IsRemoteFile` returns false and no autoload is attempted.

### URL parsing

Accepted forms: `http://host[:port]`, `rip://host[:port]`, `host[:port]`. Path components, query strings, and fragments are stripped at parse time. Any other scheme throws `InvalidInputException`. Trailing slashes are stripped from the stored `base_url`.

### DECIMAL wire format

DuckDB's physical storage for `DECIMAL(W,S)` varies by precision class: int16 (W ≤ 4), int32 (W ≤ 9), int64 (W ≤ 18), int128 (W ≤ 38). The wire format mirrors this exactly — the decoder dispatches on width and copies the unscaled signed integer directly into the output `FlatVector` or (for width 19–38) a `hugeint_t`. `W` and `S` are carried in the type record (fields 102 and 103) so the decoder can build `LogicalType::DECIMAL(W, S)` natively.

The FFI wrapper's `col.typeName` must embed the `(W,S)` in the type string for DECIMAL columns — raw `"DECIMAL"` without precision would default to DuckDB's `(18, 3)` at the encoder and silently corrupt precision on the wire. Any future parameterized type (parameterized VARCHAR, ENUM with dictionary size, etc.) follows the same pattern.

### Catalog/wire type agreement

For any type whose wire format carries metadata (DECIMAL today), the scan path validates that the decoded wire-metadata matches the catalog's bind-time expectation. A mismatch means the remote schema changed between the attach-time DESCRIBE and the scan; ripdb throws with an explicit `rip_refresh()`-to-reload suggestion. Silent divergence would be silent data corruption.

### Wire-format extension policy

New types add new type-record field ids. Existing type records stay byte-identical for backward compatibility; only types that need new fields carry them. Decoders reject unknown field ids for a given typeId explicitly (no skip-with-length convention).

### Error translation

| Origin | DuckDB exception |
|---|---|
| Connect failure, send/recv failure, malformed HTTP | `IOException` |
| Remote error envelope (`/ddb/run` returned `isError`) | `IOException` with server message preserved |
| Unparseable wire body | `IOException` carrying a decoder substring (see [Versioning](#versioning)) |
| Write attempt on a read-only catalog | `PermissionException` |
| Bad URL at ATTACH | `InvalidInputException` |
| Remote schema drift detected at scan time | `IOException` with `"call rip_refresh to reload"` guidance |
| `BLOB` column at catalog population | table skipped; `Printer::Print` explanation |

### Refresh semantics

`rip_refresh('r')` builds a new `RipSchemaEntry` from scratch (fresh `/tables` + `/schema/:t` calls), then swaps it into `RipCatalog::main_schema_`. This invalidates any `optional_ptr<CatalogEntry>` the binder cached from earlier queries. Consumers must re-bind to see refreshed structure; DuckDB does this automatically for new queries.

Cooperative, not transactional: if refresh network calls throw, the swap does not happen and the existing schema remains valid.

### Relevant DuckDB source files

For maintainers tracing the binding, these are the non-obvious interface surfaces in DuckDB:

| File | Why it matters |
|---|---|
| `src/include/duckdb/storage/storage_extension.hpp` | `StorageExtension::Register`, the ATTACH dispatch site |
| `src/main/database.cpp::CreateAttachedDatabase` | Where `(TYPE ripdb)` is consulted |
| `src/include/duckdb/catalog/catalog.hpp` + `catalog_entry/schema_catalog_entry.hpp` | `Catalog` / `SchemaCatalogEntry` pure virtuals we override |
| `extension/autocomplete/autocomplete_extension.cpp` | Proves completion uses standard catalog introspection |
| `src/include/duckdb/function/table_function.hpp` | `TableFunction` flags (`projection_pushdown`, `pushdown_complex_filter`) and their contracts |
| `src/include/duckdb/planner/expression/bound_*.hpp` | Expression classes arriving in `pushdown_complex_filter` |
| `src/include/duckdb/common/types.hpp` | `DecimalType::GetWidth` / `GetScale`, `LogicalType::DECIMAL(w, s)` |
| `tools/shell/include/shell_highlight.hpp` | CLI highlight element taxonomy |

---

## Resources

- Source: `packages/db/extension/` (ripdb extension) + `packages/db/lib/duckdb-binary.rip` (server-side encoder)
- Standalone decoder + golden-test harness: `packages/db/extension/decoder.{h,cpp}` + `decoder_test.cpp` + `test/fixtures/`
- In-process test driver: `packages/db/extension/extension_test.cpp`
- rip-db HTTP server: `packages/db/db.rip`
