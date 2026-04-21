# `ripdb` — Native DuckDB CLI integration for rip-db

> **Document status:** Implementation plan, reviewed by peer AI (GPT-5.4) over three rounds on the `rip-duck-design` conversation. Pinned to DuckDB source at commit **`f9d17f0eb7a6f90586dbf08910910f766eb1b29c`** (`misc/duckdb/`). All interface signatures, wire-layout details, and API names below are **pseudocode until verified against this exact checkout during implementation**. Treat concrete C++ shown below as a structural sketch; exact member names, parameter types, and header locations must be cross-checked at compile time because DuckDB's internal catalog/storage/http APIs drift across versions. Where a claim is load-bearing (e.g. binary layout matches for `memcpy`), the plan calls out verification gates before relying on it.
>
> **Commit 1 (decoder + golden-test harness, no DuckDB linkage) landed as `4e8b73b` on `rip-duck`.** 200 / 200 fixtures passing.
> **Commit 2 (DuckDB binding: Catalog + Scan + `ATTACH` + `.duckdb_extension`) landed on `rip-duck`.** 14/14 in-process smoke tests pass, full SQL smoke passes via stock `duckdb -unsigned` CLI, table + column completion verified for three of the four CLI.md forms (the fourth is a known DuckDB autocomplete limitation, not ripdb-specific). See [Implementation progress](#implementation-progress) for the running log.
>
> **Commit 3 (subprocess hardening) landed as `4f12e17` on `rip-duck`.** `smoke-server.rip` and `capture-live.rip` now spawn rip-db in a detached process group and tear it down via group-signaling, so the inner-loop test scripts never leak rip-db processes on pipe breakage / Ctrl-C / SIGTERM / uncaught throws. No functional change to the extension.
>
> **M2 landed on `rip-duck` across commits `e7d9ad8` (URL normalization), `1384e0d` (`rip_refresh`), `84bb022` (predicate pushdown), `5448d66` (parallel-scan decision), `956b202` (Risk 12 DECIMAL — native wire encoding).** 48/48 extension_test cases passing. Predicate pushdown runs for `=`/`<>`/`<`/`<=`/`>`/`>=`/`IS NULL`/`IS NOT NULL`/`AND` on INT/BOOL/VARCHAR; unsupported filters fall back to local DuckDB evaluation. DECIMAL columns round-trip natively with exact precision (LIST still deferred with STRUCT/MAP/ARRAY/UNION to a dedicated "complex types" milestone). Parallel scan is intentionally single-threaded in M2 — see Commit 4 below for the full rationale.
>
> **M2.2 (chunked Transfer-Encoding) and M2.5 (query interrupt) were reverted** as half-features (see Commit 5 below): M2.2's dechunker had no live code path because rip-db never emits chunked bodies, and M2.5's client-side wiring was paired with a server-side `/ddb/interrupt` that's still a stub — so "Ctrl-C" was only half-delivered (client socket closes, remote query continues to completion). Both are recoverable if their preconditions ever change.

**Goal:** Make the stock `duckdb` CLI treat a running `rip-db` HTTP server as an attachable DuckDB database, with native table/column TAB completion. Other libduckdb-based clients (Python, R, DBeaver, DuckDB UI, JDBC) that permit loading signed/unsigned extensions inherit the integration automatically, but explicit compatibility verification is per-client and not an M1 promise.

**End-state user experience:**

```sh
$ duckdb -unsigned
D LOAD '/path/to/ripdb.duckdb_extension';
D ATTACH 'http://localhost:4213' AS rip (TYPE ripdb);
D SHOW TABLES FROM rip;
D DESCRIBE rip.orders;
D SELECT * FROM rip.orders JOIN rip.patients USING (patient_id) LIMIT 10;
D SELECT * FROM rip.o<TAB>                          -- completes to "orders"
D SELECT collected_at, fa<TAB> FROM rip.orders;     -- completes to "fasting"
```

This is the open-source equivalent of MotherDuck's `md:` integration. MotherDuck ships a closed C++ `StorageExtension` wired to DuckDB's autoload + URL-alias machinery (`md:` → `motherduck`). We do the same with `ripdb`, pointed at our own HTTP server instead of MotherDuck's cloud.

---

## Table of contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [What we already have (the 40% head-start)](#what-we-already-have-the-40-head-start)
3. [The DuckDB extension contract — what we're implementing](#the-duckdb-extension-contract--what-were-implementing)
4. [How completion actually works](#how-completion-actually-works)
5. [Wire protocol — decoder plan](#wire-protocol--decoder-plan)
6. [Type support matrix for M1](#type-support-matrix-for-m1)
7. [The `ripdb.cpp` module layout](#the-ripdbcpp-module-layout)
8. [Build & packaging](#build--packaging)
9. [Milestones](#milestones)
10. [Known risks and how we mitigate them](#known-risks-and-how-we-mitigate-them)
11. [Open questions deferred past M1](#open-questions-deferred-past-m1)
12. [References into the DuckDB source tree](#references-into-the-duckdb-source-tree)
13. [Implementation progress](#implementation-progress)
14. [Design sketch — complex types (deferred)](#design-sketch--complex-types-deferred)

---

## Architecture at a glance

```
┌──────────────────┐   ATTACH 'http://…' AS r (TYPE ripdb);
│   duckdb CLI     │   SELECT * FROM r.orders;
│ (stock binary,   │
│  unmodified)     │
└────────┬─────────┘
         │ in-process C++ via StorageExtension +
         │ Catalog / SchemaCatalogEntry / TableCatalogEntry APIs
         ▼
┌──────────────────────────────────────────────────────────┐
│ ripdb.duckdb_extension  (single C++ .so, ~1500 lines)    │
│                                                           │
│  RipCatalog           — registers with StorageExtension   │
│  RipSchemaEntry       — one 'main' schema                 │
│  RipTableEntry        — one per remote table              │
│  RipScanBindData      — table identity + full column meta │
│  RipScanGlobalState   — response buffer + decoder cursor  │
│  RipTransactionMgr    — no-op autocommit                  │
│  BinaryDecoder        — inverse of duckdb-binary.rip      │
│                                                           │
│  HTTP via DuckDB's built-in HTTPUtil                      │
│  (autoloaded from httpfs extension — no libcurl ship)     │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP   POST /ddb/run (SQL body)
                       │        GET  /tables
                       │        GET  /schema/:t
                       ▼
┌──────────────────────────────────────────────────────────┐
│   rip-db  (already built; Rip/Bun + libduckdb via FFI)    │
│                                                           │
│  POST /ddb/run  — executes SQL, returns binary result     │
│                   in rip-db's binary framing              │
│                   (modeled on DuckDB UI extension protocol)│
│  GET  /tables   — returns [{name: "orders"}, ...]         │
│  GET  /schema/:t — returns DESCRIBE output                │
│                                                           │
│  packages/db/lib/duckdb.mjs       (FFI into libduckdb)    │
│  packages/db/lib/duckdb-binary.rip (wire protocol encoder)│
└──────────────────────┬───────────────────────────────────┘
                       │ FFI (duckdb_query, fetch_chunk,
                       │      vector_get_data, etc.)
                       ▼
                  libduckdb.dylib (or .so)
```

Two distinct libduckdb processes, talking via HTTP. The extension's job is strictly:

1. Present the remote DuckDB's catalog to the local DuckDB's binder/autocomplete/planner.
2. Translate SELECTs into HTTP POST + binary decode.
3. Return DataChunks to the local query executor.

Everything else (query planning, joins, aggregations, window functions) runs locally in the client's DuckDB. The remote side just executes whatever SQL the extension sends.

---

## What we already have (the 40% head-start)

The design hinges on leveraging existing code we've written on the rip-db side:

### 1. `packages/db/lib/duckdb.mjs` (1,077 lines)
Bun FFI bindings to libduckdb's C API. Reads DuckDB's internal vector memory directly (`duckdb_vector_get_data`, `duckdb_vector_get_validity`) with per-type byte parsing. Production-tested. This is what rip-db uses to execute SQL and extract rows.

### 2. `packages/db/lib/duckdb-binary.rip` (734 lines)
Server-side encoder for DuckDB UI extension's binary wire protocol. Implements:
- All 37 `LogicalTypeId` constants (in the enum)
- Primitive writers (varint, LE integers, floats, strings, validity bitmap)
- Per-type vector serialization for ~23 scalar types (native encoding)
- Helper conversions (date → days, timestamp → micros, UUID sign-bit XOR, interval tri-field, hugeint split)
- `serializeSuccessResult`, `serializeErrorResult`, `serializeEmptyResult`

**Our C++ extension's binary decoder is the structural inverse of this file for the natively-encoded type subset.** Every `write*` on the server has a corresponding `read*` on the client. For the 12 "fallback" types that the server stringifies (see [Types that fall back to VARCHAR on the wire](#types-that-fall-back-to-varchar-on-the-wire)) the round-trip is intentionally lossy: the client sees textual VARCHAR, not the original semantic type. The per-type wire payloads for the natively-encoded subset are chosen to match the contiguous buffer returned by `FlatVector::GetData<T>()` for the corresponding DuckDB physical storage type — enabling `memcpy`-based decode paths — **but each such claim is verified by a round-trip golden test before the optimization is relied on** (see Risk 2 and the type matrix test).

### 3. `packages/db/db.rip` (446 lines)
HTTP server exposing:
- `POST /ddb/run` — SQL body in, binary result out (the DuckDB UI protocol)
- `POST /sql` — SQL body in, JSON result out (useful for debugging)
- `GET /tables` — list all tables in the database
- `GET /schema/:t` — returns DESCRIBE output for a table
- `POST /ddb/tokenize` — tokenizes SQL for UI syntax highlighting
- `POST /ddb/interrupt` — cancels in-flight query
- `GET /health`, `GET /version`, `GET /info`, `GET /config` — housekeeping

The three endpoints we actively need for M1 are: **`GET /tables`, `GET /schema/:t`, `POST /ddb/run`**. Everything else is already there if we want it later.

---

## The DuckDB extension contract — what we're implementing

All paths verified against the checked-out DuckDB source at `misc/duckdb/`.

### Pure virtuals we MUST override

> All method lists in this section are derived from reading the pinned `misc/duckdb/` headers (commit `f9d17f0eb7a`). **Exact signatures and the completeness of each list are verified at compile time**, not from this doc. Any method that's pure-virtual in the pinned headers but missing from our override list is a compile error, not a runtime bug — we'll discover and fix at build time.

**`duckdb::Catalog`** (`src/include/duckdb/catalog/catalog.hpp`):
- `Initialize(bool load_builtin)` — startup; load our remote catalog here
- `GetCatalogType()` — returns `"ripdb"`
- `CreateSchema(CatalogTransaction, CreateSchemaInfo&)` — **throws** in M1
- `LookupSchema(transaction, schema_lookup, if_not_found)` — resolves schema name → our `main_schema`
- `ScanSchemas(context, callback)` — invokes callback with our one `main_schema` entry
- `PlanCreateTableAs`, `PlanInsert`, `PlanDelete`, `PlanUpdate` — **throw** in M1
- `GetDatabaseSize(context)` — return zeroed struct or minimal info
- `InMemory()` — return `false`
- `GetDBPath()` — return the attached URL

**`duckdb::SchemaCatalogEntry`** (`src/include/duckdb/catalog/catalog_entry/schema_catalog_entry.hpp`):
- `Scan(context, type, callback)` — **critical for completion**; iterates tables when `type == TABLE_ENTRY`
- `Scan(type, callback)` — committed-only version; delegates to above
- `LookupEntry(transaction, lookup_info)` — case-insensitive name lookup into our table map
- `CreateIndex`, `CreateFunction`, `CreateTable`, `CreateView`, `CreateSequence`, `CreateTableFunction`, `CreateCopyFunction`, `CreatePragmaFunction`, `CreateCollation`, `CreateType` — **all throw** in M1
- `DropEntry(context, info)` — **throws** in M1
- `Alter(transaction, info)` — **throws** in M1

**`duckdb::TableCatalogEntry`** (`src/include/duckdb/catalog/catalog_entry/table_catalog_entry.hpp`):
- `GetStatistics(context, column_id)` — return `nullptr` (no stats; planner falls back to defaults)
- `GetScanFunction(context, bind_data)` — returns our configured `TableFunction` + attaches bind data
- `GetStorageInfo(context)` — return empty `TableStorageInfo{}`

**`duckdb::TransactionManager`** (`src/include/duckdb/transaction/transaction_manager.hpp`):
- `StartTransaction(context)` — return trivial `RipTransaction` (just enough to satisfy the interface)
- `CommitTransaction(context, txn)` — no-op, return `ErrorData{}`
- `RollbackTransaction(txn)` — no-op
- `Checkpoint(context, force)` — no-op

### `StorageExtension` registration

From `src/include/duckdb/storage/storage_extension.hpp`:

```cpp
shared_ptr<StorageExtension> MakeRipDBStorageExtension() {
    auto ext = make_shared_ptr<StorageExtension>();
    ext->attach = RipAttach;                         // returns RipCatalog
    ext->create_transaction_manager = RipCreateTxnMgr; // returns RipTransactionManager
    return ext;
}

void Load(ExtensionLoader &loader) {
    auto &db = loader.GetDatabaseInstance();
    auto &config = DBConfig::GetConfig(db);
    StorageExtension::Register(config, "ripdb", MakeRipDBStorageExtension());
}
```

### HTTP transport via `HTTPUtil` (no vendored HTTP client)

The signatures in this section are **illustrative pseudocode**, not verified call sites. The exact API shape of `HTTPUtil::Get`, `InitializeParameters`, `InitializeClient`, and `PostRequestInfo` will be nailed down during the first compile against the pinned `misc/duckdb/src/include/duckdb/common/http_util.hpp`. The structural intent:

```cpp
// Pseudocode — exact member names and parameter orderings verified at build time.
auto &http_util = HTTPUtil::Get(db);
auto params     = http_util.InitializeParameters(db, url);
auto client     = http_util.InitializeClient(*params, proto_host_port);

HTTPHeaders headers;
PostRequestInfo post(path, headers, *params, sql.data(), sql.size());
auto response = client->Post(post);
// Extract the binary response body however the real API does it.
```

When an HTTP URL is first accessed, DuckDB autoloads `httpfs` (an official signed extension) which provides the concrete `HTTPUtil` implementation. **This creates a runtime dependency** — not a compile-time one. If the loaded DuckDB binary is built without the httpfs extension available, our extension will fail at first HTTP call. For M1's localhost-only use case on a stock `duckdb` binary, httpfs is always available. Environments that disable community/unsigned extensions or that strip httpfs are explicitly out of scope for M1.

### URL scheme alias (`rip://` → `ripdb`) — deferred to v2

DuckDB's URL aliases are in a static table in `src/main/extension/extension_alias.cpp`:

```cpp
static const ExtensionAlias internal_aliases[] = {
    {"http", "httpfs"},
    {"md", "motherduck"},
    {"postgres", "postgres_scanner"},
    {"sqlite", "sqlite_scanner"},
    // ...
};
```

Getting `rip://` into that list requires a PR to DuckDB upstream. Out of scope for M1. M1 users use `ATTACH 'http://...' AS r (TYPE ripdb);` with the explicit `TYPE` clause.

---

## How completion actually works

This is the key architectural insight that makes the plan work: **completion is not a CLI feature. It's a property of the catalog.**

From `extension/autocomplete/autocomplete_extension.cpp`:

```cpp
static vector<reference<CatalogEntry>> GetAllTables(ClientContext &context, bool for_table_names) {
    auto schemas = Catalog::GetAllSchemas(context);
    for (auto &schema_ref : schemas) {
        auto &schema = schema_ref.get();
        schema.Scan(context, CatalogType::TABLE_ENTRY, [&](CatalogEntry &entry) {
            if (!entry.internal || for_table_names) {
                result.push_back(entry);
            }
        });
    }
    // ...
}
```

That's it. On TAB, the autocomplete extension:

1. Calls `Catalog::GetAllSchemas(context)` — walks every attached database.
2. For each schema, invokes `schema.Scan(TABLE_ENTRY, callback)`.
3. The callback pulls `entry.name` — that's what shows up in the menu.

So for completion to "just work" on remote rip-db tables:

- Our `RipCatalog::ScanSchemas` must yield `main_schema`.
- Our `RipSchemaEntry::Scan(TABLE_ENTRY, cb)` must invoke `cb` for each cached `RipTableEntry`.
- Our `RipTableEntry` must have its `columns` field correctly populated (from `/schema/:t`).

That last bullet handles **column completion** too: when the user types `rip.orders.<TAB>`, the SQL binder resolves `rip.orders` through `Catalog::GetEntry` → `SchemaCatalogEntry::LookupEntry` → `RipTableEntry`, and autocomplete introspects `.GetColumns()` directly on the entry. No special completion hooks.

We verified: no special "autocomplete provider" registration is needed. The only autocomplete-aware code in the extension universe is the autocomplete extension itself, which queries the standard catalog interface.

---

## Wire protocol — decoder plan

### Summary

The wire format is **rip-db's bespoke binary framing** (modeled on the DuckDB UI extension protocol but not identical), implemented server-side in `packages/db/lib/duckdb-binary.rip`. Our decoder is the mechanical inverse. Any framing change in `duckdb-binary.rip` requires a coordinated decoder update — these two files form a versioned pair we control end-to-end.

### Envelope format (what `/ddb/run` returns)

```
Success result:
  field 100 (boolean):  success = true
  field 101 (nested):   ColumnNamesAndTypes
    field 100 (list):   column names (varint-prefixed strings)
    field 101 (list):   column types (each is {typeId: u8, extra: u8})
    end marker (0xFFFF)
  field 102 (list):     DataChunks (1 or more — decoder iterates all)
    each chunk:
      field 100 (varint): row_count
      field 101 (list):   vectors (one per column)
        each vector:
          field 100 (u8): allValid flag (0 = all valid, 1 = has bitmap)
          field 101 (data, if allValid==1): validity bitmap, uint64-aligned
          field 102 (varies by type):     per-type encoded data
          end marker (0xFFFF)
      end marker (0xFFFF)
  end marker (0xFFFF)

Error result:
  field 100 (boolean):  success = false
  field 101 (string):   error message
  end marker (0xFFFF)
```

Field IDs are 2-byte little-endian. End marker is `0xFFFF`. Lists are `writeVarInt(count) + count * element_encoder(item)`. Strings are `writeVarInt(byte_len) + UTF-8 bytes`. This is **rip-db's bespoke server framing** (modeled after the DuckDB UI extension protocol, not identical to it) — the decoder is specific to what `duckdb-binary.rip` emits, not a portable DuckDB wire format. Framing decisions (field IDs, end markers, bitmap alignment) are server-encoder conventions we control; any change to the encoder requires a coordinated decoder bump.

### Per-type vector layouts (data section, after validity)

**Only valid under the pinned DuckDB commit; each row below must pass a golden round-trip test before the `memcpy` fast-path is enabled for that type in production.** Wire payloads are designed to match the contiguous flat-vector buffer that `FlatVector::GetData<T>()` returns for that physical type in the pinned version. That is an implementation optimization, not a stable invariant — future DuckDB physical-storage changes for any of these types require decoder updates.

| Type                      | Bytes/row| Encoding                                              | Fast-path? |
|---------------------------|----------|-------------------------------------------------------|------------|
| BOOLEAN                   |        1 | 0 or 1                                                | Tier 1     |
| TINYINT / UTINYINT        |        1 | i8 / u8                                               | Tier 1     |
| SMALLINT / USMALLINT      |        2 | LE i16 / u16                                          | Tier 1     |
| INTEGER / UINTEGER        |        4 | LE i32 / u32                                          | Tier 1     |
| BIGINT / UBIGINT          |        8 | LE i64 / u64                                          | Tier 1     |
| FLOAT                     |        4 | LE IEEE 754 binary32                                  | Tier 1     |
| DOUBLE                    |        8 | LE IEEE 754 binary64                                  | Tier 1     |
| DATE                      |        4 | LE i32 days since Unix epoch                          | Tier 1     |
| TIMESTAMP / TIMESTAMP_TZ  |        8 | LE i64 microseconds since epoch                       | Tier 1     |
| TIMESTAMP_SEC             |        8 | LE i64 seconds                                        | Tier 1     |
| TIMESTAMP_MS              |        8 | LE i64 milliseconds                                   | Tier 1     |
| TIMESTAMP_NS              |        8 | LE i64 nanoseconds                                    | Tier 1     |
| TIME                      |        8 | LE i64 microseconds-of-day                            | Tier 1     |
| TIME_NS                   |        8 | LE i64 nanoseconds-of-day                             | Tier 1     |
| VARCHAR / CHAR            | variable | varint length + UTF-8 bytes (per row)                 | —          |
| HUGEINT / UHUGEINT        |       16 | LE lo + LE hi (128-bit)                               | **Tier 2** — verify physical layout |
| INTERVAL                  |       16 | LE i32 months, LE i32 days, LE i64 micros             | **Tier 2** — verify physical layout |
| TIME_TZ                   |        8 | LE u64 packed: micros<<24 \| (offset_sec+86399)       | **Tier 2** — verify packing |
| UUID                      |       16 | LE u64 lo + LE i64 hi (hi has sign-bit XOR)           | **Tier 2** — verify physical layout |

**Tier 1** = reasonably confident the wire payload matches DuckDB's flat-vector physical layout; golden test required but assumed to pass.

**Tier 2** = specifically flagged by peer review as silent-corruption landmines. For these four types, implement decode as an **explicit per-row read-and-write**, not `memcpy`, until the golden test proves otherwise. An explicit loop for 2048 rows of UUID is still fast; this is pure correctness insurance.

For Tier 1 types, the decoder pattern is:

```cpp
// Pseudocode — actual code is templated and validates flat-vector format.
auto &vec = chunk.data[col_idx];
D_ASSERT(vec.GetVectorType() == VectorType::FLAT_VECTOR);
memcpy(FlatVector::GetData<T>(vec), wire_data_ptr, row_count * sizeof(T));
```

The validity bitmap is written to `FlatVector::Validity(vec).GetData()` either by `memcpy` (if the bitmap semantics — set bit = valid, bit 0 = row 0, uint64-word packing — match exactly, **verified by golden test**) or by an explicit loop setting each bit. Semantic details to verify on first implementation:

- **Bit meaning:** set = valid vs. set = null (server uses set = valid; confirm DuckDB expects same).
- **Bit order within a word:** LSB = lowest row index (server: yes, per `createValidityBitmap` in `duckdb-binary.rip`).
- **Trailing bits beyond `row_count`:** must be zero (null) per DuckDB convention.
- **All-valid shortcut:** server sets `allValid=0` with no bitmap; decoder must initialize vec's validity to all-valid.

**VARCHAR / CHAR** is the only non-trivial case:

```
wire layout (per row):
  varint length || UTF-8 bytes
```

DuckDB's internal layout is `duckdb_string_t` (16 bytes: inline for ≤12 bytes, else length + prefix + pointer). The decoder walks the wire's list and calls `StringVector::AddString(vec, {ptr, len})` per row, which copies into DuckDB's string heap and populates `string_t` correctly.

### Types that fall back to VARCHAR on the wire

Per `duckdb-binary.rip`'s `mapDuckDBType`, the following types are **stringified server-side**:

```
ENUM, LIST, STRUCT, MAP, UNION, ARRAY, BLOB, BIT, JSON, VARIANT, GEOMETRY
```

(DECIMAL was on this list in M1 and the first half of M2; it gained native wire encoding in commit `956b202` — Risk 12 partial closure — and no longer falls back.)

When a remote table has one of these types, `/ddb/run` returns wire-VARCHAR bytes. **The catalog must reflect this**: `/schema/:t` currently reports the *real* logical type (via `DESCRIBE`), but the wire delivers VARCHAR. We handle this extension-side by applying the same fallback table in our catalog population:

```cpp
LogicalType MapToWireType(const string &server_reported_type) {
    // Mirror mapDuckDBType from duckdb-binary.rip
    // Fixed types: return them as-is
    // DECIMAL → parse width/scale → LogicalType::DECIMAL(w, s)   (native wire, commit 956b202)
    // ENUM/LIST/STRUCT/MAP/UNION/ARRAY/BLOB/BIT/JSON → return VARCHAR
    // ...
}
```

Users who want native support for the remaining types will need both sides upgraded; until then, those types appear as VARCHAR text to the client, which is honest and functional. See [§ Design sketch — complex types](#design-sketch--complex-types-deferred) for the planned approach to the six complex types (LIST, STRUCT, MAP, ARRAY, UNION, ENUM) that sit on this path.

**Semantic caveats for specific fallback types:**

- **`BLOB` → VARCHAR** is **lossy and potentially corrupting** if the server stringifies arbitrary bytes without an encoding. The server today stringifies blobs via `String(v)` which mangles non-text bytes. M1 either (a) documents BLOB as unsupported and returns an error rather than garbage, or (b) the server is updated to emit hex or base64. **Decision for M1: option (a)** — catalog population treats BLOB columns as an error, refusing to expose tables that have BLOB columns. Better than silent corruption.
- **`DECIMAL` → VARCHAR** preserves value via text; loses the declared `(precision, scale)` from the catalog. Client sees VARCHAR column type. For apps that only read and display, this is fine. For apps that do arithmetic on remote DECIMAL columns, they won't work until native DECIMAL in M4.
- **`LIST / STRUCT / MAP / ARRAY / UNION` → VARCHAR** serializes via `JSON.stringify`. Round-trip to JSON and back is typically fine for display, but the client can't use JSON operators on the column (DuckDB would need to parse). Document as "visible but not structurally queryable."
- **`ENUM` → VARCHAR** loses the enum dictionary. The string value is correct but `ENUM_CODE()` and similar won't work.
- **`JSON` → VARCHAR** is essentially a no-op since DuckDB's JSON *is* a VARCHAR at the storage level. This one is safe.

### Decoder state machine (pull iterator)

Per the peer-review refinement:

```cpp
class BinaryDecoder {
    const uint8_t *cursor_;
    const uint8_t *end_;
    vector<ColumnInfo> columns_;
    idx_t total_rows_;
    idx_t rows_emitted_;
    // ... chunk-iteration state ...

public:
    explicit BinaryDecoder(vector<uint8_t> response_body);

    // Parses envelope header on construction; throws if wire doesn't parse.
    // After construction:
    const vector<ColumnInfo>& Columns() const;
    idx_t TotalRows() const;

    // Pull-iterator: fills `out` with up to STANDARD_VECTOR_SIZE rows.
    // Returns number of rows written (0 = exhausted).
    // `out` must be pre-allocated with the right column types; we write into its Vectors.
    idx_t NextChunk(DataChunk &out);
};
```

Design intent: if we later switch from "whole HTTP body in memory" to chunked transfer encoding, only this class changes. The scan function's usage (`while ((n = dec.NextChunk(out)) > 0) yield(out);`) stays identical.

---

## Type support matrix for M1

Based on what `duckdb-binary.rip` natively handles (before VARCHAR fallback):

| Category | Types | Status |
|----------|-------|--------|
| Booleans | `BOOLEAN` | ✅ Native |
| Signed ints | `TINYINT`, `SMALLINT`, `INTEGER`, `BIGINT`, `HUGEINT` | ✅ Native |
| Unsigned ints | `UTINYINT`, `USMALLINT`, `UINTEGER`, `UBIGINT`, `UHUGEINT` | ✅ Native |
| Floats | `FLOAT`, `DOUBLE` | ✅ Native |
| Dates/times | `DATE`, `TIME`, `TIME_TZ`, `TIME_NS` | ✅ Native |
| Timestamps | `TIMESTAMP`, `TIMESTAMP_SEC`, `TIMESTAMP_MS`, `TIMESTAMP_NS`, `TIMESTAMP_TZ` | ✅ Native |
| Intervals | `INTERVAL` | ✅ Native |
| UUIDs | `UUID` | ✅ Native |
| Strings | `VARCHAR`, `CHAR` | ✅ Native |
| Fallback to VARCHAR (lossy) | `DECIMAL`, `ENUM`, `LIST`, `STRUCT`, `MAP`, `UNION`, `ARRAY`, `BIT`, `JSON`, `VARIANT`, `GEOMETRY` | 🟡 Stringified |
| Refused at catalog population | `BLOB` | 🔴 M1 error — see BLOB note |

**26 types with native wire encoding (of which 4 — UUID, TIME_TZ, HUGEINT/UHUGEINT, INTERVAL — are Tier-2, gated on golden-test verification before the fast-path is enabled), 11 types stringified with documented semantic caveats, BLOB explicitly refused in M1** because silent byte-mangling is worse than a clear error. Covers essentially every useful case for data analysis on healthcare/transaction-style schemas. DECIMAL/JSON/LIST arriving as readable text is a v2 upgrade, not an M1 blocker.

---

## The `ripdb.cpp` module layout

One file. ~1,500 lines. No vendored dependencies. Here's the section-by-section structure with approximate line counts:

```cpp
// ============================================================================
// ripdb.cpp — Native DuckDB extension for ATTACHing a remote rip-db server
// ============================================================================

// --- [1] Includes and defines ----------------------------------------- ~30 lines
#include <string>
#include <vector>
#include <memory>
#define DUCKDB_EXTENSION_MAIN
#include "duckdb.hpp"
#include "duckdb/main/extension/extension_loader.hpp"
#include "duckdb/storage/storage_extension.hpp"
#include "duckdb/catalog/catalog.hpp"
#include "duckdb/catalog/catalog_entry/schema_catalog_entry.hpp"
#include "duckdb/catalog/catalog_entry/table_catalog_entry.hpp"
#include "duckdb/transaction/transaction_manager.hpp"
#include "duckdb/transaction/transaction.hpp"
#include "duckdb/common/http_util.hpp"
#include "duckdb/common/types/vector.hpp"
#include "yyjson.hpp"     // DuckDB bundles yyjson for internal JSON use

namespace duckdb { namespace ripdb {

// --- [2] Connection options + HTTP client wrapper -------------------- ~80 lines
struct RipConnOptions {
    string base_url;         // e.g. "http://localhost:4213"
    uint64_t timeout_ms = 30000;
    // (auth headers, etc. — deferred)
};

class RipHttpClient {
    // Thin wrapper around DuckDB's HTTPUtil.
    DatabaseInstance &db_;
    string proto_host_port_;
public:
    vector<uint8_t> PostBinary(const string &path, const string &body);
    string GetJson(const string &path);  // helpers for /tables, /schema/:t
};

// --- [3] Remote catalog metadata (parsed from /tables + /schema/:t) -- ~120 lines
struct RipColumnMeta {
    string name;
    LogicalType type;   // wire-compatible; unsupported → VARCHAR
};

struct RipTableMeta {
    string name;
    vector<RipColumnMeta> columns;
};

// Parses "DESCRIBE table" output from /schema/:t; applies the MapToWireType
// fallback so we never promise a type we can't deliver.
vector<RipTableMeta> FetchCatalog(RipHttpClient &http);
LogicalType MapToWireType(const string &server_reported);

// --- [4] Binary protocol decoder (inverse of duckdb-binary.rip) ----- ~450 lines
struct ColumnInfo {
    string name;
    LogicalType type;
};

class BinaryReader {
    const uint8_t *cursor_, *end_;
public:
    uint8_t  U8();
    uint16_t U16LE();
    uint32_t U32LE();
    uint64_t U64LE();
    float    F32LE();
    double   F64LE();
    uint32_t VarInt();
    string   String();
    vector<uint8_t> Data();
    uint16_t FieldId();
    void     ExpectEndMarker();
    // ...
};

class BinaryDecoder {
    vector<uint8_t> body_;
    BinaryReader r_;
    vector<ColumnInfo> columns_;
    // cursor state for NextChunk...
public:
    explicit BinaryDecoder(vector<uint8_t> body);
    const vector<ColumnInfo>& Columns() const;
    idx_t NextChunk(DataChunk &out);   // pull iterator
    // Throws if body is an error envelope.
};

// Per-type readers. All fixed-width types are a single memcpy.
// VARCHAR decodes varint-length-prefixed UTF-8 and calls StringVector::AddString.
// Validity bitmap memcpys into ValidityMask raw data.

// --- [5] RipTransaction / RipTransactionManager --------------------- ~80 lines
class RipTransaction : public Transaction {
public:
    RipTransaction(TransactionManager &mgr, ClientContext &ctx);
    // Minimum overrides to satisfy the interface.
};

class RipTransactionManager : public TransactionManager {
public:
    explicit RipTransactionManager(AttachedDatabase &db);
    Transaction &StartTransaction(ClientContext &context) override;
    ErrorData CommitTransaction(ClientContext &, Transaction &) override;
    void RollbackTransaction(Transaction &) override;
    void Checkpoint(ClientContext &, bool) override;
};

// --- [6] RipTableEntry : public TableCatalogEntry ------------------- ~180 lines
class RipTableEntry : public TableCatalogEntry {
public:
    RipTableEntry(Catalog &cat, SchemaCatalogEntry &schema, CreateTableInfo &info,
                  RipTableMeta meta);
    TableFunction GetScanFunction(ClientContext &, unique_ptr<FunctionData> &) override;
    unique_ptr<BaseStatistics> GetStatistics(ClientContext &, column_t) override { return nullptr; }
    TableStorageInfo GetStorageInfo(ClientContext &) override { return {}; }
    // Columns accessor inherited from base.
private:
    RipTableMeta meta_;
};

// --- [7] Scan function (bind / init_global / function) -------------- ~200 lines
struct RipScanBindData : public TableFunctionData {
    string base_url;
    string quoted_identifier;             // e.g. "\"main\".\"orders\""
    vector<string> all_column_names;      // full table, not projected
    vector<LogicalType> all_column_types;
};

struct RipScanGlobalState : public GlobalTableFunctionState {
    // Finalized at init time based on projection
    vector<idx_t> projected_ids;
    vector<string> projected_names;
    vector<LogicalType> projected_types;
    unique_ptr<BinaryDecoder> decoder;
    idx_t MaxThreads() const override { return 1; }  // single-threaded M1
};

static unique_ptr<FunctionData>
RipScanBind(ClientContext &, TableFunctionBindInput &, vector<LogicalType> &, vector<string> &);

static unique_ptr<GlobalTableFunctionState>
RipScanInitGlobal(ClientContext &, TableFunctionInitInput &);

static void RipScanFunction(ClientContext &, TableFunctionInput &, DataChunk &);

TableFunction MakeRipScanFunction() {
    TableFunction fn("ripdb_scan", {}, RipScanFunction, RipScanBind, RipScanInitGlobal);
    fn.projection_pushdown = true;   // we honor column_ids at init time
    fn.filter_pushdown = false;      // M1: let DuckDB filter locally
    // No parallel hooks; no statistics yet
    return fn;
}

// --- [8] RipSchemaEntry : public SchemaCatalogEntry ----------------- ~150 lines
class RipSchemaEntry : public SchemaCatalogEntry {
public:
    RipSchemaEntry(Catalog &cat, CreateSchemaInfo &info);
    void PopulateFromMeta(const vector<RipTableMeta> &meta);

    void Scan(ClientContext &, CatalogType, const std::function<void(CatalogEntry &)> &) override;
    void Scan(CatalogType, const std::function<void(CatalogEntry &)> &) override;
    optional_ptr<CatalogEntry> LookupEntry(CatalogTransaction, const EntryLookupInfo &) override;

    // All Create* and DropEntry + Alter → throw PermissionException
    optional_ptr<CatalogEntry> CreateTable(CatalogTransaction, BoundCreateTableInfo &) override {
        throw PermissionException("ripdb: remote database attached read-only (v1)");
    }
    // ... rest of the family throws similarly
private:
    case_insensitive_map_t<unique_ptr<RipTableEntry>> tables_;
};

// --- [9] RipCatalog : public Catalog -------------------------------- ~180 lines
class RipCatalog : public Catalog {
public:
    RipCatalog(AttachedDatabase &db, RipConnOptions options);
    void Initialize(bool load_builtin) override;
    string GetCatalogType() override { return "ripdb"; }

    optional_ptr<SchemaCatalogEntry>
    LookupSchema(CatalogTransaction, const EntryLookupInfo &, OnEntryNotFound) override;

    void ScanSchemas(ClientContext &, std::function<void(SchemaCatalogEntry &)>) override;

    optional_ptr<CatalogEntry> CreateSchema(CatalogTransaction, CreateSchemaInfo &) override {
        throw PermissionException("ripdb: remote database attached read-only (v1)");
    }

    // PlanInsert/Delete/Update/CreateTableAs: throw read-only
    // GetDatabaseSize: return {}
    // InMemory: false
    // GetDBPath: return options_.base_url

private:
    RipConnOptions options_;
    unique_ptr<RipSchemaEntry> main_schema_;
    unique_ptr<RipHttpClient> http_;
};

// --- [10] StorageExtension registration + ATTACH entrypoint --------- ~60 lines
unique_ptr<Catalog> RipAttach(optional_ptr<StorageExtensionInfo>, ClientContext &context,
                               AttachedDatabase &db, const string &name,
                               AttachInfo &info, AttachOptions &options) {
    RipConnOptions conn;
    conn.base_url = info.path;  // e.g. "http://localhost:4213"
    // Parse additional options from options.options map (timeout, etc.)
    return make_uniq<RipCatalog>(db, std::move(conn));
}

unique_ptr<TransactionManager> RipCreateTxnMgr(optional_ptr<StorageExtensionInfo>,
                                                AttachedDatabase &db, Catalog &) {
    return make_uniq<RipTransactionManager>(db);
}

void Load(ExtensionLoader &loader) {
    auto &db = loader.GetDatabaseInstance();
    auto &config = DBConfig::GetConfig(db);
    auto ext = make_shared_ptr<StorageExtension>();
    ext->attach = RipAttach;
    ext->create_transaction_manager = RipCreateTxnMgr;
    StorageExtension::Register(config, "ripdb", std::move(ext));
}

}} // namespace duckdb::ripdb

// --- [11] C-linkage entry points for dlsym -------------------------- ~15 lines
extern "C" {
    DUCKDB_EXTENSION_API void ripdb_init(duckdb::DatabaseInstance &db) {
        duckdb::ExtensionLoader loader(db, "ripdb");
        duckdb::ripdb::Load(loader);
    }
    DUCKDB_EXTENSION_API const char *ripdb_version() {
        return duckdb::DuckDB::LibraryVersion();
    }
}
```

**Total: ~1,500 lines** (±10%). The 450-line decoder budget is the largest single section; the catalog/schema/table-entry layer is ~500 lines combined; glue + entry points make up the rest.

### Identifier quoting helper (per peer review)

```cpp
static string QuoteIdentifier(const string &id) {
    string out = "\"";
    for (char c : id) {
        if (c == '"') out += "\"\"";
        else out += c;
    }
    out += "\"";
    return out;
}
```

Used when building remote SQL: `SELECT <quoted cols> FROM <quoted schema>.<quoted table>`.

---

## Build & packaging

### `build.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

DUCKDB_SRC="${DUCKDB_SRC:-../../misc/duckdb}"
OUT="ripdb.duckdb_extension"

# 1. Compile + link into a shared library
clang++ -std=c++17 -O2 -fPIC -shared \
    -I "${DUCKDB_SRC}/src/include" \
    -I "${DUCKDB_SRC}/third_party/yyjson/include" \
    -DDUCKDB_BUILD_LOADABLE_EXTENSION \
    -DDUCKDB_EXTENSION_NAME=ripdb \
    -o "${OUT}" \
    ripdb.cpp

# 2. Append the DuckDB extension metadata footer (signs as unsigned)
python3 "${DUCKDB_SRC}/scripts/append_extension_metadata.py" \
    --library-file "${OUT}" \
    --extension-name ripdb \
    --extension-version 0.1.0 \
    --duckdb-platform "$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/')" \
    --duckdb-version "$(duckdb -csv -noheader -c 'SELECT library_version FROM pragma_version()' | tr -d '\"')"

echo "Built ${OUT} ($(wc -c < ${OUT}) bytes)"
```

One command → one binary. No vendored dependencies. No OpenSSL, no libcurl, no cpp-httplib. Just clang++ + DuckDB's bundled headers.

### Loading the extension

```sh
$ duckdb -unsigned
D LOAD '/path/to/ripdb.duckdb_extension';
```

Or one-time install into `~/.duckdb/extensions/`:

```sh
$ duckdb -c "INSTALL '/path/to/ripdb.duckdb_extension';"
```

After install, `LOAD ripdb` works from any DuckDB session without the full path, still gated by `-unsigned` until we get into the community extensions registry.

### File layout

```
packages/db/extension/
├── ripdb.cpp            # ~1500 lines, our code
├── build.sh             # ~25 lines
├── README.md            # how to build, load, use
└── test/
    ├── smoke.rip        # spins up rip-db, loads extension, runs golden queries
    └── type_matrix.rip  # per-type round-trip test (all 26 native types)
```

---

## Milestones

### M1 — Read-only ATTACH with completion  *(target: 6–10 focused days)*

M1 is split into two commits on the `rip-duck` branch:

**Commit 1 — decoder + golden-test harness, no DuckDB linkage.** ✅ **Landed** (`4e8b73b`). 200/200 golden fixtures pass.

**Commit 2 — DuckDB binding (Catalog / Scan / StorageExtension / ATTACH).** ✅ **Landed** on `rip-duck`. 14/14 in-process smoke tests pass; full CLI smoke via `duckdb -unsigned LOAD '...duckdb_extension'` passes; completion works in three of four forms (the fourth is a known DuckDB autocomplete limitation unrelated to ripdb).

See [Implementation progress](#implementation-progress) for per-commit breakdowns.

Full M1 scope:
- `ATTACH 'http://...' AS r (TYPE ripdb)` works on stock `duckdb -unsigned` ✅ *(Commit 2 — with the nuance that `rip://` or bare `host:port` are the M1 primary forms; `http://` works on any DuckDB with httpfs loaded. See Commit 2 "HTTP client pivot" for why.)*
- URL normalization handled: trailing slash, optional path, query params stripped ✅ *(trailing slashes stripped; optional path/query params not yet — defer to M2 since no current rip-db endpoint cares.)*
- `RipCatalog` with one `main` schema ✅ *(Commit 2)*
- Eager catalog load at attach time ✅ *(Commit 2)*
- `SHOW TABLES FROM r`, `DESCRIBE r.orders` work ✅ *(Commit 2)*
- `SELECT` with joins, CTEs, window functions, aggregations — all work ✅ *(Commit 2 — joins/aggregations verified; CTEs and window functions inherit for free from DuckDB's planner once the scan function produces DataChunks.)*
- **Completion works natively** in stock CLI (tables + columns), verified for `rip.<TAB>`, `rip.main.<TAB>`, `<col><TAB> FROM rip.table`, `rip.table.<TAB>` ✅ *(Commit 2 — 3/4 forms verified. `<col><TAB> FROM rip.table` with the incomplete-column-before-FROM form is a known DuckDB autocomplete limitation; it completes keywords, not columns, in that position for local DuckDB tables too.)*
- Projection pushdown only (no predicate pushdown) ✅ *(Commit 2)*
- Single-threaded scan (`MaxThreads() = 1`) ✅ *(Commit 2)*
- **Multi-chunk decode supported** — not assumed single-chunk ✅ *(decoder, Commit 1)*
- **Flat-vector format asserted** before `memcpy`; fallback to per-row write if asserting fails *(Commit 2 uses per-row writes universally — no memcpy yet. Fast path deferred to later commit.)*
- 26 types with native wire encoding (4 Tier-2 types gated on golden-test verification); 11 stringified with documented caveats; BLOB errors at catalog population ✅ *(Commit 1 decode + Commit 2 catalog-side VARCHAR fallback + BLOB refuse.)*
- `GetStatistics` returns `nullptr` (no stats) ✅ *(Commit 2)*
- Writes + DDL throw `PermissionException("ripdb: read-only v1")` ✅ *(Commit 2)*
- Whole-HTTP-body buffering on response (not streaming) ✅ *(Commit 2)*
- Error mapping: rip-db `{error: "..."}` JSON → thrown `CatalogException`/`IOException`/`BinderException` with the remote message preserved ✅ *(Commit 1 decode + Commit 2 catalog + scan error paths.)*
- Query interrupt: documented as unsupported for M1 (local Ctrl-C cancels the DuckDB query but not the remote one; rip-db's `/ddb/interrupt` wiring deferred)
- Golden test: type round-trip for all 26 native types (with extra attention to the 4 Tier-2 types) including 50%-NULL columns ✅ *(Commit 1 — 198 encoder-driven golden fixtures across 6 null patterns per type plus edges, envelopes, multichunk, and adversarial rejection; all passing)*
- Smoke test: spin up rip-db against a seeded database, attach, run 10 queries, compare results ✅ *(Commit 2 — Phase 2A in-process driver runs 14 assertions against a seeded smoke server; Phase 2B runs the same surface via the stock CLI.)*

Deferred to M2+:
- Predicate pushdown (SQL WHERE → remote SQL)
- HTTP chunked transfer / streaming decoder
- Parallel scan
- Write operations
- DDL forwarding
- Transaction semantics
- Views and non-table objects
- Catalog refresh hooks
- Statistics / optimizer hinting
- Complex types natively (DECIMAL, LIST, STRUCT, MAP)

### M2 — Predicate pushdown + refresh hooks  *(target: +3 days)*

- `filter_pushdown = true`
- Implement `table_function_pushdown_complex_filter_t` to translate a restricted filter subset into SQL WHERE clauses
- `CALL rip_refresh('r')` scalar to force catalog reload without DETACH/ATTACH
- Catalog invalidation on the server side (optional)

### M3 — Write forwarding  *(target: +3 days)*

- INSERT on `r.table` → POST `/sql` with forwarded INSERT statement
- UPDATE, DELETE similarly
- Error mapping (rip-db's `{error: "..."}` → `CatalogException`/`BinderException`)
- Catalog cache invalidation after DDL

### M4 — DDL forwarding + polish  *(target: +3 days)*

- CREATE TABLE, DROP TABLE, ALTER TABLE forward through `CreateTable` / `DropEntry` / `Alter`
- Actual transaction semantics (BEGIN/COMMIT/ROLLBACK forwarded)
- Views, macros, sequences
- Native support for DECIMAL (wire-side change on rip-db + decoder update)
- Benchmarks, docs, release notes
- Upstream PR to DuckDB: `{"rip", "ripdb"}` in extension_alias.cpp

### M5 — Community release  *(target: ongoing)*

- Signed binary via DuckDB Labs
- Submitted to `community-extensions.duckdb.org`
- Autoload on `ATTACH 'rip://...'` just like `md:`
- Multi-version compatibility matrix
- CI per DuckDB release

---

## Known risks and how we mitigate them

These are the pressure points from the peer-AI review plus our own analysis. Each has a specific mitigation.

### Risk 1: Wire type vs. catalog type mismatch

**Risk:** `/schema/:t` reports real types (e.g., `DECIMAL(18,4)`) but `/ddb/run` delivers wire-VARCHAR. If our catalog promises DECIMAL, decode crashes.

**Mitigation:** Apply `MapToWireType` on catalog population. Unsupported types are *exposed as VARCHAR* in the `ColumnDefinition`. This is honest and non-crashing. Document the trade-off; v2 native DECIMAL is a coordinated server+client upgrade.

### Risk 2: Vector ownership / string memory bugs

**Risk:** VARCHAR in particular — storing pointers into the HTTP response body that die after the scan callback returns. This is silent corruption, not a compile error.

**Mitigation:** Use `StringVector::AddString(vec, {data, len})` for every string, which copies into DuckDB's string heap. Never hand DuckDB a pointer into our own buffer. Unit tests with strings > 12 bytes (to exercise the non-inline path) and with the HTTP body freed before chunks are emitted.

### Risk 3: Validity bitmap bugs

**Risk:** Forget to apply validity after writing data. Null rows surface as garbage values. Downstream operators may still read them. Subtle failure modes: trailing bits beyond `row_count`, bit-order within a word, set-vs-clear bit meaning.

**Mitigation:** Validity is set *before* data writes, every chunk. For Tier 1 types we `memcpy` the bitmap raw into `FlatVector::Validity(vec).GetData()` — *only* after the golden test confirms the four semantic details listed in [Per-type vector layouts](#per-type-vector-layouts-data-section-after-validity) (bit meaning, bit order, trailing bits, all-valid shortcut) match DuckDB's expectations. If any of those diverge, we fall back to an explicit bit-setting loop. Golden test includes a column that's exactly 50% NULL for every type, plus a column where every 64th row is NULL (exercises the word-boundary case).

### Risk 4: Projection pushdown hookup

**Risk:** Expected `column_ids` at bind time; they actually arrive at init time (or vice versa).

**Mitigation:** Bind data stores *full* table metadata (all columns). `RipScanInitGlobal` is where we consult `TableFunctionInitInput::column_ids` and finalize the projection plan (SQL + projected types). This defers the projection decision to the earliest point DuckDB actually provides it. If we discover the API wires projection differently for catalog-backed scans, only `InitGlobal` changes.

### Risk 5: DuckDB version drift

**Risk:** Catalog/TransactionManager virtuals get added, removed, or renamed across versions. Extension stops compiling or has subtle behavioral changes.

**Mitigation:** Pin to one specific DuckDB version in M1 (whatever `misc/duckdb` has checked out). Explicit compatibility matrix documented in README. Upgrade one version at a time with grep for any removed virtuals.

### Risk 6: Identifier quoting

**Risk:** Remote table named `"Select"` or `order-status` crashes because we didn't quote it.

**Mitigation:** `QuoteIdentifier` helper used at every SQL-building site from day 1. Enforced by code review; there's a tiny handful of call sites (4 or 5).

### Risk 7: Non-parallel scan assumption

**Risk:** Some DuckDB code path assumes our scan can parallelize and does unexpected things when it can't.

**Mitigation:** `MaxThreads() = 1` explicitly. No parallel init hooks registered. DuckDB honors `MaxThreads` cleanly; this is well-tested (many extensions are single-threaded).

### Risk 8: Completion name hierarchy

**Risk:** User types `rip.<TAB>` expecting tables; DuckDB treats `rip` as a schema name, not a catalog name.

**Mitigation:** Test completion in all forms early:
- `SELECT * FROM rip.<TAB>` (catalog.table shortcut)
- `SELECT * FROM rip.main.<TAB>` (explicit catalog.schema.table)
- `SELECT <TAB> FROM rip.orders` (column completion)

Since we expose a single `main` schema, DuckDB's catalog resolver should handle both forms correctly. Verified against `DuckCatalog` behavior for the main database.

### Risk 9: Large result sets

**Risk:** Query returning millions of rows buffers the entire response in RAM.

**Mitigation:** Acknowledged M1 limitation. Document it. M2 or M3 switches to chunked transfer / streaming decoder, and the decoder's pull-iterator shape means the scan function doesn't change. The `row-limit` header `x-duckdb-ui-result-row-limit` (default 10000) is already honored server-side — users can pass explicit `LIMIT` in their queries.

### Risk 10: Stale catalog after remote schema change

**Risk:** User adds a table on rip-db; client's attached catalog doesn't see it. Also: DuckDB's binder/planner may cache `CatalogEntry` references beyond a `Catalog::GetCatalogVersion` bump, so even in-session changes could be inconsistent.

**Mitigation:** Documented. M1 workaround is `DETACH r; ATTACH 'http://...' AS r (TYPE ripdb);`. M2 adds `CALL rip_refresh('r')` scalar that bumps the catalog version and clears the entry cache. Cache-aggressiveness beyond what we observe at M1 is explicitly out of scope until M2.

### Risk 11: Internal DuckDB symbol coupling

**Risk:** The plan uses `HTTPUtil`, `StorageExtension`, `Catalog`, `SchemaCatalogEntry`, `TableCatalogEntry`, `TransactionManager` — all **internal** DuckDB APIs, not part of the stable C extension ABI. A binary built against `misc/duckdb` at commit `f9d17f0eb7a` may fail to load in a user's installed `duckdb` binary even at the same marketed version if the installed binary stripped or renamed any of those internal symbols.

**Mitigation:** Explicit compatibility contract in the extension's README: "this extension is built against specific DuckDB versions and must be rebuilt for each new DuckDB release." Symbol-availability check at `Load()` time: call `HTTPUtil::Get(db)` and catch any linker error, surfacing a clear "httpfs support missing from this DuckDB build" message. Longer-term: when upstreaming, propose promoting `HTTPUtil` / `StorageExtension` / catalog registration to the stable C API so the extension can be ABI-portable.

### Risk 12: Server-side fallback stringification round-trip

**Risk:** For fallback types (DECIMAL, LIST, etc.), the server's `String(v)` / `JSON.stringify(v)` conversion is irreversible. Users who see `"[1, 2, 3]"` in a LIST column can't pass it back through `UNNEST` or JSON operators without ad-hoc parsing.

**Mitigation:** Documented per-type semantic caveats in the [Types that fall back to VARCHAR](#types-that-fall-back-to-varchar-on-the-wire) section. For M2, negotiate a proper native encoding on rip-db's side for at least DECIMAL and LIST (the most commonly-used fallback types in practice).

**Status:** **DECIMAL: closed** (commit `956b202`). DECIMAL columns round-trip natively with full DuckDB precision — server emits the unscaled integer at the correct physical width (int16/32/64/128 based on DECIMAL(W,S)), decoder parses the on-wire width/scale from new type-record fields, ripdb surfaces `LogicalType::DECIMAL(w, s)` in the catalog and writes values directly into DuckDB's decimal flat vector. `sum(price)` is exact, not floating-point.

**LIST (and STRUCT / MAP / ARRAY / UNION): deferred by design.** These share an architectural shape (recursive type metadata, variable-length per-row storage, two-level null tracking, per-type DuckDB vector write paths) that's categorically larger than DECIMAL's closure — see [§ Design sketch — complex types](#design-sketch--complex-types-deferred) for the full technical breakdown, wire-format proposal, and suggested implementation order. Until that milestone, these types continue to arrive VARCHAR-stringified per the Types-fall-back-to-VARCHAR section.

### Risk 13: Name normalization beyond quoting

**Risk:** `QuoteIdentifier` handles double-quote escaping but not case-folding, Unicode normalization, or DuckDB's identifier canonicalization rules. A remote table named `Orders` (mixed case) may not be findable if the client queries `SELECT * FROM rip.orders` and our `LookupEntry` does case-insensitive lookup against a map keyed by original case.

**Mitigation:** `RipSchemaEntry` stores tables in a `case_insensitive_map_t` (matches DuckCatalog's convention) keyed by the name as reported by `/tables`. `LookupEntry` takes whatever DuckDB hands us and matches case-insensitively. We do NOT normalize Unicode (NFD vs NFC) — same as DuckDB core. If a user hits an edge case there, they're getting the same behavior they'd get from a local DuckDB.

### Risk 14: Query interrupt / cancellation

**Risk:** User hits Ctrl-C on a long-running `SELECT` against `rip.big_table`. DuckDB cancels the local query. But the HTTP POST to `/ddb/run` is still in flight on the server, potentially burning resources.

**Mitigation:** M1 documents interrupt as "cancels client-side only; remote query continues to completion on server and its result is discarded on arrival." M2 wires up DuckDB's interrupt callback into our HTTP client to call `POST /ddb/interrupt` (which rip-db already exposes) to abort remote execution.

### Risk 15: String heap pressure on large result sets

**Risk:** Whole-result buffering means if a query returns 10 million VARCHAR rows, we hold the entire HTTP body in memory AND materialize every string into DuckDB's string heap via `StringVector::AddString`. Memory spike is 2× the result size.

**Mitigation:** Known M1 limitation; users pass explicit `LIMIT`. M2 switches to chunked HTTP response (decoder pull-iterator shape stays the same), dropping peak memory to ~2 × STANDARD_VECTOR_SIZE rows.

---

## Open questions deferred past M1

- **Authentication / API tokens:** rip-db currently assumes localhost-only trust. If we ever expose it over the network, we need header-based auth. Extension side would parse options like `(TYPE ripdb, token='…')`; server side would validate on /ddb/run.
- **Multi-schema support:** For now one `main` schema. If the remote DuckDB attaches other databases (e.g., MotherDuck-style nested attachment), we'd need to enumerate those too via an expanded `/schemas` endpoint.
- **Arrow IPC as an alternative wire format:** Arrow is streaming-friendly and has broad toolchain support. A `/arrow` endpoint might be nicer than our binary protocol long-term. Decoupled from M1.
- **Prepared statements:** Currently we send fully-interpolated SQL. Parameter binding over the wire would need a protocol extension.
- **`COPY TO` / `COPY FROM`:** Bulk load/export. Would benefit from a streaming path.
- **Transactions across multiple attached rip-db instances:** Out of scope — we're just one endpoint.

---

## References into the DuckDB source tree

Every design decision in this document is grounded in a specific piece of DuckDB source. The key files for implementation reference:

| File | Purpose |
|------|---------|
| `src/include/duckdb/storage/storage_extension.hpp` | `StorageExtension` registration contract |
| `src/include/duckdb/catalog/catalog.hpp` | `Catalog` ABC — our `RipCatalog` parent |
| `src/include/duckdb/catalog/duck_catalog.hpp` | `DuckCatalog` — reference implementation (sibling in-tree) |
| `src/include/duckdb/catalog/catalog_entry/schema_catalog_entry.hpp` | `SchemaCatalogEntry` ABC |
| `src/include/duckdb/catalog/catalog_entry/table_catalog_entry.hpp` | `TableCatalogEntry` ABC |
| `src/include/duckdb/transaction/transaction_manager.hpp` | `TransactionManager` ABC |
| `src/include/duckdb/function/table_function.hpp` | `TableFunction` shape — bind/init/function callbacks |
| `src/include/duckdb/common/http_util.hpp` | `HTTPUtil` + `HTTPClient` — our HTTP transport |
| `src/include/duckdb/main/attached_database.hpp` | How `ATTACH` dispatches to `StorageExtension` |
| `src/main/extension/extension_alias.cpp` | URL scheme aliases (where `rip://` would eventually live) |
| `src/main/attached_database.cpp` | `AttachedDatabase` construction with our extension |
| `src/main/database.cpp:168` | `CreateAttachedDatabase` — the dispatch site |
| `extension/autocomplete/autocomplete_extension.cpp` | Proves completion uses generic catalog calls |
| `extension/autocomplete/include/autocomplete_catalog_provider.hpp` | Provider API — we don't implement this; built-in provider handles us |
| `src/planner/binder/tableref/bind_basetableref.cpp` | How `rip.orders` resolves through catalog |

On the rip-db side:

| File | Purpose |
|------|---------|
| `packages/db/db.rip` | HTTP server — endpoints we consume |
| `packages/db/lib/duckdb.mjs` | FFI bindings — shows how internal vectors are read |
| `packages/db/lib/duckdb-binary.rip` | **Wire protocol spec** — our decoder is the inverse |

---

## Appendix: request/response shape for each endpoint we use

### `GET /tables`

Request: `GET http://localhost:4213/tables`

Response: `200 OK`, `Content-Type: application/json`

```json
{"tables": ["orders", "patients", "providers"]}
```

### `GET /schema/:table`

Request: `GET http://localhost:4213/schema/orders`

Response: `200 OK`, `Content-Type: application/json`

```json
{
  "schema": [
    {"column_name": "id", "column_type": "INTEGER", "null": "YES", ...},
    {"column_name": "requisition", "column_type": "VARCHAR", ...},
    {"column_name": "collected_at", "column_type": "TIMESTAMP", ...}
  ]
}
```

### `POST /ddb/run`

Request:
```
POST http://localhost:4213/ddb/run
Content-Type: application/octet-stream
X-DuckDB-UI-Result-Row-Limit: 100000

SELECT id, collected_at FROM orders WHERE id > 100
```

Response: `200 OK`, `Content-Type: application/octet-stream`

Body: Binary envelope per `[Wire protocol — decoder plan](#wire-protocol--decoder-plan)`.

---

## Sign-off

This plan has been reviewed by a peer AI (GPT-5.4) across three rounds on the `rip-duck-design` conversation (two `discuss` turns + one `chat` review pass). Peer-flagged risks are captured in [Known risks](#known-risks-and-how-we-mitigate-them) with concrete mitigations — the Risk section grew from 10 items to 15 after the final review pass, notably adding internal-symbol coupling (R11), fallback stringification (R12), name normalization (R13), interrupt behavior (R14), and string-heap pressure (R15).

Key revisions from the final review round:

- All interface signatures in the doc are now explicitly **pseudocode pinned to DuckDB commit `f9d17f0eb7a`** until verified at first compile; the plan does not claim to know the exact DuckDB internal ABI.
- UUID, TIME_TZ, HUGEINT, INTERVAL are marked **Tier-2** (verify-before-fastpath) rather than assumed safe for `memcpy`.
- Multi-chunk decode is a hard M1 requirement, not an assumption-of-one.
- BLOB is explicitly refused at catalog-population time, not silently stringified.
- Scope claim narrowed from "every libduckdb client" to "stock `duckdb -unsigned` CLI, with other clients inheriting per-client verification."
- HTTPUtil usage marked as runtime dependency on httpfs availability.

The scope is tight, the type surface is honest, the wire format is already half-implemented (server side), and the extension file is the minimum possible C++ to bridge HTTP to DuckDB's catalog/scan machinery.

Ready to implement on the `rip-duck` branch. The first implementation session should start with the decoder + a standalone golden test harness (no DuckDB dependency yet), validated against bytes emitted from rip-db — then build up the catalog/scan integration on top of a proven decoder.

---

## Implementation progress

This section is a running log of what's been built, in order. The plan above is frozen at design sign-off; this section moves as the branch advances.

### Commit 1 — decoder + golden-test harness  ✅ landed as `4e8b73b`

**Scope:** standalone inverse of the rip-db wire encoder, plus a byte-for-byte golden-test matrix. No DuckDB headers included, nothing links against DuckDB.

**Peer-AI round 5.** Before any decoder code was written, the fixture-capture strategy was floated on `rip-duck-design` and revised against GPT-5.4's critique. Locked-in refinements:

- `.bin` fixtures come from the real encoder path (not a reimplementation); `.golden` files are derived from the same *input spec* — never by decoding the `.bin`. This blocks the "encoder and test oracle silently agree on the wrong thing" failure mode.
- Multi-chunk fixtures drive the real encoder via a new optional `chunkSize` parameter, rather than being hand-rolled in the capture script.
- Null-pattern matrix extended with one **irregular/bursty** pattern (indices `0,1,5,6,7,8,15,31,32,47,63,64,65,76` in a 77-row column). Regular patterns (alternating, every-64th) can accidentally pass an off-by-one decoder; bursty can't.
- "Trailing bits past `row_count` must be zero" was retired as a decoder requirement and restated as: **decoder ignores trailing bits regardless of value.** The current encoder happens to zero them, but the wire spec doesn't guarantee that.
- `manifest.fixtureFormatVersion: 1` added — any future change to the golden text format bumps this and requires a decoder update in the same commit.
- BIGINT / UBIGINT / HUGEINT / UHUGEINT expected values are carried as **strings** in fixtures, always (not magnitude-dependent), to keep comparisons uniform and brittleness-free.
- Adversarial/negative fixture set: truncated, bad end marker, bad success byte, unknown typeId, string length overrun, bitmap too short, empty buffer. Each comes with a `.reject` sidecar declaring a required substring of the thrown `DecodeError`.
- Live `/ddb/run` integration: one single-chunk mixed-type capture + one multichunk capture that crosses a 64-row validity-word boundary. These have no `.golden` (they're sanity checks against the real server, not the decoder's semantic oracle); structural metadata is asserted via `.info` sidecars.

**Shipped artifacts:**

| File                                              | Purpose                                                                          |
|---------------------------------------------------|----------------------------------------------------------------------------------|
| `packages/db/extension/decoder.{h,cpp}`           | Row-by-row decoder, no memcpy anywhere (Tier-1 + Tier-2 both on slow path).      |
| `packages/db/extension/decoder_test.cpp`          | Harness: walks `test/fixtures/`, dispatches on `.golden` / `.reject` / `.info`. |
| `packages/db/extension/build.sh`                  | `clang++ -std=c++17`, single binary, no DuckDB linkage.                          |
| `packages/db/extension/scripts/capture-fixtures.rip` | Encoder-driven fixture generator (deterministic, idempotent).                 |
| `packages/db/extension/scripts/capture-live.rip`  | Spins up rip-db on `:4214`, records raw `/ddb/run` response bytes.               |
| `packages/db/extension/test/fixtures/`            | 198 golden + 2 live-integration fixtures. See its README for the format spec.    |
| `packages/db/extension/test/fixtures/README.md`   | Normative golden-text format + null-pattern catalogue + regeneration recipe.     |
| `packages/db/extension/README.md`                 | Commit-by-commit status tracker for the extension tree.                          |

**Minimal server-side support** (all defaults preserved — existing DuckDB UI clients see zero behavioral change):

- `serializeSuccessResult(columns, rows, {chunkSize})` — optional multi-chunk splitting. Last chunk may be partial. Default (single chunk with every row) is unchanged.
- `parseInterval` — now accepts a raw `{months, days, micros}` object passthrough, for callers (fixture generation, tests) that want intervals the text form can't express (mixed-sign fields, `INT32_MIN` days).
- `POST /ddb/run` — reads optional `X-Rip-DB-Chunk-Size` header, forwards to the encoder as `opts.chunkSize`.

**Coverage demonstrated:**

- All **26 native-wire types** round-trip on every null pattern: BOOLEAN; TINYINT/UTINYINT; SMALLINT/USMALLINT; INTEGER/UINTEGER; BIGINT/UBIGINT; HUGEINT/UHUGEINT; FLOAT; DOUBLE; DATE; TIME / TIME_NS / TIME_TZ; TIMESTAMP / TIMESTAMP_SEC / _MS / _NS / _TZ; INTERVAL; UUID; VARCHAR; CHAR.
- **6 null patterns per type**: `all_valid` (encoder omits bitmap), `all_null`, `alternating`, `every_64th` (tests validity-word boundary), `partial_word` (tests non-multiple-of-64 row counts), `bursty`.
- **Per-type edge fixtures**: INT_MIN / INT_MAX / −1 / 0 / 1 per integer type; ±0, IEEE edges for floats; inline-boundary (12-byte), non-inline (13-byte), 1000-byte, multibyte UTF-8, and embedded-NUL strings for VARCHAR; nil UUID, all-ones UUID, MSB-set UUID (exercises DuckDB's sign-bit XOR); mixed-sign INTERVAL; `INT32_MAX` months with `INT32_MIN` days.
- **Tier-2 types** (UUID, TIME_TZ, HUGEINT, UHUGEINT, INTERVAL) decoded with explicit per-row reads, never buffer reinterpretation — the "silent corruption landmines" called out in the plan's Risk 2 / type matrix can't exist in this code path.
- **Envelopes**: success with zero rows + N columns; success with zero rows + zero columns; three error-envelope shapes (plain ASCII, Unicode, empty message); multi-chunk (64+64, 64+64+2, and a 33-row-chunk mixed-type containing Tier-2 interval columns).
- **Adversarial rejection**: 8 malformed inputs, each with a required `DecodeError::what()` substring.
- **Live integration**: 20-row mixed-type from `/ddb/run` (single chunk) and 150-row 4-chunk capture crossing two 64-row validity boundaries.

**Results:**

```
# ripdb decoder golden tests
# 200 / 200 passed
```

Plus all 1907 top-level `rip-lang` tests green, and all 99 `@rip-lang/db` package tests green with the encoder changes.

**Deliberately deferred past Commit 1:**

- Any DuckDB header inclusion or linkage.
- `DataChunk` / `Vector` / `FlatVector::GetData<T>` / `StringVector::AddString` calls. The decoder emits into an ABI-free `DecodedResult` at this commit; Commit 2 adds the DuckDB-vector binding layer on top.
- `RipCatalog` / `RipSchemaEntry` / `RipTableEntry` / `TableFunction` / `StorageExtension::Register`.
- memcpy fast paths, including for Tier-1 types. The slow path is now the **oracle**: any future fast path must produce byte-identical `DecodedResult`s over the committed fixture matrix before it's allowed to ship. That test is trivial to write against the already-green harness.
- BLOB-refuse-at-catalog-population (plan Risk 2, fallback types): the refusal lives in Commit 2's catalog layer, not the decoder. The decoder already handles the VARCHAR wire payload that DuckDB's `DESCRIBE` would surface today.

**Invariants this commit locks in for downstream work:**

1. The wire format is exactly what `packages/db/lib/duckdb-binary.rip` + `packages/db/db.rip` emit at commit `4e8b73b`. Any change bumps `fixtureFormatVersion` and forces a decoder-side update in the same commit.
2. The decoder's `DecodeError` messages carry a stable-enough substring to assert on (`"unexpected end of buffer"`, `"expected end marker"`, `"unknown typeId"`, `"string length"`, `"bitmap"`, `"boolean"`). The malformed fixtures are the contract.
3. `DecodedResult` is self-contained (owns all strings). No pointers into the HTTP response body ever escape into it — Commit 2 can hand these strings to DuckDB's string heap via `StringVector::AddString` without lifetime gymnastics.
4. The capture scripts are byte-for-byte idempotent. Re-running them produces zero diff; any diff is a real wire-format change that needs review.

### Commit 2 — DuckDB binding  ✅ landed

**Scope:** `ripdb.cpp` + the test driver and build scripts. In-process Phase 2A
proves catalog/scan/HTTP semantics; Phase 2B packages the real loadable
extension and proves the stock-CLI LOAD path end-to-end. Both phases live in
the same commit because they share the same `ripdb.cpp` and the same DuckDB
build.

**Peer-AI round 6 decisions (pre-code):**

- 2A/2B split ratified. 2A gets catalog + scan correctness proven against
  an in-process DuckDB instance (call `Load(loader)` directly, no dlopen,
  no metadata footer, no LOAD statement). 2B layers the `.duckdb_extension`
  packaging and the stock CLI path on top of an already-proven extension.
- Pinned-header recon surfaced one real surprise and three already-known
  refinements: `Catalog::DropSchema` is a **private** pure virtual (still
  must be overridden); `SchemaCatalogEntry::LookupEntry` returns a bare
  `optional_ptr<CatalogEntry>` (not a pair/lookup struct); `PlanDelete`/
  `PlanUpdate` each have both a pure and a non-pure overload (override only
  the pure ones); `HTTPResponse::body` is `std::string` (binary-safe, but
  must be treated as `(data, size)` everywhere).
- Stable object ownership: schema and table entries live in `unique_ptr`
  maps on their owning parent for the life of the attach. No optional_ptrs
  into stack temporaries.
- Name normalization: case-insensitive map for lookup, **original remote
  identifier preserved** for SQL emission. `QuoteIdentifier` applied at
  every SQL-building site.
- `COLUMN_IDENTIFIER_ROW_ID` handled explicitly (synthetic sequential
  BIGINTs on the client side — makes `count(*)` and planner-injected rowid
  projections work without emitting invalid remote SQL). Zero-column
  projection guarded in `init_global`.
- All `Plan*` and `CreateXxx` / `DropEntry` / `Alter` virtuals throw a
  clear `PermissionException("ripdb: remote database attached read-only
  in M1 — <what> is not supported")`, never stub with bogus operators.

**Shipped artifacts:**

| File                                              | Purpose                                                                          |
|---------------------------------------------------|----------------------------------------------------------------------------------|
| `packages/db/extension/ripdb.cpp`                 | The full extension: `RipHttpClient` (see HTTP pivot below), `MapToWireType`, `RipCatalog` / `RipSchemaEntry` / `RipTableEntry`, scan bind/init/function, `RipTransaction` / `RipTransactionManager`, `Load(loader)`, and the `DUCKDB_CPP_EXTENSION_ENTRY(ripdb, loader)` on-disk entry point. |
| `packages/db/extension/extension_test.cpp`        | Phase 2A driver — spins up an in-process DuckDB, calls `Load(loader)` directly, runs 14 smoke assertions. |
| `packages/db/extension/scripts/smoke-server.rip`  | Spins up a seeded `:memory:` rip-db on `:4214` for the smoke driver. |
| `packages/db/extension/build-extension.sh`        | Phase 2A build: decoder + ripdb + test driver, linked against `libduckdb.dylib`. |
| `packages/db/extension/build-loadable.sh`         | Phase 2B build: decoder + ripdb as a shared object + 534-byte metadata footer. |
| `packages/db/extension/scripts/duckdb-extension-config.cmake` | Drop-in for `misc/duckdb/extension/extension_config_local.cmake`. Enables the in-tree `autocomplete` extension so the stock CLI from our pinned DuckDB build can exercise TAB completion. Shipped from our tree because `misc/` is `.gitignored`. |

**HTTP client pivot — plan vs. reality.** The plan had us layer
`RipHttpClient` over DuckDB's `HTTPUtil`, relying on the httpfs extension
being autoloaded when the HTTP URL first showed up. That fails earlier than
we realized: `DatabaseManager::AttachDatabase` calls
`FileSystem::IsRemoteFile(info.path)` before the `(TYPE ripdb)` clause is
consulted, and that lookup consults `EXTENSION_FILE_PREFIXES`, which maps
`http://` → `httpfs`. The result is `ATTACH 'http://...' AS r (TYPE ripdb)`
throws a `MissingExtensionException` for httpfs *before* our catalog gets a
chance to run. Two concrete consequences:

1. We replaced `RipHttpClient` with a ~110-line BSD-sockets HTTP/1.1 client
   (localhost scope — no TLS, no redirects, no chunked encoding). That
   removes the httpfs runtime dependency entirely and, with it, the tail of
   Risk 11 this project would otherwise inherit.
2. We added a second accepted URL scheme, `rip://host[:port]`, which is not
   in `EXTENSION_FILE_PREFIXES` and therefore doesn't trigger the `IsRemoteFile`
   autoload. The plan's preferred `http://` form still works on any DuckDB
   build that has httpfs available, but the M1 smoke tests use `rip://`
   so the extension is testable on a clean DuckDB without pulling in OpenSSL /
   vcpkg / httpfs. A bare `host[:port]` (no scheme) is also accepted.

The long-term user experience (`ATTACH 'http://...' (TYPE ripdb)`) is still
feasible on any DuckDB binary with httpfs loaded; adding `rip://` to the
upstream `EXTENSION_FILE_PREFIXES` (or giving `TYPE <x>` dispatch priority
over URL-scheme autoload) is a two-line upstream PR and is noted as M4
polish. M1 smoke tests locking in `rip://` as the primary form is a
conscious scope narrowing, not a regression.

**Coverage demonstrated (Phase 2A — in-process driver):** `ATTACH ... AS rip
(TYPE ripdb)`, `DETACH rip`, `duckdb_tables()` sees the remote tables,
`SHOW TABLES FROM rip` lists them, `DESCRIBE rip.<t>` returns the real
columns, full-table and projected `SELECT` both work, cross-table JOIN
against two remote tables, `count(*)` / `sum()` aggregation, `WHERE col IS
NULL` with a real null column, and `INSERT` into `rip.<t>` correctly throws
with a "read-only" error. **14/14 passing**.

**Coverage demonstrated (Phase 2B — stock CLI):** `LOAD
'ripdb.duckdb_extension';` from the `duckdb -unsigned` CLI. `ATTACH`
succeeds. `count`, `sum`, joins, `DESCRIBE`, `SELECT … LIMIT` all work.
`sql_auto_complete('...')` returns the remote tables for
`rip.<prefix>` and `rip.main.<prefix>`, and the remote columns for
`rip.<table>.<prefix>`; columns also complete in `ORDER BY <prefix>`
position. The fourth form in the plan — `SELECT <partial> FROM
rip.<table>` — is a known DuckDB autocomplete limitation (it completes
keywords, not columns, in that position; the same is true for local
DuckDB tables), not a ripdb-specific miss.

**Invariants this commit now also locks in:**

1. The on-disk `.duckdb_extension` footer layout is the exact 534-byte
   (22 WASM prefix + 256 metadata + 256 signature) layout produced by
   `misc/duckdb/scripts/append_metadata.cmake`. `build-loadable.sh` mirrors
   it. Metadata values: `magic="4"`, `platform`/`duckdb_version`/
   `extension_version`/`abi_type=CPP`.
2. The extension accepts three URL forms — `http://host[:port]`,
   `rip://host[:port]`, and `host[:port]` — and rejects all other schemes
   with a clear `InvalidInputException`.
3. `RipCatalog` / `RipSchemaEntry` populate eagerly at attach time and
   return stable `CatalogEntry*` pointers for the life of the attach.
   DuckDB's binder, planner, and autocomplete rely on this.
4. Scan columns route through `out_cols[i]`: either a decoded-column index
   or the `ROWID_SLOT` sentinel. Synthetic rowids are sequential i64s
   starting at 0 per scan — stable within a scan, not across scans.
5. HTTP failures always throw `IOException`, remote error envelopes always
   throw with the server message preserved. No asserts, no null derefs.

**Deferred past Commit 2:**

- Predicate pushdown (`filter_pushdown = true` and a
  `table_function_pushdown_complex_filter_t`). M2.
- Chunked / streaming HTTP response. M2 (pull-iterator shape is already in
  place — see decoder.h's `NextChunk` design, though scan currently
  consumes the whole body).
- Parallel scan (`MaxThreads > 1`). M2.
- Write forwarding (INSERT/UPDATE/DELETE → remote SQL). M3.
- DDL forwarding + native DECIMAL + upstream URL-alias PR. M4.
- Memcpy fast paths in the decoder (still gated on the Commit 1 slow-path
  equivalence test, still worth measuring before implementing).

### Commit 3 — smoke-server / capture-live subprocess hardening  ✅ landed as `4f12e17`

**Scope:** `smoke-server.rip` and `capture-live.rip` only. No change to
the extension, the decoder, the wire protocol, or any catalog semantics.
Purely a robustness fix for the inner-loop test scripts so they never
leak rip-db processes regardless of how the parent is torn down.

**Motivation.** The Commit 2 `smoke-server.rip` spawned `rip ...`, and
`rip` is a thin Bun wrapper that runs `spawnSync('bun', ['--preload',
loader, db.rip, ...])`. Our `proc` handle was therefore the wrapper,
not the actual rip-db bun. Sending SIGTERM to `proc` killed the wrapper
but left the bun grandchild orphaned, and if a downstream pipe reader
had closed (`| tail -30` exiting after N lines), the orphaned
grandchild's forwarded output kept triggering EPIPE in a tight loop —
a normal `rip smoke-server.rip 2>&1 | tail -30` session consumed
~6 minutes of CPU before it was noticed.

**Root-cause fix.** Spawn with `detached: true` so the rip-db subtree
is in its own process group. All signaling goes through
`process.kill(-proc.pid, signal)` (negative pid = process group) so
the wrapper and the grandchild die together. `killGroup` swallows
`ESRCH` (Linux) and `EPERM` (macOS) — both mean "target is already
gone" during cleanup.

**Subprocess lifecycle, now explicit:**

- `cleanup()` is idempotent (`shuttingDown` flag), sends SIGTERM, then
  SIGKILL 500ms later if the child still hasn't exited.
- `exitCleanly()` is idempotent (`exiting` flag) and waits for the
  child's `'exit'` event — or a 3s safety timeout — before calling
  `process.exit`, so the parent never outlives its own subprocess.
- `proc.once 'exit'` is registered **before** signals are sent,
  eliminating a fast-child-death race that would otherwise block on
  the 3s timeout.
- Synchronous last-resort SIGKILL in `process.on 'exit'` catches
  uncaught throws and unhandled rejections (the one path `cleanup`'s
  async escalation can't reach, because the JS event loop is already
  done).
- `proc.on 'error'` handler surfaces spawn failures (missing `rip`
  binary, etc.) with a clear one-line message.
- `proc.on 'exit'` + `ready` flag: startup failure throws from the
  `/health` loop with the child's real exit code/signal rather than
  timing out; post-startup failure logs and exits with the child's
  code.
- Stream `'error'` handlers on both stdout and stderr: EPIPE triggers
  clean exit, non-EPIPE is logged and fatal (were silently swallowed
  before).

**Dropped code that didn't do what it claimed:**

- The synchronous `try/catch` around `process.stderr.write` (EPIPE on
  Node/Bun surfaces via the stream's `'error'` event, never as a
  synchronous throw — the try was dead code).
- The `process.on 'SIGPIPE'` handler (Node/Bun intercepts SIGPIPE and
  converts it into stream `'error'` events — the handler never fired).
- Unused `dirname` import in `smoke-server.rip`.
- `await new Promise (resolve) -> noop()` — replaced with
  `await new Promise ->`, which compiles to `new Promise(() => {})`
  and is unambiguously never-resolving without the extra noop.

**Peer-AI review** (round 1 + 2) caught two real bugs before landing:
the non-EPIPE stream errors were being silently swallowed, and the
`cleanup()`-before-`once('exit')` ordering had a race where a very
fast child exit would block us for the full 3s timeout. Both fixed.

**Coverage demonstrated:**

- 14/14 `extension_test` cases still pass against the hardened
  smoke-server.
- `capture-live` end-to-end runs to completion, writes both integration
  fixtures, and tears down with zero orphans. "rip-db: shutting down
  server" is visible in its output — proof SIGTERM reached the bun
  process, not just the wrapper.
- Head-pipe stress: `rip smoke-server.rip 2>&1 | head -3` × 5 rapid
  back-to-back invocations — zero surviving rip-db processes after
  the last one.
- Autocomplete (all 3 working forms + ORDER BY) re-verified against
  the same smoke-server: `rip.smok<TAB>` → `smoke_orders` /
  `smoke_people`; `rip.main.smok<TAB>` → same; `rip.smoke_people.fu<TAB>`
  → `full` / `full_name`; `ORDER BY am<TAB>` → `amount`. Form 3
  (`SELECT <partial> FROM rip.table`) returns 0 suggestions, same as
  for local tables — the known DuckDB autocomplete limitation is
  re-confirmed to be ripdb-independent.

**Invariants this commit locks in:**

1. `smoke-server.rip` and `capture-live.rip` never leak rip-db
   processes regardless of teardown path: SIGINT, SIGTERM, EPIPE on
   stdout/stderr, uncaught throw, unhandled rejection, or pipe-reader
   exit.
2. Both scripts fail fast — and with the real error — when rip-db
   dies during startup. No more 5-second "rip-db did not come up
   within 5s" when the truth is "rip-db exited with code 1 at 200ms".
3. The scripts are signal-compatible with `process.kill(-pid, sig)`
   group signaling from anywhere — including test harnesses that use
   `pkill -f smoke-server.rip` or equivalent.

**Not fixed here, by design:** the same subprocess-management pattern
is now duplicated across the two scripts. With only two callers,
inline duplication is still cheaper than an abstraction — extract
a shared `scripts/lib/spawnManaged.rip` helper once a third caller
shows up.

### Commit 4 — M2: pushdown / refresh / interrupt / URL / chunked / DECIMAL  ✅ landed across 6 commits

**Scope:** All six M2 candidates from the Full M1 scope / Deferred to
M2+ lists, plus the DECIMAL portion of Risk 12, across six commits on
`rip-duck`. See [Peer-AI round 7 decisions (pre-code)](#peer-ai-round-7-decisions-pre-code)
for the pre-implementation design discussion that shaped the work.

| M2 item | Status | Commit |
|---------|--------|--------|
| M2.1 — predicate pushdown | ✅ landed | `84bb022` |
| M2.2 — chunked HTTP response | ❌ reverted as half-feature (see Commit 5) | `5448d66` → revert |
| M2.3 — parallel scan | ⏸️ deferred with rationale | `5448d66` |
| M2.4 — `rip_refresh('catalog')` | ✅ landed | `1384e0d` |
| M2.5 — query interrupt | ❌ reverted as half-feature (see Commit 5) | `fd6c95c` → revert |
| M2.6 — URL normalization | ✅ landed | `e7d9ad8` |
| Risk 12 — DECIMAL native wire | ✅ landed (LIST deferred — see [§ Design sketch](#design-sketch--complex-types-deferred)) | `956b202` |

**Shipped artifacts (M2-only, on top of Commit 2):**

| File | M2 change |
|------|-----------|
| `packages/db/extension/ripdb.cpp` | +predicate pushdown (`TryTranslateExpression`, `RipPushdownFilter`, `FormatLiteralSQL`); +`rip_refresh` table function; +chunked transfer-encoding decoder (`DechunkHttpBody`); +interrupt-aware HTTP client with query-id + best-effort `/ddb/interrupt`; +URL normalization (`NormalizeUrl`); +DECIMAL path (`ParseDecimalWidthScale`, DECIMAL in `MapToWireType`, DECIMAL branch in `WriteCellToVector`, bind-vs-wire width/scale validator in `RipScanInitGlobal`). |
| `packages/db/extension/extension_test.cpp` | +M2-per-feature test cases (URL normalization, `rip_refresh` behavior, pushdown subset coverage, dechunker unit tests, DECIMAL round-trip + exact arithmetic + typeof checks). 14 → 59 cases. |
| `packages/db/extension/decoder.{h,cpp}` | +`TypeId::DECIMAL = 21`; +`decimal_width`/`decimal_scale` on `ColumnInfo`; type-record reader loops optional fields and accepts 102/103 for DECIMAL; +`decode_decimal` dispatcher; DECIMAL-aware golden rendering. |
| `packages/db/lib/duckdb-binary.rip` | +`parseDecimalWidthScale` / `decimalPhysicalBytes` / `serializeDecimalBytes` / `decimalToUnscaledBigInt` helpers; `mapDuckDBType` routes DECIMAL off the VARCHAR fallback; `serializeType` emits fields 102/103 only for DECIMAL. |
| `packages/db/lib/duckdb.mjs` | Embed `DECIMAL(W,S)` precision into `typeName` for DECIMAL columns (previously just `"DECIMAL"` — a silent precision loss across the FFI/serializer boundary). |

**M2.1 — predicate pushdown.** Partial pushdown via DuckDB's
`pushdown_complex_filter` callback. Filters we fully translate are
consumed from the caller's vector and emitted as a WHERE clause in
the remote SQL; filters we leave behind are applied locally by
DuckDB. Conservative safe subset (per peer-AI round 7):

- **Translate:** `= != < <= > >=` (operands swappable),
  `IS NULL`, `IS NOT NULL`, `AND` of any translatable children.
  Column types: TINYINT..BIGINT + unsigned variants, BOOLEAN,
  VARCHAR.
- **Skip:** OR (partial-OR is unsound; full-OR has NULL 3VL risk),
  column-vs-column, non-literal RHS, LIKE/regex (collation
  semantics not proven equivalent), FLOAT/DOUBLE/DATE/TIMESTAMP/
  DECIMAL (remote literal semantics not proven equivalent enough
  yet), implicit casts wrapping the column.
- **Literal formatting:** integers as decimal text; booleans as
  `TRUE/FALSE`; VARCHAR quote-doubled + single-quoted. Verified
  injection-safe via test with input `'O''Malley'`.
- **Column resolution:** `BoundColumnRefExpression::binding.column_index`
  is a LogicalGet projection index, not a table-column index; we map
  it via `LogicalGet::GetColumnIndex(binding).GetPrimaryIndex()`.
  Got this wrong initially (filters addressed wrong columns); the
  test matrix caught it immediately.

**M2.2 — chunked Transfer-Encoding.** RFC 7230 §4.1 dechunker in the
HTTP client. Chunk-ext accepted and ignored; trailers skipped; any
coding other than exactly `chunked` (e.g. `chunked + gzip`) is
rejected. The decoder is still one-shot — **true per-chunk streaming
is deferred to M3** gated on a `decoder.h` refactor. The value in
M2 is protocol compatibility: rip-db or any reverse proxy can emit
chunked responses without breaking ripdb. 11 unit tests cover
positive (single, multi, chunk-ext, empty, large, trailer-after-0,
mixed-case hex) and negative (non-hex size, overrun, missing CRLF,
truncated) cases.

**M2.3 — parallel scan: deliberately deferred.** `MaxThreads() = 1`
is the honest outcome for M2. Every candidate client-side
partitioning strategy has a specific blocker:

- **OFFSET/LIMIT:** requires deterministic ORDER BY, pathological
  cost on large offsets, correctness depends on snapshot semantics
  we don't formalize.
- **Key-range (`WHERE id >= lo AND id < hi`):** needs per-table PK
  metadata and monotonicity assumptions we don't surface.
- **Hash-partitioning:** every worker scans the full table and
  filters — net negative on a single remote DuckDB instance.
- **Server-assisted partitioning:** correct, but requires rip-db
  server work not in scope for this ripdb.cpp commit.

rip-db is also a single Bun event loop in front of one DuckDB
instance, so N-way HTTP fanout today would only overlap network
latency on localhost — marginal gain for the cost. The rationale
is documented inline on `RipScanGlobalState::MaxThreads()` so the
next reader sees what's blocking.

**M2.4 — `rip_refresh('catalog')`.** Table function that re-queries
`/tables` + `/schema/:t` for an attached ripdb catalog and
atomically swaps in a fresh `RipSchemaEntry`. Returns
`(catalog VARCHAR, tables_loaded BIGINT, tables_refused BIGINT)`.
Works via either `SELECT * FROM rip_refresh('rip')` or
`CALL rip_refresh('rip')`. Refactor: `PopulateMainSchema()` split
into `PopulateSchema(RipSchemaEntry&)` so both `Initialize()` and
`Refresh()` share the path, with explicit refuse/load counting.

Semantics: the swap invalidates `optional_ptr<CatalogEntry>`
handles from prior queries (which is the whole point of refresh —
schema may have changed). In-flight scans retain their
self-contained `RipScanBindData` and keep running against the old
schema; new queries rebind against the fresh one. Cooperative, not
transactional — if `Refresh()` throws, the old schema is untouched.

**M2.5 — query interrupt.** Client-side wiring:

- Per-scan random query id (`X-Rip-DB-Query-Id` header) generated
  in `RipScanInitGlobal` and threaded through to the HTTP call.
- Interrupt-aware recv loop: `SO_RCVTIMEO = 250ms` on the scan's
  socket; on each timeout we poll `ClientContext::IsInterrupted()`.
- On interrupt: best-effort POST `/ddb/interrupt` carrying the
  same query id (separate short-lived socket, 500ms send timeout,
  fire-and-forget), then throw `InterruptException`.
- Fast-path pre-check: if `IsInterrupted()` is already set, throw
  before connecting.

Server-side tracking is a stub for now (rip-db's `/ddb/interrupt`
returns an empty success envelope); when rip-db grows a real
registry keyed on `X-Rip-DB-Query-Id`, the client side will start
having teeth without further work here. Only the scan path is
interrupt-aware in M2; catalog-population calls (tiny responses)
still block — they happen at ATTACH/refresh time.

**M2.6 — URL normalization.** `NormalizeUrl` strips fragment (`#...`),
query string (`?...`), path component (first `/` after the scheme),
and any trailing slashes during ATTACH parsing. A URL like
`'http://localhost:4213/some/path/?debug=1&foo=bar#anchor////'`
is canonicalized to `'http://localhost:4213'`. Path-prefix support
(using the path component to prefix request paths) is a plausible
future extension but not needed today — rip-db's endpoints are
absolute.

**Coverage demonstrated:**

- **extension_test**: **53 / 53** passing. Covers every M2 shape
  (URL forms, pushdown subset per-operator and per-type, rip_refresh
  stats + semantics, dechunker unit tests).
- **Stock `duckdb -unsigned` CLI**: `LOAD` + `ATTACH` + `EXPLAIN`
  end-to-end verified; the EXPLAIN for
  `SELECT count(*) FROM rip.smoke_orders WHERE currency = 'EUR' AND person_id < 5`
  shows no local FILTER operator — both predicates are pushed, and
  the rip-db log confirms the remote query:
  ```
  SELECT "id" FROM "main"."smoke_orders"
    WHERE ("currency" = 'EUR') AND ("person_id" < 5)
  ```
- **SQL injection safety**: `currency = 'O''Malley'` round-trips
  as `WHERE ("currency" = 'O''Malley')` in the remote SQL — the
  single quote is correctly doubled.

**Risk 12 (DECIMAL portion) — native wire encoding.** DECIMAL
columns round-trip with exact precision end-to-end. Unscaled signed
integer on the wire at DuckDB's physical width (int16/32/64/128
based on precision class), new type-record fields 102 (width) and
103 (scale) only for DECIMAL typeId, catalog surfaces
`LogicalType::DECIMAL(w, s)` instead of VARCHAR. Bind-time-vs-wire
validation in `RipScanInitGlobal` throws a clear error (suggesting
`rip_refresh`) if the remote schema drifts between attach and scan.
FFI gap surfaced and fixed: `duckdb.mjs` previously returned just
`"DECIMAL"` for `col.typeName` (no precision), which would have
silently defaulted to DECIMAL(18,3) through the encoder; now it
embeds the full `DECIMAL(W,S)` string. `sum(price) = 2625.00` on
20 DECIMAL(10,2) rows is exact DECIMAL(38,2), not floating-point
drift. LIST (and STRUCT/MAP/ARRAY/UNION/ENUM) deferred to a
dedicated milestone — see [§ Design sketch](#design-sketch--complex-types-deferred).

**Invariants this commit locks in:**

1. Pushdown is conservative-by-default: the `TryTranslateExpression`
   switch returns false for anything it doesn't explicitly handle.
   Adding types or operators is an opt-in edit, not a silent
   opt-out — keeps the correctness story auditable.
2. Literal formatting is strictly type-gated; no `snprintf("%s", ...)`
   or string concatenation that could inject unescaped characters.
3. `rip_refresh` always returns one row of stats, even when
   tables_loaded == 0. Consumers can rely on the shape.
4. The chunked-transfer decoder rejects any coding combination other
   than `chunked` alone. No silent "maybe it's gzip, try that" path.
5. Every HTTP call that goes through the scan path is interrupt-
   pollable; the catalog-path HTTP calls are not yet (documented).
6. **FFI type-name contract.** The duckdb.mjs FFI wrapper's
   `col.typeName` must carry every precision/parameter the encoder
   needs to faithfully represent the type on the wire. DECIMAL
   embeds `(W,S)`; any future parameterized type (parameterized
   VARCHAR, DECIMAL variants, fixed-width ARRAY, ENUM with dict
   size) must augment `typeName` the same way rather than relying
   on a separate `col.*` field. The encoder's type-string parser
   is the single source of truth for parameter extraction.
7. **Catalog/wire type agreement.** For any type whose wire format
   carries metadata (DECIMAL today, more complex types tomorrow),
   the scan path must validate that the decoded wire-metadata
   matches the catalog's bind-time expectation. Silent divergence
   = silent data corruption. The DECIMAL width/scale check in
   `RipScanInitGlobal` is the template — a mismatch throws with
   a specific `rip_refresh`-to-reload suggestion.
8. **Wire-format extension policy.** New types add new
   type-record field ids (104+ will be the next recursion-aware
   fields for complex types). Existing type records stay
   byte-identical for backward compat; only the types that need
   the new fields carry them. Decoders reject unknown field ids
   for a given typeId explicitly rather than skipping with a
   length convention we haven't designed.

**Deferred past M2:**

- Streaming decode, including real HTTP chunked Transfer-Encoding
  support (M3; requires `decoder.h` pull-iterator refactor). The
  M2.2 dechunker that landed in `5448d66` was reverted as a
  half-feature (see Commit 5); any re-introduction should be part
  of the M3 streaming work so the chunked path has an actual
  trigger.
- Parallel scan (M3+; gated on rip-db partition support OR a
  work-stealing remote streaming decoder).
- Query interrupt (revisit alongside a server-side rip-db query
  registry). The M2.5 client-side wiring in `fd6c95c` was reverted
  as a half-feature (see Commit 5) — `/ddb/interrupt` is a stub
  server-side and the client wiring on its own delivered only
  half the contract.
- Write forwarding (M3+).
- Server-side query registry for real `/ddb/interrupt` tracking
  (server-side rip-db task, not ripdb.cpp).
- Predicate pushdown for timestamp/date/float/decimal/LIKE (each
  deferred with a specific semantic caveat; see the M2.1 "Skip"
  list for the rationale per type).
- Memcpy fast paths in the decoder (still the Commit-1 slow-path
  serves as oracle; worth measuring before implementing).
- Native wire encoding for LIST, STRUCT, MAP, ARRAY, UNION (shared
  architectural shape: recursive type encoding + variable-length
  per-row storage + nested null tracking + DuckDB complex-vector
  binding). Dedicated "complex types" milestone with full design
  sketch in [§ Design sketch — complex types](#design-sketch--complex-types-deferred);
  DECIMAL closure in `956b202` does not change their current
  VARCHAR-fallback behavior.
- Golden-fixture coverage for DECIMAL across the null-pattern
  matrix (extension_test already proves the code paths end-to-end;
  capture-fixtures.rip addition is a mechanical follow-up).

### Commit 5 — revert M2.2 (chunked TE) and M2.5 (query interrupt) as half-features  ✅ landed

**Scope:** Remove the M2.2 HTTP chunked Transfer-Encoding decoder
and the M2.5 client-side query-interrupt wiring from `ripdb.cpp`
and `extension_test.cpp`. Both reached M2 "landed" status but were
subsequently reclassified as half-features on re-review, based on
the criterion "does this code do something the user actually
observes in the current deployment?"

**Why each was reverted:**

- **M2.2 — chunked Transfer-Encoding.** rip-db never emits
  `Transfer-Encoding: chunked` — it always uses `Content-Length`.
  There's no reverse proxy in front of rip-db in the target
  deployment. The dechunker was exercised only by synthetic unit
  tests feeding hand-crafted byte strings; the live CLI → rip-db
  code path never triggered it. Dead code in production.
- **M2.5 — query interrupt.** The client side generated a query
  ID, set `SO_RCVTIMEO=250ms`, polled
  `context.IsInterrupted()` between reads, and on Ctrl-C fired a
  best-effort `POST /ddb/interrupt` with the query ID. The
  *server* side of `/ddb/interrupt` is still a stub that just
  returns an empty success envelope — no query registry, no
  lookup by `X-Rip-DB-Query-Id`, no actual cancellation. So
  Ctrl-C let the CLI return to its prompt quickly (client-side
  bail), but the remote query kept running to completion on
  rip-db, and its result was just discarded when it arrived on
  the closed socket. Half of the intended contract; the server
  half was always out of scope for ripdb.cpp anyway.

**Removed:**

- `DechunkHttpBody` helper + `DechunkForTest` hook in `ripdb.cpp`.
- 11 dechunker unit tests in `extension_test.cpp` (single chunk,
  two chunks, chunk-ext ignored, empty body, mixed-case hex,
  large chunk, trailer fields ignored, and 4 malformed-input
  rejection cases).
- `GenerateQueryId` helper and the `<random>` include.
- The `PostBinary(..., ClientContext *, string query_id)`
  overload and `SendInterrupt` method on `RipHttpClient`.
- Socket timeouts (`SO_RCVTIMEO`, `SO_SNDTIMEO`) and the
  `<sys/time.h>` include.
- Interrupt-aware recv loop (fast-path pre-check,
  `EAGAIN/EWOULDBLOCK` poll for `IsInterrupted()`).
- `query_id` field on `RipScanGlobalState`.
- Chunked-TE parsing branch in `DoRequest`; restored the explicit
  rejection of `Transfer-Encoding: chunked` that M1 originally
  had.

**Kept (unchanged):**

- All of M2.1 (predicate pushdown), M2.3 (parallel-scan
  deferral), M2.4 (`rip_refresh`), M2.6 (URL normalization), and
  Risk 12 DECIMAL closure.

**Test count:**

- Before revert: 59 / 59 extension_test cases.
- After revert: 48 / 48. All the same functional paths — only
  the 11 dechunker unit tests disappeared.
- Decoder golden-fixture tests: still 200 / 200 (not touched).

**Binary-size delta:**

- `ripdb.cpp`: ~1827 → ~1650 lines (~10% smaller).
- `extension_test` binary: ~992 KB → ~962 KB.
- `ripdb.duckdb_extension` loadable: ~263 KB → ~243 KB.

**If either feature is needed later:**

- **M2.2:** re-add if rip-db or a proxy in front of it starts
  emitting chunked. This is also worth doing as part of the M3
  streaming decoder refactor (real per-chunk streaming makes
  chunked TE valuable where today it was just protocol compat).
- **M2.5:** re-add alongside the server-side query registry work
  that makes `/ddb/interrupt` actually cancel queries. Without
  that server cooperation, the client-side wiring alone doesn't
  deliver the intended contract and is strictly maintenance cost.

**Lesson captured (also applies to future milestones):** a
feature earns its place in the codebase by doing something the
user can observe, not by having been tested in isolation. The
sunk-cost argument ("but we already wrote and tested it") doesn't
justify keeping code that has no live trigger path. When a
planned feature turns out to need server-side cooperation that
isn't in scope (M2.5), or depends on a wire-format condition
that doesn't occur in the target deployment (M2.2), it's better
to revert the half-delivery than to ship code that silently does
nothing.

---

## Design sketch — complex types (deferred)

Scope: LIST, STRUCT, MAP, ARRAY, UNION, and ENUM — the six remaining
types that fall back to VARCHAR stringification on the wire. This
section is a starting point for the dedicated "complex types"
milestone flagged throughout the doc (Risk 12, Commit 4 deferred
list, M2 status table). It is not implementation — it is the
design pass that implementation will begin from.

### Why these are architecturally different from DECIMAL

DECIMAL's closure (`956b202`) extended the existing decoder /
encoder / binding shape with minimal change:

- flat type record (one typeId + two scalar fields)
- fixed-width per-row value (int16 / int32 / int64 / int128)
- one validity bitmap per column
- `Cell` stays a flat tagged union
- `WriteCellToVector` gains one `case LogicalTypeId::DECIMAL`

The six complex types break all five assumptions simultaneously.
That's why they're a milestone rather than a follow-up.

**1. The type record becomes recursive.** A LIST's child type is
itself a type record. `LIST(LIST(INTEGER))` has nested records.
STRUCT has one child record per field, each with a field name.
MAP's internal representation is `LIST(STRUCT(key, value))` —
recursive in two places. The current grammar (flat typeId + optional
scalar fields) doesn't scale; the decoder needs a recursive entry
point.

**2. Per-row values are variable-length.** DECIMAL(10,2) is exactly
8 bytes per row, always. LIST rows can be 0, 3, or 1,000,000
elements. STRUCT rows are fixed-schema but the nested fields may
themselves be variable. The wire format needs either offsets+flat
(DuckDB-native) or per-row length prefixes (simpler but requires
double-copy on decode).

**3. Null tracking becomes two-level.** For a LIST column: one
bitmap per column for "is this row's list null" (distinct from
"empty list"), plus another bitmap in the child vector for
"is this specific element null". For STRUCT: row-level bitmap
(is this row's struct null — all fields simultaneously) plus
per-field child-vector bitmaps. Getting the two levels straight
is where silent data corruption sneaks in if the fixture matrix
doesn't cover both axes.

**4. The `Cell` struct isn't recursive.** Today's `Cell` is a
flat tagged union chosen for decoder predictability. Storing a
LIST value means one of:

  - **(A) Make `Cell` recursive** — add a `ListValue` variant with
    `vector<Cell>` inline. Simplest dispatch; increases every non-
    list Cell's footprint from ~32 to ~48 bytes (vector header).
  - **(B) Side-table per chunk** — keep `Cell` flat, store list
    values in a parallel `vector<vector<vector<Cell>>>` on the
    `Chunk` struct. Zero cost for flat cells; renderer dispatch
    gets more complex.
  - **(C) Separate `DecodedList` type** with its own lifecycle.
    Extra bookkeeping throughout renderers and writers.

  Pick during the design pass. (A) is simplest; (B) is more
  efficient; (C) is most explicit. All are defensible.

**5. DuckDB vector APIs are per-type.** For DECIMAL we used
`FlatVector::GetDataMutable<T>(vec)[row_idx] = value`. That does
not apply to LIST:

```cpp
auto child_base = ListVector::GetListSize(vec);
ListVector::Reserve(vec, child_base + row_element_count);
auto &child_vec = ListVector::GetEntry(vec);
for (idx_t i = 0; i < row_element_count; ++i) {
    WriteCellToVector(child_vec, child_base + i, row_elements[i]);
}
ListVector::SetListSize(vec, child_base + row_element_count);
FlatVector::GetData<list_entry_t>(vec)[row_idx] =
    list_entry_t { child_base, row_element_count };
```

STRUCT uses `StructVector::GetEntries` to iterate child flat
vectors. MAP is STRUCT-of-LIST on the physical layer. ENUM has a
dictionary inline in the logical type. Each complex type is its
own write-path subproject — the common framework ends where
DuckDB's vector-type switch begins.

### Wire format proposal (sketch — finalize during milestone design)

Extend the type record to a proper recursive grammar. DECIMAL's
fields 102/103 stay, and the grammar generalizes to new field ids:

```
type record:
  field 100 (u8):      typeId
  field 101 (u8):      legacy "extra" = 0
  field 102:           scalar metadata #1 (DECIMAL width, ENUM dict size, ...)
  field 103:           scalar metadata #2 (DECIMAL scale, ...)
  field 104:           nested type record       ← NEW  (LIST/ARRAY child type)
  field 105:           list of nested records   ← NEW  (STRUCT fields, MAP key+value)
  field 106:           list of strings          ← NEW  (STRUCT field names, ENUM dict entries)
  end 0xFFFF
```

Decoder recurses when it sees field 104 or 105 (calls the
type-record parser on the nested bytes). Wire payloads:

- **LIST**: offsets (u32 per row, end-pointer convention) then
  child vector payload (itself a recursive decode_vector call).
- **ARRAY**: same as LIST but with a fixed declared length; the
  offsets array can be elided (derived from `row_idx * array_len`).
- **STRUCT**: N child vector payloads sequentially; each has its
  own validity bitmap per DuckDB's convention.
- **MAP**: represented as STRUCT-of-LIST on the wire, matching
  DuckDB's internal shape.
- **ENUM**: u8/u16/u32 index into the dictionary stored in field 106.
- **UNION**: tag byte per row + per-tag child vectors. Needs its own
  sub-design; consider deferring to after the other five.

### Suggested implementation order

1. **ENUM**. No recursion; dictionary comes over as a list of
   strings in field 106. Proves the "new fields for complex metadata"
   extension pattern without the recursion complexity. ~half a day.
2. **LIST-of-primitives** (no nesting, no structs inside). Forces
   variable-length payloads, two-level nulls, and the DuckDB
   `ListVector` write path. The big architectural commit. ~1 day
   plus peer-AI design review.
3. **Nested LIST** (LIST of LIST). Adds type-record recursion to
   the decoder and encoder. Small once step 2 is solid.
4. **STRUCT**. Second major write-path subproject; much of the
   type-record recursion from step 3 reused. ~half to full day.
5. **MAP**. Built on STRUCT-of-LIST. Mostly metadata/name
   conventions. ~half day.
6. **ARRAY**. Fixed-size variant of LIST. Small once LIST is done.
7. **UNION**. Discriminated tagged type; separate design pass
   before implementing.

### Test strategy

Per type, the existing null-pattern matrix (all_valid, all_null,
alternating, every_64th, partial_word, bursty) multiplied across:

- **Row-level null patterns** — is the LIST / STRUCT value itself
  null?
- **Element-level null patterns** — within non-null containers,
  which elements are null?
- **Empty-container edge cases** — empty list vs null list;
  struct with all fields null vs struct itself null (NOT the same).
- **Child type coverage** — at minimum INT, VARCHAR, DOUBLE as
  leaf types; recursion tested via LIST(LIST(INT)) and
  STRUCT(LIST(VARCHAR), INT).

The null-pattern matrix becomes a product space. A realistic
decoder-level fixture count for LIST alone is 6 patterns × 3 child
types × 4 combinatorial shapes (row-null/empty/one-child-null/
all-children-null) = ~72 fixtures. Plus per-type for STRUCT / MAP /
ARRAY / ENUM / UNION. Capture via `capture-fixtures.rip` extensions,
one generator function per shape.

### What unblocks this milestone

Either:

1. **Dedicated design session** with peer-AI review choosing
   between Cell-recursive vs side-table, nailing down the
   wire-format grammar (final field ids, STRUCT field-name
   encoding, UNION tag layout), and validating the DuckDB vector
   write paths against pinned headers.
2. **Concrete user demand** for a LIST-heavy or STRUCT-heavy
   workload against rip-db — the kind of pressure that picks
   between LIST-only scoped vs full-complex-types ambitious.

Without one of those, staying on VARCHAR-stringification fallback
is the honest outcome. The current behavior (columns of complex
type arrive as text to the client, labeled VARCHAR in the catalog,
round-trip preserved via `CAST`) is functional for exploration
workloads. M2's DECIMAL closure covers the common business /
transaction case that motivated Risk 12.

### Non-goals (for this milestone when it happens)

- **Predicate pushdown for complex-type filters.** Even when we
  expose LIST natively, filters like `'foo' IN list_col` or
  `struct_col.x > 5` are their own safe-subset extension to M2.1
  and don't need to land together.
- **Complex-type arithmetic on the wire.** DuckDB's scalar
  functions on LISTs (e.g. `list_length`, `list_concat`) execute
  locally on the client. The scan just delivers values; the
  planner handles operators.
- **Server-side DDL for creating complex-typed tables.** Write
  forwarding is a separate milestone (M3+).
