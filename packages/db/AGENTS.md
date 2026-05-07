# AI Agent Guide for @rip-lang/db

## Architecture

| File | Role |
|------|------|
| `db.rip` | HTTP server — routes (`/sql`, `/ddb/run` reads, `/ddb/exec` DML), middleware, UI proxy |
| `lib/duckdb.mjs` | FFI driver — chunk-based API, Appender, batch prepared, `duckdb_rows_changed` for DML affected counts |
| `lib/duckdb-shim.c` | C shim for Linux (struct-by-value workaround) |
| `lib/duckdb-binary.rip` | Binary serializer — DuckDB UI protocol |
| `client.rip` | HTTP client — Model factory, query builder |
| `extension/ripdb.cpp` | DuckDB storage extension — read path (catalog, scan with projection + complex-filter pushdown) and write path (M3 native INSERT/UPDATE/DELETE via source-AST passthrough + INSERT sink fallback) |

## DML write path (M3 — native INSERT/UPDATE/DELETE)

The `ripdb` extension implements `Catalog::PlanInsert/PlanUpdate/PlanDelete`
with a two-path strategy. The path choice happens at plan time, before any
remote round trip:

- **Path 1 — source-AST passthrough.** Fetch the original SQL from
  `ClientContext::GetCurrentQuery()`, reparse it with `Parser`, require
  exactly one statement, walk the bound `LogicalOperator` (with
  `ExpressionIterator` to descend into bound subquery expressions) to
  confirm every catalog reference is `ripdb_scan`-backed, structurally
  rewrite the parsed AST to drop our local catalog qualifier from
  `BaseTableRef.{catalog_name,schema_name}` (the parser collapses a
  2-part `r.t` into the schema slot, not the catalog slot — both must
  be rewritten), serialize back to SQL, POST to `/ddb/exec`. Returns a
  1-row int64 `affected_rows` chunk so the CLI prints "N rows affected".
- **Path 2 — INSERT-only sink fallback.** When Path 1 rejects an INSERT
  (typically because the source plan touches local data),
  `PhysicalRipInsertSink` runs as a standard DuckDB sink+source operator:
  `Sink()` accumulates child chunks under bounded row+byte caps,
  `Finalize()` emits one multi-row `INSERT INTO main."t" VALUES (…), …`
  with typed SQL literals (built by `FormatLiteralForDML` against the
  target column type, not the runtime Value type) and POSTs it as one
  atomic `/ddb/exec` request.

UPDATE and DELETE have no fallback — Path 1 failure throws
`NotImplementedException` with workaround guidance.

Identification of "is this a ripdb LogicalGet?" is by `function.name ==
"ripdb_scan"`, not by `LogicalGet::GetTable()`. Reason: the default
`Catalog::Plan{Update,Delete,Insert}` recursively physical-plans
`op.children[0]` BEFORE invoking our override, which moves the
`bind_data` out of the LogicalGet into the PhysicalTableScan and leaves
`GetTable()` returning nullptr. The function name field is copied (not
moved) and survives.

The full type-emission table for `FormatLiteralForDML` and the explicit
reject list (`RETURNING`, `ON CONFLICT`, multi-statement, prepared
parameters, `BEGIN`-wrapped DML, `UPDATE…FROM`, `rowid` references,
native nested-type INSERT) live in `CLI.md`.

The server side adds `POST /ddb/exec` returning
`{ok, kind, statement_type, affected_rows}` JSON where `affected_rows`
is a **decimal string** (avoids JS-number precision loss above 2^53).
The matching FFI binding is `duckdb_rows_changed(duckdb_result*)` in
`lib/duckdb.mjs` declared as `'u64' -> 'u64'` per the Bun-on-Linux
"Bug 1" workaround below.

## Bun FFI on Linux x64 — Critical Notes

Two bugs in Bun's FFI layer cause segfaults when using DuckDB on Linux x64.
Both are worked around in `duckdb.mjs`. **Do not revert these patterns.**

### Bug 1: Number-as-`'ptr'` argument corruption

Bun corrupts plain JavaScript numbers when marshaling them to C pointer
arguments declared as `'ptr'`. The segfault address is typically
`0xFFFFFFFFFFFFFFFF` (the number gets sign-extended or sentinel-replaced).

**Fix:** All opaque DuckDB handles (database, connection, prepared statement,
data chunk, vector, logical type, appender) are declared as `'u64'` arguments
and stored as BigInt. Buffer pointers using `ptr(buf)` remain `'ptr'`.

```js
// WRONG — crashes on Linux x64
duckdb_connect: { args: ['ptr', 'ptr'], returns: 'i32' },
lib.duckdb_connect(dbHandle, ptr(connBuf))  // dbHandle is a Number

// CORRECT — works on all platforms
duckdb_connect: { args: ['u64', 'ptr'], returns: 'i32' },
lib.duckdb_connect(dbHandle, ptr(connBuf))  // dbHandle is a BigInt
```

### Bug 2: Struct-by-value passing is impossible

`duckdb_fetch_chunk(duckdb_result result)` takes a 48-byte struct by value.
On Linux x64 (SysV AMD64 ABI), this struct is classified as MEMORY and passed
on the stack. Bun FFI has no mechanism to pass structs by value — passing
`ptr(buf)` puts a pointer in a register where the callee expects 48 bytes on
the stack.

On macOS ARM64, large structs are passed by hidden pointer, so `ptr(buf)` as
`'ptr'` happens to work. On Linux x64, it segfaults at `0x0`.

**Fix:** A C shim (`lib/duckdb-shim.c`) wraps the by-value functions:

```c
duckdb_data_chunk shim_fetch_chunk(duckdb_result *result) {
    return duckdb_fetch_chunk(*result);
}
```

The shim is loaded at startup. If not found, the driver falls back to a direct
call (works on macOS ARM64 only).

### Handle lifecycle

All handles flow as BigInt through the system:

```
duckdb_open(null, ptr(buf))  →  readHandle(buf) returns BigInt
                                      ↓
duckdb_connect(BigInt, ptr(buf))  →  readHandle(buf) returns BigInt
                                           ↓
duckdb_query(BigInt, ptr(sql), ptr(resultBuf))
                                           ↓
fetchChunk(ptr(resultBuf))  →  returns BigInt (chunk handle)
                                      ↓
duckdb_data_chunk_get_vector(BigInt, BigInt)  →  returns BigInt
                                                      ↓
duckdb_vector_get_data(BigInt)  →  Number() for ffiRead
```

Data pointers (from `duckdb_vector_get_data`) are converted to Number via
`Number(bigint)` before being passed to `ffiRead.i32()`, `ffiRead.u8()`, etc.,
because Bun's `ffiRead` functions expect Number addresses.

### Building the shim

```bash
gcc -shared -fPIC -o libduckdb-shim.so duckdb-shim.c -lduckdb
```

Place next to `libduckdb.so`, or set `DUCKDB_SHIM_PATH`.

## FFI Declaration Rules

When adding new DuckDB C API bindings:

| C parameter type | FFI arg type | JS value |
|-----------------|-------------|----------|
| Opaque handle by value (`duckdb_connection`, `duckdb_data_chunk`, etc.) | `'u64'` | BigInt |
| Pointer to buffer/struct (`duckdb_result *`, `duckdb_connection *`) | `'ptr'` | `ptr(buf)` |
| C string (`const char *`) | `'ptr'` | `ptr(toCString(s))` |
| `null` pointer | `'ptr'` | `null` |
| Scalar (`int32_t`, `bool`, `double`) | `'i32'`/`'bool'`/`'f64'` | Number/Boolean |
| `idx_t` / `uint64_t` | `'u64'` | BigInt |

For return types:
- Opaque handles → `'u64'` (returns BigInt)
- String pointers (used with CString) → `'ptr'` (returns Number)
- Data pointers (used with ffiRead) → `'u64'`, then `Number()` at call site

## Testing

```bash
# FFI tests (requires DuckDB installed)
cd packages/db && bun test --preload ../../rip-loader.js test/

# Full project tests
bun run test
```

## Common Tasks

### Add a new DuckDB C API function

1. Add the declaration to the `dlopen` block in `duckdb.mjs`
2. Follow the FFI declaration rules above
3. If the function takes `duckdb_result` by value, add a shim wrapper
4. Run `bun test --preload ../../rip-loader.js test/duckdb-ffi.test.mjs`

### Working on the ripdb DML write path

1. Edit `extension/ripdb.cpp` (the helpers, physical operators, and
   `RipCatalog::Plan{Insert,Update,Delete}` are all in the
   "DML dispatch implementation" section).
2. Rebuild the loadable extension from repo root: `make release`.
   Output lands at `packages/db/build/release/repository/v1.5.2/<platform>/ripdb.duckdb_extension`.
3. Smoke test against a live rip-db using the just-built duckdb CLI:
   ```bash
   rip packages/db/extension/scripts/smoke-server.rip      # in another terminal
   packages/db/build/release/duckdb -unsigned -c "
     LOAD '$PWD/packages/db/build/release/repository/v1.5.2/osx_arm64/ripdb.duckdb_extension';
     ATTACH 'rip://localhost:4214' AS r (TYPE ripdb);
     INSERT INTO r.smoke_orders VALUES (9999, 1, 'X', 'USD', 0.0, 0.00);
     UPDATE r.smoke_orders SET sku = 'Y' WHERE id = 9999;
     DELETE FROM r.smoke_orders WHERE id = 9999;
     SELECT count(*) FROM r.smoke_orders;
   "
   ```
4. There's also a fast in-process driver at `extension/build-extension.sh`
   that compiles `decoder.cpp + ripdb.cpp + extension_test.cpp` and runs
   a 79-case smoke suite directly against a live rip-db (no .duckdb_extension
   loading, no metadata footer). It defaults to building against the
   in-tree pinned `packages/db/duckdb` submodule and `packages/db/build/release`
   dylib, NOT against `misc/duckdb`. Reason: the looser `misc/duckdb`
   prebuilt dylib drifts out of sync with the system toolchain — older
   builds emit a different libc++ container layout than recent XCode
   versions expect, which crashes the in-process driver inside
   `ColumnList::AddColumn` with `std::length_error: vector` during
   ATTACH. The stale dylib is the only cause; the extension code is
   unaffected, and the loadable `.duckdb_extension` built via
   `make release` works either way. Override with
   `DUCKDB_SRC=... DUCKDB_BUILD=...` if you need to test against an
   alternate checkout.
