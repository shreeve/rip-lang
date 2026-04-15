/**
 * DuckDB Pure Bun FFI Wrapper
 *
 * Direct FFI bindings to DuckDB's C API using the modern chunk-based API.
 * No deprecated per-value functions. No Zig, no npm package.
 *
 * Usage:
 *   import { open } from './duckdb.mjs';
 *
 *   const db = open(':memory:');
 *   const conn = db.connect();
 *   const rows = await conn.query('SELECT 42 as num');
 *   conn.close();
 *   db.close();
 */

import { dlopen, ptr, CString, read as ffiRead } from 'bun:ffi';
import { platform } from 'process';
import { existsSync, realpathSync } from 'fs';

// ==============================================================================
// Find DuckDB Library
// ==============================================================================

function findDuckDBLibrary() {
  const candidates = [];

  if (platform === 'darwin') {
    candidates.push(
      '/opt/homebrew/lib/libduckdb.dylib',
      '/usr/local/lib/libduckdb.dylib',
      '/usr/lib/libduckdb.dylib',
    );
  } else if (platform === 'linux') {
    candidates.push(
      '/usr/lib/libduckdb.so',
      '/usr/local/lib/libduckdb.so',
      '/usr/lib/x86_64-linux-gnu/libduckdb.so',
      '/usr/lib/aarch64-linux-gnu/libduckdb.so',
    );
  } else if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\DuckDB\\duckdb.dll',
      'duckdb.dll',
    );
  }

  if (process.env.DUCKDB_LIB_PATH) {
    candidates.unshift(process.env.DUCKDB_LIB_PATH);
  }

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  throw new Error(
    `Could not find DuckDB library. Tried:\n${candidates.join('\n')}\n\n` +
    `Install DuckDB or set DUCKDB_LIB_PATH environment variable.`
  );
}

const libPath = findDuckDBLibrary();

// ==============================================================================
// Load DuckDB C API
// ==============================================================================
//
// Bun FFI on Linux x64 has two bugs:
//   1. Passing a JS number as a 'ptr' argument corrupts the value — use 'u64' + BigInt
//   2. Cannot pass structs by value (e.g. 48-byte duckdb_result) — needs C shim
//
// All opaque handles (database, connection, stmt, chunk, vector, logical_type)
// are declared as 'u64' args and stored as BigInt. Buffer pointers (where we pass
// ptr(buf)) remain 'ptr'. String-returning functions remain 'ptr' returns.
//

const lib = dlopen(libPath, {
  // Database lifecycle
  duckdb_open:    { args: ['ptr', 'ptr'], returns: 'i32' },
  duckdb_close:   { args: ['ptr'], returns: 'void' },

  // Connection lifecycle
  duckdb_connect:    { args: ['u64', 'ptr'], returns: 'i32' },
  duckdb_disconnect: { args: ['ptr'], returns: 'void' },

  // Query execution
  duckdb_query:          { args: ['u64', 'ptr', 'ptr'], returns: 'i32' },
  duckdb_destroy_result: { args: ['ptr'], returns: 'void' },

  // Prepared statements
  duckdb_prepare:          { args: ['u64', 'ptr', 'ptr'], returns: 'i32' },
  duckdb_prepare_error:    { args: ['u64'], returns: 'ptr' },
  duckdb_destroy_prepare:  { args: ['ptr'], returns: 'void' },
  duckdb_bind_null:        { args: ['u64', 'u64'], returns: 'i32' },
  duckdb_bind_boolean:     { args: ['u64', 'u64', 'bool'], returns: 'i32' },
  duckdb_bind_int32:       { args: ['u64', 'u64', 'i32'], returns: 'i32' },
  duckdb_bind_int64:       { args: ['u64', 'u64', 'i64'], returns: 'i32' },
  duckdb_bind_double:      { args: ['u64', 'u64', 'f64'], returns: 'i32' },
  duckdb_bind_varchar:     { args: ['u64', 'u64', 'ptr'], returns: 'i32' },
  duckdb_execute_prepared: { args: ['u64', 'ptr'], returns: 'i32' },
  duckdb_clear_bindings:   { args: ['u64'], returns: 'i32' },

  // Appender API
  duckdb_appender_create:        { args: ['u64', 'ptr', 'ptr', 'ptr'], returns: 'i32' },
  duckdb_appender_error:         { args: ['u64'], returns: 'ptr' },
  duckdb_appender_flush:         { args: ['u64'], returns: 'i32' },
  duckdb_appender_close:         { args: ['u64'], returns: 'i32' },
  duckdb_appender_destroy:       { args: ['ptr'], returns: 'i32' },
  duckdb_appender_end_row:       { args: ['u64'], returns: 'i32' },
  duckdb_append_bool:            { args: ['u64', 'bool'], returns: 'i32' },
  duckdb_append_int32:           { args: ['u64', 'i32'], returns: 'i32' },
  duckdb_append_int64:           { args: ['u64', 'i64'], returns: 'i32' },
  duckdb_append_double:          { args: ['u64', 'f64'], returns: 'i32' },
  duckdb_append_varchar:         { args: ['u64', 'ptr'], returns: 'i32' },
  duckdb_append_null:            { args: ['u64'], returns: 'i32' },
  duckdb_appender_add_column:    { args: ['u64', 'ptr'], returns: 'i32' },
  duckdb_appender_clear_columns: { args: ['u64'], returns: 'i32' },

  // Result inspection (result is always ptr(buf), not a handle)
  duckdb_column_count:  { args: ['ptr'], returns: 'u64' },
  duckdb_column_name:   { args: ['ptr', 'u64'], returns: 'ptr' },
  duckdb_column_type:   { args: ['ptr', 'u64'], returns: 'i32' },
  duckdb_result_error:  { args: ['ptr'], returns: 'ptr' },

  // Chunk-based API (handles as u64)
  duckdb_data_chunk_get_size:     { args: ['u64'], returns: 'u64' },
  duckdb_data_chunk_get_vector:   { args: ['u64', 'u64'], returns: 'u64' },
  duckdb_vector_get_data:         { args: ['u64'], returns: 'u64' },
  duckdb_vector_get_validity:     { args: ['u64'], returns: 'u64' },
  duckdb_destroy_data_chunk:      { args: ['ptr'], returns: 'void' },

  // Logical type introspection (handles as u64)
  duckdb_column_logical_type:     { args: ['ptr', 'u64'], returns: 'u64' },
  duckdb_destroy_logical_type:    { args: ['ptr'], returns: 'void' },
  duckdb_get_type_id:             { args: ['u64'], returns: 'i32' },
  duckdb_decimal_width:           { args: ['u64'], returns: 'u8' },
  duckdb_decimal_scale:           { args: ['u64'], returns: 'u8' },
  duckdb_decimal_internal_type:   { args: ['u64'], returns: 'i32' },
  duckdb_enum_internal_type:      { args: ['u64'], returns: 'i32' },
  duckdb_enum_dictionary_size:    { args: ['u64'], returns: 'u32' },
  duckdb_enum_dictionary_value:   { args: ['u64', 'u64'], returns: 'ptr' },

  // Nested type vector access (handles as u64)
  duckdb_list_vector_get_child:   { args: ['u64'], returns: 'u64' },
  duckdb_list_vector_get_size:    { args: ['u64'], returns: 'u64' },
  duckdb_struct_vector_get_child: { args: ['u64', 'u64'], returns: 'u64' },
  duckdb_struct_type_child_count: { args: ['u64'], returns: 'u64' },
  duckdb_struct_type_child_name:  { args: ['u64', 'u64'], returns: 'ptr' },
  duckdb_struct_type_child_type:  { args: ['u64', 'u64'], returns: 'u64' },
  duckdb_list_type_child_type:    { args: ['u64'], returns: 'u64' },
  duckdb_array_vector_get_child:  { args: ['u64'], returns: 'u64' },
  duckdb_array_type_child_type:   { args: ['u64'], returns: 'u64' },
  duckdb_array_type_array_size:   { args: ['u64'], returns: 'u64' },

  // Memory
  duckdb_free: { args: ['u64'], returns: 'void' },

  // Library info
  duckdb_library_version: { args: [], returns: 'ptr' },
}).symbols;

// Load shim for duckdb_fetch_chunk (takes duckdb_result by value — 48-byte struct
// that Bun FFI cannot marshal). The shim accepts duckdb_result* instead.
function findShimLibrary() {
  const realLibPath = realpathSync(libPath);
  const dir = realLibPath.replace(/\/[^/]+$/, '');
  const symDir = libPath.replace(/\/[^/]+$/, '');
  const ext = platform === 'darwin' ? 'dylib' : 'so';
  const candidates = [
    `${dir}/libduckdb-shim.${ext}`,
    `${symDir}/libduckdb-shim.${ext}`,
    new URL('./libduckdb-shim.' + ext, import.meta.url).pathname,
  ];
  if (process.env.DUCKDB_SHIM_PATH) candidates.unshift(process.env.DUCKDB_SHIM_PATH);
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const shimPath = findShimLibrary();
const shim = shimPath ? dlopen(shimPath, {
  shim_fetch_chunk: { args: ['ptr'], returns: 'u64' },
}).symbols : null;

// Fetch chunk: use shim (pointer-based) or fall back to direct call (macOS ARM64)
const fetchChunk = shim
  ? (rp) => shim.shim_fetch_chunk(rp)
  : (() => {
      const fn = dlopen(libPath, {
        duckdb_fetch_chunk: { args: ['ptr'], returns: 'u64' },
      }).symbols.duckdb_fetch_chunk;
      return (rp) => fn(rp);
    })();

// ==============================================================================
// DuckDB Type Constants
// ==============================================================================

const DUCKDB_TYPE = {
  INVALID: 0,
  BOOLEAN: 1,
  TINYINT: 2,
  SMALLINT: 3,
  INTEGER: 4,
  BIGINT: 5,
  UTINYINT: 6,
  USMALLINT: 7,
  UINTEGER: 8,
  UBIGINT: 9,
  FLOAT: 10,
  DOUBLE: 11,
  TIMESTAMP: 12,
  DATE: 13,
  TIME: 14,
  INTERVAL: 15,
  HUGEINT: 16,
  VARCHAR: 17,
  BLOB: 18,
  DECIMAL: 19,
  TIMESTAMP_S: 20,
  TIMESTAMP_MS: 21,
  TIMESTAMP_NS: 22,
  ENUM: 23,
  LIST: 24,
  STRUCT: 25,
  MAP: 26,
  UUID: 27,
  UNION: 28,
  BIT: 29,
  TIME_TZ: 30,
  TIMESTAMP_TZ: 31,
  UHUGEINT: 32,
  ARRAY: 33,
  TIME_NS: 39,
};

export { DUCKDB_TYPE };

// ==============================================================================
// Helper Functions
// ==============================================================================

// Async mutex to serialize FFI calls
let ffiLock = Promise.resolve();
function withLock(fn) {
  const prev = ffiLock;
  let resolve;
  ffiLock = new Promise(r => resolve = r);
  return prev.then(() => {
    try { return fn(); }
    finally { resolve(); }
  });
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toCString(str) {
  return encoder.encode(str + '\0');
}

function fromCString(p) {
  if (!p) return null;
  return new CString(p).toString();
}

function allocPtr() {
  return new Uint8Array(8);
}

function readHandle(buf) {
  return new DataView(buf.buffer).getBigUint64(0, true);
}

// Read a duckdb_string_t (16 bytes) from a data pointer at a given row offset
function readString(dataPtr, row) {
  if (!dataPtr) return null;
  const offset = row * 16;  // duckdb_string_t is 16 bytes
  const length = ffiRead.u32(dataPtr, offset);

  if (length <= 12) {
    // Inlined: bytes 4-15 contain the string data
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = ffiRead.u8(dataPtr, offset + 4 + i);
    }
    return decoder.decode(bytes);
  } else {
    // Pointer: bytes 4-7 are prefix, bytes 8-15 are pointer to string data
    const strPtr = ffiRead.ptr(dataPtr, offset + 8);
    if (!strPtr) return null;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = ffiRead.u8(strPtr, i);
    }
    return decoder.decode(bytes);
  }
}

// Check if a row is valid (not NULL) in a validity mask
function isValid(validityPtr, row) {
  if (!validityPtr) return true;  // NULL validity = all valid
  const entryIdx = Math.floor(row / 64);
  const bitIdx = row % 64;
  const entry = ffiRead.u64(validityPtr, entryIdx * 8);
  return (entry & (1n << BigInt(bitIdx))) !== 0n;
}

// Format a hugeint (16 bytes: lower uint64 at offset 0, upper int64 at offset 8) as UUID
function readUUID(dataPtr, row) {
  if (!dataPtr) return null;
  const offset = row * 16;
  const lower = ffiRead.u64(dataPtr, offset);
  const upper = ffiRead.i64(dataPtr, offset + 8);

  // DuckDB stores UUID as hugeint with XOR on the upper bits
  // Upper 64 bits have sign bit flipped for sorting
  const mask64 = (1n << 64n) - 1n;
  const hi = (BigInt(upper) ^ (1n << 63n)) & mask64;
  const lo = BigInt(lower) & mask64;

  const hex = ((hi << 64n) | lo).toString(16).padStart(32, '0');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

// ==============================================================================
// Database Class
// ==============================================================================

class Database {
  #ptrBuf = null;
  #handle = null;

  constructor(path) {
    this.#ptrBuf = allocPtr();
    const pathBytes = path && path !== ':memory:' ? toCString(path) : null;
    const result = lib.duckdb_open(pathBytes ? ptr(pathBytes) : null, ptr(this.#ptrBuf));
    if (result !== 0) throw new Error('Failed to open database');
    this.#handle = readHandle(this.#ptrBuf);
  }

  get handle() { return this.#handle; }
  get ptrBuf() { return this.#ptrBuf; }

  connect() { return new Connection(this); }

  close() {
    if (this.#ptrBuf) {
      lib.duckdb_close(ptr(this.#ptrBuf));
      this.#ptrBuf = null;
      this.#handle = null;
    }
  }
}

// ==============================================================================
// Connection Class
// ==============================================================================

class Connection {
  #ptrBuf = null;
  #handle = null;
  #db = null;

  constructor(db) {
    this.#db = db;
    this.#ptrBuf = allocPtr();
    const result = lib.duckdb_connect(db.handle, ptr(this.#ptrBuf));
    if (result !== 0) throw new Error('Failed to create connection');
    this.#handle = readHandle(this.#ptrBuf);
  }

  get handle() { return this.#handle; }
  get ptrBuf() { return this.#ptrBuf; }

  /**
   * Execute a SQL query and return results as array of objects
   * @param {string} sql - SQL query
   * @param {any[]} params - Optional parameters for prepared statement
   * @returns {Promise<object[]>} Array of row objects
   */
  query(sql, params = []) {
    return withLock(() => {
      if (params.length > 0) return this.#queryPrepared(sql, params);
      return this.#querySimple(sql);
    });
  }

  #querySimple(sql) {
    const resultPtr = new Uint8Array(64);  // duckdb_result struct is ~48 bytes
    const sqlBytes = toCString(sql);
    const status = lib.duckdb_query(this.#handle, ptr(sqlBytes), ptr(resultPtr));

    const rp = ptr(resultPtr);
    if (status !== 0) {
      const errorPtr = lib.duckdb_result_error(rp);
      const error = errorPtr ? fromCString(errorPtr) : 'Query failed';
      lib.duckdb_destroy_result(rp);
      throw new Error(error);
    }

    try {
      return this.#extractChunks(resultPtr);
    } finally {
      lib.duckdb_destroy_result(rp);
    }
  }

  #queryPrepared(sql, params) {
    const stmtPtr = allocPtr();
    const sqlBytes = toCString(sql);

    const prepStatus = lib.duckdb_prepare(this.#handle, ptr(sqlBytes), ptr(stmtPtr));
    if (prepStatus !== 0) {
      const stmtHandle = readHandle(stmtPtr);
      if (stmtHandle) {
        const errPtr = lib.duckdb_prepare_error(stmtHandle);
        const errMsg = errPtr ? fromCString(errPtr) : 'Failed to prepare statement';
        lib.duckdb_destroy_prepare(ptr(stmtPtr));
        throw new Error(errMsg);
      }
      throw new Error('Failed to prepare statement');
    }

    const stmtHandle = readHandle(stmtPtr);

    try {
      this.#bindParams(stmtHandle, params);

      const resultPtr = new Uint8Array(64);  // duckdb_result struct is ~48 bytes
      lib.duckdb_execute_prepared(stmtHandle, ptr(resultPtr));

      const rp = ptr(resultPtr);
      const errorPtr = lib.duckdb_result_error(rp);
      if (errorPtr) {
        const error = fromCString(errorPtr);
        lib.duckdb_destroy_result(rp);
        throw new Error(error);
      }

      try {
        return this.#extractChunks(resultPtr);
      } finally {
        lib.duckdb_destroy_result(rp);
      }
    } finally {
      lib.duckdb_destroy_prepare(ptr(stmtPtr));
    }
  }

  // ---------------------------------------------------------------------------
  // Modern chunk-based result extraction
  //
  // Uses duckdb_fetch_chunk + duckdb_vector_get_data to read values directly
  // from DuckDB's columnar memory. No deprecated duckdb_value_* functions.
  //
  // Contract:
  //   BIGINT/UBIGINT → number (lossy above 2^53, JSON-safe)
  //   DECIMAL/HUGEINT/UHUGEINT → string (preserves precision)
  //   All timestamps → Date (UTC)
  //   UUID → string (formatted)
  //   VARCHAR/BLOB → string
  //   ENUM → string (dictionary lookup)
  //   TIME/TIME_NS/TIME_TZ → string (formatted)
  //   LIST/ARRAY → array, STRUCT → object, MAP → object
  // ---------------------------------------------------------------------------

  #extractChunks(resultPtr) {
    const rp = ptr(resultPtr);
    const colCount = Number(lib.duckdb_column_count(rp));

    // Get column info + logical type metadata for complex types
    const columns = [];
    for (let c = 0; c < colCount; c++) {
      const namePtr = lib.duckdb_column_name(rp, BigInt(c));
      const type = lib.duckdb_column_type(rp, BigInt(c));
      const col = {
        name: fromCString(namePtr) || `col${c}`,
        type,
        typeName: this.#typeName(type)
      };

      // Get logical type metadata for complex types
      if (type === DUCKDB_TYPE.DECIMAL || type === DUCKDB_TYPE.ENUM ||
          type === DUCKDB_TYPE.LIST || type === DUCKDB_TYPE.STRUCT ||
          type === DUCKDB_TYPE.MAP || type === DUCKDB_TYPE.ARRAY) {
        const logType = lib.duckdb_column_logical_type(rp, BigInt(c));
        if (logType) {
          if (type === DUCKDB_TYPE.DECIMAL) {
            col.decimalScale = lib.duckdb_decimal_scale(logType);
            col.decimalInternalType = lib.duckdb_decimal_internal_type(logType);
          } else if (type === DUCKDB_TYPE.ENUM) {
            col.enumInternalType = lib.duckdb_enum_internal_type(logType);
            const dictSize = lib.duckdb_enum_dictionary_size(logType);
            col.enumDict = [];
            for (let d = 0; d < dictSize; d++) {
              const vp = lib.duckdb_enum_dictionary_value(logType, BigInt(d));
              col.enumDict.push(fromCString(vp));
              if (vp) lib.duckdb_free(BigInt(vp));
            }
          } else if (type === DUCKDB_TYPE.LIST) {
            const childLogType = lib.duckdb_list_type_child_type(logType);
            if (childLogType) {
              col.childType = lib.duckdb_get_type_id(childLogType);
              const ltBuf2 = allocPtr();
              new DataView(ltBuf2.buffer).setBigUint64(0, BigInt(childLogType), true);
              lib.duckdb_destroy_logical_type(ptr(ltBuf2));
            }
          } else if (type === DUCKDB_TYPE.STRUCT) {
            const childCount = Number(lib.duckdb_struct_type_child_count(logType));
            col.structChildren = [];
            for (let i = 0; i < childCount; i++) {
              const np = lib.duckdb_struct_type_child_name(logType, BigInt(i));
              const ct = lib.duckdb_struct_type_child_type(logType, BigInt(i));
              const childType = ct ? lib.duckdb_get_type_id(ct) : DUCKDB_TYPE.VARCHAR;
              col.structChildren.push({ name: fromCString(np) || `f${i}`, type: childType });
              if (np) lib.duckdb_free(BigInt(np));
              if (ct) {
                const ltBuf2 = allocPtr();
                new DataView(ltBuf2.buffer).setBigUint64(0, BigInt(ct), true);
                lib.duckdb_destroy_logical_type(ptr(ltBuf2));
              }
            }
          } else if (type === DUCKDB_TYPE.MAP) {
            const keyLogType = lib.duckdb_list_type_child_type(logType); // MAP child is STRUCT
            if (keyLogType) {
              // MAP's child is a STRUCT with key (0) and value (1)
              const keyType = lib.duckdb_struct_type_child_type(keyLogType, 0n);
              const valType = lib.duckdb_struct_type_child_type(keyLogType, 1n);
              col.keyType = keyType ? lib.duckdb_get_type_id(keyType) : DUCKDB_TYPE.VARCHAR;
              col.valueType = valType ? lib.duckdb_get_type_id(valType) : DUCKDB_TYPE.VARCHAR;
              if (keyType) {
                const b = allocPtr(); new DataView(b.buffer).setBigUint64(0, BigInt(keyType), true);
                lib.duckdb_destroy_logical_type(ptr(b));
              }
              if (valType) {
                const b = allocPtr(); new DataView(b.buffer).setBigUint64(0, BigInt(valType), true);
                lib.duckdb_destroy_logical_type(ptr(b));
              }
              const b = allocPtr(); new DataView(b.buffer).setBigUint64(0, BigInt(keyLogType), true);
              lib.duckdb_destroy_logical_type(ptr(b));
            }
          } else if (type === DUCKDB_TYPE.ARRAY) {
            col.arraySize = Number(lib.duckdb_array_type_array_size(logType));
            const childLogType = lib.duckdb_array_type_child_type(logType);
            if (childLogType) {
              col.childType = lib.duckdb_get_type_id(childLogType);
              const ltBuf2 = allocPtr();
              new DataView(ltBuf2.buffer).setBigUint64(0, BigInt(childLogType), true);
              lib.duckdb_destroy_logical_type(ptr(ltBuf2));
            }
          }
          const ltBuf = allocPtr();
          new DataView(ltBuf.buffer).setBigUint64(0, BigInt(logType), true);
          lib.duckdb_destroy_logical_type(ptr(ltBuf));
        }
      }

      columns.push(col);
    }

    // Fetch chunks and extract rows
    const rows = [];
    const chunkBuf = allocPtr();

    while (true) {
      const chunk = fetchChunk(rp);
      if (!chunk) break;

      const chunkSize = Number(lib.duckdb_data_chunk_get_size(chunk));
      if (chunkSize === 0) {
        new DataView(chunkBuf.buffer).setBigUint64(0, BigInt(chunk), true);
        lib.duckdb_destroy_data_chunk(ptr(chunkBuf));
        break;
      }

      // Get vectors for each column (data + validity + handle for nested types)
      const colVec = [];
      const colData = [];
      const colValidity = [];
      for (let c = 0; c < colCount; c++) {
        const vec = lib.duckdb_data_chunk_get_vector(chunk, BigInt(c));
        colVec.push(vec);
        const dp = vec ? lib.duckdb_vector_get_data(vec) : 0n;
        colData.push(Number(dp));
        const vp = vec ? lib.duckdb_vector_get_validity(vec) : 0n;
        colValidity.push(Number(vp));
      }

      // Extract rows from this chunk
      for (let r = 0; r < chunkSize; r++) {
        const row = {};
        for (let c = 0; c < colCount; c++) {
          const col = columns[c];
          if (!isValid(colValidity[c], r)) {
            row[col.name] = null;
          } else {
            row[col.name] = this.#readValue(colData[c], r, col.type, col, colVec[c]);
          }
        }
        rows.push(row);
      }

      // Destroy chunk
      new DataView(chunkBuf.buffer).setBigUint64(0, BigInt(chunk), true);
      lib.duckdb_destroy_data_chunk(ptr(chunkBuf));
    }

    rows.columns = columns;
    return rows;
  }

  // ---------------------------------------------------------------------------
  // Read a single value from raw vector memory at a given row index.
  // This is the core type dispatch — reads directly from DuckDB's columnar
  // memory layout without any deprecated per-value API calls.
  // ---------------------------------------------------------------------------

  // col = column metadata (includes decimalScale, enumDict, etc.)
  // vec = vector handle (for nested type child access)
  #readValue(dataPtr, row, type, col, vec) {
    switch (type) {
      case DUCKDB_TYPE.BOOLEAN:
        return ffiRead.u8(dataPtr, row) !== 0;

      case DUCKDB_TYPE.TINYINT:
        return ffiRead.i8(dataPtr, row);
      case DUCKDB_TYPE.SMALLINT:
        return ffiRead.i16(dataPtr, row * 2);
      case DUCKDB_TYPE.INTEGER:
        return ffiRead.i32(dataPtr, row * 4);
      case DUCKDB_TYPE.UTINYINT:
        return ffiRead.u8(dataPtr, row);
      case DUCKDB_TYPE.USMALLINT:
        return ffiRead.u16(dataPtr, row * 2);
      case DUCKDB_TYPE.UINTEGER:
        return ffiRead.u32(dataPtr, row * 4);

      case DUCKDB_TYPE.BIGINT:
        return Number(ffiRead.i64(dataPtr, row * 8));
      case DUCKDB_TYPE.UBIGINT:
        return Number(ffiRead.u64(dataPtr, row * 8));

      case DUCKDB_TYPE.FLOAT:
        return ffiRead.f32(dataPtr, row * 4);
      case DUCKDB_TYPE.DOUBLE:
        return ffiRead.f64(dataPtr, row * 8);

      case DUCKDB_TYPE.HUGEINT: {
        const lo = ffiRead.u64(dataPtr, row * 16);
        const hi = ffiRead.i64(dataPtr, row * 16 + 8);
        const value = (BigInt(hi) << 64n) | BigInt(lo);
        return value.toString();
      }

      case DUCKDB_TYPE.UHUGEINT: {
        const lo = ffiRead.u64(dataPtr, row * 16);
        const hi = ffiRead.u64(dataPtr, row * 16 + 8);
        const value = (BigInt(hi) << 64n) | BigInt(lo);
        return value.toString();
      }

      case DUCKDB_TYPE.DECIMAL: {
        // Read based on internal type, divide by 10^scale, return as string
        const scale = col?.decimalScale || 0;
        const internalType = col?.decimalInternalType || DUCKDB_TYPE.DOUBLE;
        let raw;
        switch (internalType) {
          case DUCKDB_TYPE.SMALLINT:
            raw = BigInt(ffiRead.i16(dataPtr, row * 2)); break;
          case DUCKDB_TYPE.INTEGER:
            raw = BigInt(ffiRead.i32(dataPtr, row * 4)); break;
          case DUCKDB_TYPE.BIGINT:
            raw = ffiRead.i64(dataPtr, row * 8); break;
          case DUCKDB_TYPE.HUGEINT: {
            const lo = ffiRead.u64(dataPtr, row * 16);
            const hi = ffiRead.i64(dataPtr, row * 16 + 8);
            raw = (BigInt(hi) << 64n) | BigInt(lo);
            break;
          }
          default:
            return ffiRead.f64(dataPtr, row * 8);
        }
        if (scale === 0) return raw.toString();
        const divisor = 10n ** BigInt(scale);
        const sign = raw < 0n ? '-' : '';
        const abs = raw < 0n ? -raw : raw;
        const intPart = abs / divisor;
        const fracPart = abs % divisor;
        return `${sign}${intPart}.${fracPart.toString().padStart(scale, '0')}`;
      }

      case DUCKDB_TYPE.DATE: {
        const days = ffiRead.i32(dataPtr, row * 4);
        const ms = days * 86400000;
        const d = new Date(ms);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
      }

      case DUCKDB_TYPE.TIMESTAMP:
      case DUCKDB_TYPE.TIMESTAMP_S:
      case DUCKDB_TYPE.TIMESTAMP_MS:
      case DUCKDB_TYPE.TIMESTAMP_NS:
      case DUCKDB_TYPE.TIMESTAMP_TZ: {
        const micros = ffiRead.i64(dataPtr, row * 8);
        return new Date(Number(micros / 1000n));
      }

      case DUCKDB_TYPE.TIME: {
        const us = Number(ffiRead.i64(dataPtr, row * 8));
        const totalSec = Math.floor(us / 1000000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const frac = us % 1000000;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` +
               (frac > 0 ? `.${String(frac).padStart(6,'0').replace(/0+$/, '')}` : '');
      }

      case DUCKDB_TYPE.TIME_NS: {
        const ns = ffiRead.i64(dataPtr, row * 8);
        const totalUs = Number(ns / 1000n);
        const subUs = Number(ns % 1000n);
        const totalSec = Math.floor(totalUs / 1000000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const fracUs = totalUs % 1000000;
        const fracNs = fracUs * 1000 + subUs;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` +
               (fracNs > 0 ? `.${String(fracNs).padStart(9,'0').replace(/0+$/, '')}` : '');
      }

      case DUCKDB_TYPE.TIME_TZ: {
        // Stored as uint64: upper 40 bits = microseconds, lower 24 bits = offset + 86399
        const bits = ffiRead.u64(dataPtr, row * 8);
        const us = Number(bits >> 24n);
        const offsetSec = Number(bits & 0xFFFFFFn) - 86399;
        const totalSec = Math.floor(us / 1000000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const frac = us % 1000000;
        const absOff = Math.abs(offsetSec);
        const offH = Math.floor(absOff / 3600);
        const offM = Math.floor((absOff % 3600) / 60);
        const sign = offsetSec >= 0 ? '+' : '-';
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` +
               (frac > 0 ? `.${String(frac).padStart(6,'0').replace(/0+$/, '')}` : '') +
               `${sign}${String(offH).padStart(2,'0')}:${String(offM).padStart(2,'0')}`;
      }

      case DUCKDB_TYPE.UUID:
        return readUUID(dataPtr, row);

      case DUCKDB_TYPE.VARCHAR:
      case DUCKDB_TYPE.BLOB:
        return readString(dataPtr, row);

      case DUCKDB_TYPE.INTERVAL: {
        const months = ffiRead.i32(dataPtr, row * 16);
        const days = ffiRead.i32(dataPtr, row * 16 + 4);
        const micros = Number(ffiRead.i64(dataPtr, row * 16 + 8));
        const parts = [];
        if (months) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
        if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (micros) {
          const secs = micros / 1000000;
          parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
        }
        return parts.join(' ') || '0 seconds';
      }

      case DUCKDB_TYPE.ENUM: {
        // Read integer index, look up string from pre-built dictionary
        const dict = col?.enumDict;
        if (!dict) return null;
        const enumType = col?.enumInternalType || DUCKDB_TYPE.UTINYINT;
        let idx;
        switch (enumType) {
          case DUCKDB_TYPE.UTINYINT:  idx = ffiRead.u8(dataPtr, row); break;
          case DUCKDB_TYPE.USMALLINT: idx = ffiRead.u16(dataPtr, row * 2); break;
          case DUCKDB_TYPE.UINTEGER:  idx = ffiRead.u32(dataPtr, row * 4); break;
          default:                    idx = ffiRead.u32(dataPtr, row * 4); break;
        }
        return dict[idx] ?? null;
      }

      case DUCKDB_TYPE.LIST: {
        if (!vec) return null;
        const entryOffset = row * 16;
        const listOffset = Number(ffiRead.u64(dataPtr, entryOffset));
        const listLength = Number(ffiRead.u64(dataPtr, entryOffset + 8));
        const childVec = lib.duckdb_list_vector_get_child(vec);
        const childData = Number(lib.duckdb_vector_get_data(childVec));
        const childValidity = Number(lib.duckdb_vector_get_validity(childVec));
        const childType = col?.childType || DUCKDB_TYPE.VARCHAR;
        const result = [];
        for (let i = 0; i < listLength; i++) {
          const childRow = listOffset + i;
          if (!isValid(childValidity, childRow)) {
            result.push(null);
          } else {
            result.push(this.#readValue(childData, childRow, childType, null, childVec));
          }
        }
        return result;
      }

      case DUCKDB_TYPE.STRUCT: {
        if (!vec) return null;
        const obj = {};
        const childCount = col?.structChildren?.length || 0;
        for (let i = 0; i < childCount; i++) {
          const child = col.structChildren[i];
          const childVec = lib.duckdb_struct_vector_get_child(vec, BigInt(i));
          const childData = Number(lib.duckdb_vector_get_data(childVec));
          const childValidity = Number(lib.duckdb_vector_get_validity(childVec));
          if (!isValid(childValidity, row)) {
            obj[child.name] = null;
          } else {
            obj[child.name] = this.#readValue(childData, row, child.type, null, childVec);
          }
        }
        return obj;
      }

      case DUCKDB_TYPE.MAP: {
        if (!vec) return null;
        const entryOffset = row * 16;
        const listOffset = Number(ffiRead.u64(dataPtr, entryOffset));
        const listLength = Number(ffiRead.u64(dataPtr, entryOffset + 8));
        const childVec = lib.duckdb_list_vector_get_child(vec);
        const keyVec = lib.duckdb_struct_vector_get_child(childVec, 0n);
        const valVec = lib.duckdb_struct_vector_get_child(childVec, 1n);
        const keyData = Number(lib.duckdb_vector_get_data(keyVec));
        const valData = Number(lib.duckdb_vector_get_data(valVec));
        const keyValidity = Number(lib.duckdb_vector_get_validity(keyVec));
        const valValidity = Number(lib.duckdb_vector_get_validity(valVec));
        const keyType = col?.keyType || DUCKDB_TYPE.VARCHAR;
        const valType = col?.valueType || DUCKDB_TYPE.VARCHAR;
        const obj = {};
        for (let i = 0; i < listLength; i++) {
          const childRow = listOffset + i;
          const k = isValid(keyValidity, childRow)
            ? this.#readValue(keyData, childRow, keyType, null, keyVec) : null;
          const v = isValid(valValidity, childRow)
            ? this.#readValue(valData, childRow, valType, null, valVec) : null;
          if (k !== null) obj[String(k)] = v;
        }
        return obj;
      }

      case DUCKDB_TYPE.ARRAY: {
        if (!vec) return null;
        const arraySize = col?.arraySize || 0;
        const childVec = lib.duckdb_array_vector_get_child(vec);
        const childData = Number(lib.duckdb_vector_get_data(childVec));
        const childValidity = Number(lib.duckdb_vector_get_validity(childVec));
        const childType = col?.childType || DUCKDB_TYPE.VARCHAR;
        const baseIdx = row * arraySize;
        const result = [];
        for (let i = 0; i < arraySize; i++) {
          const childRow = baseIdx + i;
          if (!isValid(childValidity, childRow)) {
            result.push(null);
          } else {
            result.push(this.#readValue(childData, childRow, childType, null, childVec));
          }
        }
        return result;
      }

      case DUCKDB_TYPE.UNION:
      case DUCKDB_TYPE.BIT:
        return null; // Rarely used types

      default:
        try { return readString(dataPtr, row); }
        catch { return null; }
    }
  }

  #typeName(type) {
    for (const [name, value] of Object.entries(DUCKDB_TYPE)) {
      if (value === type) return name;
    }
    return 'UNKNOWN';
  }

  #bindParams(stmtHandle, params) {
    for (let i = 0; i < params.length; i++) {
      const paramIdx = BigInt(i + 1);
      const value = params[i];

      if (value === null || value === undefined) {
        lib.duckdb_bind_null(stmtHandle, paramIdx);
      } else if (typeof value === 'boolean') {
        lib.duckdb_bind_boolean(stmtHandle, paramIdx, value);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          lib.duckdb_bind_int64(stmtHandle, paramIdx, BigInt(value));
        } else {
          lib.duckdb_bind_double(stmtHandle, paramIdx, value);
        }
      } else if (typeof value === 'bigint') {
        lib.duckdb_bind_int64(stmtHandle, paramIdx, value);
      } else if (value instanceof Date) {
        const strBytes = toCString(value.toISOString());
        lib.duckdb_bind_varchar(stmtHandle, paramIdx, ptr(strBytes));
      } else {
        const strBytes = toCString(String(value));
        lib.duckdb_bind_varchar(stmtHandle, paramIdx, ptr(strBytes));
      }
    }
  }

  #appendValue(appenderHandle, value) {
    if (value === null || value === undefined) {
      lib.duckdb_append_null(appenderHandle);
    } else if (typeof value === 'boolean') {
      lib.duckdb_append_bool(appenderHandle, value);
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        lib.duckdb_append_int64(appenderHandle, BigInt(value));
      } else {
        lib.duckdb_append_double(appenderHandle, value);
      }
    } else if (typeof value === 'bigint') {
      lib.duckdb_append_int64(appenderHandle, value);
    } else if (value instanceof Date) {
      const strBytes = toCString(value.toISOString());
      lib.duckdb_append_varchar(appenderHandle, ptr(strBytes));
    } else {
      const strBytes = toCString(String(value));
      lib.duckdb_append_varchar(appenderHandle, ptr(strBytes));
    }
  }

  /**
   * Bulk insert rows using the DuckDB Appender API (fastest path)
   * @param {string} table - Table name
   * @param {string[]} columns - Column names
   * @param {any[][]} rows - Array of value arrays (positional, matching columns)
   * @returns {Promise<{rows: number}>}
   */
  append(table, columns, rows) {
    return withLock(() => {
      const appenderPtr = allocPtr();
      const tableBytes = toCString(table);

      const status = lib.duckdb_appender_create(this.#handle, null, ptr(tableBytes), ptr(appenderPtr));
      if (status !== 0) {
        const handle = readHandle(appenderPtr);
        if (handle) {
          const errPtr = lib.duckdb_appender_error(handle);
          const errMsg = errPtr ? fromCString(errPtr) : 'Failed to create appender';
          lib.duckdb_appender_destroy(ptr(appenderPtr));
          throw new Error(errMsg);
        }
        throw new Error('Failed to create appender');
      }

      const appenderHandle = readHandle(appenderPtr);

      try {
        if (columns && columns.length > 0) {
          lib.duckdb_appender_clear_columns(appenderHandle);
          for (const col of columns) {
            const colBytes = toCString(col);
            const addStatus = lib.duckdb_appender_add_column(appenderHandle, ptr(colBytes));
            if (addStatus !== 0) {
              const errPtr = lib.duckdb_appender_error(appenderHandle);
              throw new Error(errPtr ? fromCString(errPtr) : `Failed to add column: ${col}`);
            }
          }
        }

        for (const row of rows) {
          for (const value of row) {
            this.#appendValue(appenderHandle, value);
          }
          lib.duckdb_appender_end_row(appenderHandle);
        }

        const flushStatus = lib.duckdb_appender_flush(appenderHandle);
        if (flushStatus !== 0) {
          const errPtr = lib.duckdb_appender_error(appenderHandle);
          const errMsg = errPtr ? fromCString(errPtr) : 'Appender flush failed';
          throw new Error(errMsg);
        }

        return { rows: rows.length };
      } finally {
        lib.duckdb_appender_destroy(ptr(appenderPtr));
      }
    });
  }

  /**
   * Execute a prepared statement multiple times with different param sets
   * @param {string} sql - SQL with $1, $2, ... placeholders
   * @param {any[][]} paramSets - Array of param arrays
   * @returns {Promise<{rows: number}>}
   */
  queryBatch(sql, paramSets) {
    return withLock(() => {
      const stmtPtr = allocPtr();
      const sqlBytes = toCString(sql);

      const prepStatus = lib.duckdb_prepare(this.#handle, ptr(sqlBytes), ptr(stmtPtr));
      if (prepStatus !== 0) {
        const stmtHandle = readHandle(stmtPtr);
        if (stmtHandle) {
          const errPtr = lib.duckdb_prepare_error(stmtHandle);
          const errMsg = errPtr ? fromCString(errPtr) : 'Failed to prepare statement';
          lib.duckdb_destroy_prepare(ptr(stmtPtr));
          throw new Error(errMsg);
        }
        throw new Error('Failed to prepare statement');
      }

      const stmtHandle = readHandle(stmtPtr);
      let totalRows = 0;

      try {
        for (const params of paramSets) {
          this.#bindParams(stmtHandle, params);

          const resultPtr = new Uint8Array(64);
          lib.duckdb_execute_prepared(stmtHandle, ptr(resultPtr));

          const rp = ptr(resultPtr);
          const errorPtr = lib.duckdb_result_error(rp);
          if (errorPtr) {
            const error = fromCString(errorPtr);
            lib.duckdb_destroy_result(rp);
            throw new Error(error);
          }

          lib.duckdb_destroy_result(rp);
          lib.duckdb_clear_bindings(stmtHandle);
          totalRows++;
        }

        return { rows: totalRows };
      } finally {
        lib.duckdb_destroy_prepare(ptr(stmtPtr));
      }
    });
  }

  close() {
    if (this.#ptrBuf) {
      lib.duckdb_disconnect(ptr(this.#ptrBuf));
      this.#ptrBuf = null;
      this.#handle = null;
    }
  }
}

// ==============================================================================
// Public API
// ==============================================================================

export function open(path) {
  return new Database(path);
}

export function version() {
  const versionPtr = lib.duckdb_library_version();
  return fromCString(versionPtr);
}

export { Database, Connection };
