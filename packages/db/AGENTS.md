# AI Agent Guide for @rip-lang/db

## Architecture

| File | Role |
|------|------|
| `db.rip` | HTTP server — routes, middleware, UI proxy |
| `lib/duckdb.mjs` | FFI driver — chunk-based API, Appender, batch prepared |
| `lib/duckdb-shim.c` | C shim for Linux (struct-by-value workaround) |
| `lib/duckdb-binary.rip` | Binary serializer — DuckDB UI protocol |
| `client.rip` | HTTP client — Model factory, query builder |

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
