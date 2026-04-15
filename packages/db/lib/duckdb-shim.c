/*
 * Bun FFI shim for DuckDB functions that take duckdb_result by value.
 *
 * Bun's FFI cannot pass structs by value (48-byte duckdb_result on SysV
 * AMD64 is MEMORY class). These wrappers accept a pointer instead and
 * dereference it before calling the real DuckDB function.
 *
 * Build:
 *   gcc -shared -fPIC -o libduckdb-shim.so duckdb-shim.c -lduckdb
 *   # or, if libduckdb.so is in a non-standard path:
 *   gcc -shared -fPIC -o libduckdb-shim.so duckdb-shim.c -L/path/to -lduckdb
 */

#include <stdint.h>

typedef uint64_t idx_t;
typedef void *duckdb_data_chunk;

typedef struct {
    idx_t deprecated_column_count;
    idx_t deprecated_row_count;
    idx_t deprecated_rows_changed;
    void *deprecated_columns;
    char *deprecated_error_message;
    void *internal_data;
} duckdb_result;

extern duckdb_data_chunk duckdb_fetch_chunk(duckdb_result result);
extern duckdb_data_chunk duckdb_result_get_chunk(duckdb_result result, idx_t chunk_index);
extern idx_t duckdb_result_chunk_count(duckdb_result result);

duckdb_data_chunk shim_fetch_chunk(duckdb_result *result) {
    return duckdb_fetch_chunk(*result);
}

duckdb_data_chunk shim_result_get_chunk(duckdb_result *result, idx_t chunk_index) {
    return duckdb_result_get_chunk(*result, chunk_index);
}

idx_t shim_result_chunk_count(duckdb_result *result) {
    return duckdb_result_chunk_count(*result);
}
