# `ripdb` — Native DuckDB CLI integration for rip-db

> **Document status:** Implementation plan, reviewed by peer AI (GPT-5.4) over three rounds on the `rip-duck-design` conversation. Pinned to DuckDB source at commit **`f9d17f0eb7a6f90586dbf08910910f766eb1b29c`** (`misc/duckdb/`). All interface signatures, wire-layout details, and API names below are **pseudocode until verified against this exact checkout during implementation**. Treat concrete C++ shown below as a structural sketch; exact member names, parameter types, and header locations must be cross-checked at compile time because DuckDB's internal catalog/storage/http APIs drift across versions. Where a claim is load-bearing (e.g. binary layout matches for `memcpy`), the plan calls out verification gates before relying on it.

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

| Type             | Bytes/row | Encoding                                              | Fast-path? |
|------------------|-----------|-------------------------------------------------------|------------|
| BOOLEAN          | 1         | 0 or 1                                                | Tier 1     |
| TINYINT / UTINYINT | 1       | i8 / u8                                               | Tier 1     |
| SMALLINT / USMALLINT | 2     | LE i16 / u16                                          | Tier 1     |
| INTEGER / UINTEGER | 4       | LE i32 / u32                                          | Tier 1     |
| BIGINT / UBIGINT | 8         | LE i64 / u64                                          | Tier 1     |
| FLOAT            | 4         | LE IEEE 754 binary32                                  | Tier 1     |
| DOUBLE           | 8         | LE IEEE 754 binary64                                  | Tier 1     |
| DATE             | 4         | LE i32 days since Unix epoch                          | Tier 1     |
| TIMESTAMP / TIMESTAMP_TZ | 8 | LE i64 microseconds since epoch                       | Tier 1     |
| TIMESTAMP_SEC    | 8         | LE i64 seconds                                        | Tier 1     |
| TIMESTAMP_MS     | 8         | LE i64 milliseconds                                   | Tier 1     |
| TIMESTAMP_NS     | 8         | LE i64 nanoseconds                                    | Tier 1     |
| TIME             | 8         | LE i64 microseconds-of-day                            | Tier 1     |
| TIME_NS          | 8         | LE i64 nanoseconds-of-day                             | Tier 1     |
| VARCHAR / CHAR   | variable  | varint length + UTF-8 bytes (per row)                 | —          |
| HUGEINT / UHUGEINT | 16      | LE lo + LE hi (128-bit)                               | **Tier 2** — verify physical layout |
| INTERVAL         | 16        | LE i32 months, LE i32 days, LE i64 micros             | **Tier 2** — verify physical layout |
| TIME_TZ          | 8         | LE u64 packed: micros<<24 \| (offset_sec+86399)       | **Tier 2** — verify packing |
| UUID             | 16        | LE u64 lo + LE i64 hi (hi has sign-bit XOR)           | **Tier 2** — verify physical layout |

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
DECIMAL, ENUM, LIST, STRUCT, MAP, UNION, ARRAY, BLOB, BIT, JSON, VARIANT, GEOMETRY
```

When a remote table has one of these types, `/ddb/run` returns wire-VARCHAR bytes. **The catalog must reflect this**: `/schema/:t` currently reports the *real* logical type (via `DESCRIBE`), but the wire delivers VARCHAR. We handle this extension-side by applying the same fallback table in our catalog population:

```cpp
LogicalType MapToWireType(const string &server_reported_type) {
    // Mirror mapDuckDBType from duckdb-binary.rip
    // Fixed types: return them as-is
    // DECIMAL/ENUM/LIST/STRUCT/MAP/UNION/ARRAY/BLOB/BIT/JSON → return VARCHAR
    // ...
}
```

Users who want native support for those types will need both sides upgraded; for M1, unsupported types appear as VARCHAR text to the client, which is honest and functional.

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

Scope:
- `ATTACH 'http://...' AS r (TYPE ripdb)` works on stock `duckdb -unsigned`
- URL normalization handled: trailing slash, optional path, query params stripped
- `RipCatalog` with one `main` schema
- Eager catalog load at attach time
- `SHOW TABLES FROM r`, `DESCRIBE r.orders` work
- `SELECT` with joins, CTEs, window functions, aggregations — all work
- **Completion works natively** in stock CLI (tables + columns), verified for `rip.<TAB>`, `rip.main.<TAB>`, `<col><TAB> FROM rip.table`, `rip.table.<TAB>`
- Projection pushdown only (no predicate pushdown)
- Single-threaded scan (`MaxThreads() = 1`)
- **Multi-chunk decode supported** — not assumed single-chunk
- **Flat-vector format asserted** before `memcpy`; fallback to per-row write if asserting fails
- 26 types with native wire encoding (4 Tier-2 types gated on golden-test verification); 11 stringified with documented caveats; BLOB errors at catalog population
- `GetStatistics` returns `nullptr` (no stats)
- Writes + DDL throw `PermissionException("ripdb: read-only v1")`
- Whole-HTTP-body buffering on response (not streaming)
- Error mapping: rip-db `{error: "..."}` JSON → thrown `CatalogException`/`IOException`/`BinderException` with the remote message preserved
- Query interrupt: documented as unsupported for M1 (local Ctrl-C cancels the DuckDB query but not the remote one; rip-db's `/ddb/interrupt` wiring deferred)
- Golden test: type round-trip for all 26 native types (with extra attention to the 4 Tier-2 types) including 50%-NULL columns
- Smoke test: spin up rip-db against a seeded `medlabs` DB, attach, run 10 queries, compare results

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
