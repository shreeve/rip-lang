//===----------------------------------------------------------------------===//
//  ripdb_compat.hpp — DuckDB header shim layer
//
//  The extension source file compiles against BOTH:
//
//    * DuckDB v1.5.2 (the released stable, which CI targets and end-users get
//      out of stock `brew install duckdb` / pip / docker)
//    * Post-v1.5.2 / current `main` dev tree (handy for local development)
//
//  Those two DuckDB versions differ in a handful of mechanical ways:
//
//    1. The per-type vector helpers (`FlatVector`, `StringVector`, etc.) were
//       split out of `duckdb/common/types/vector.hpp` into separate headers
//       under `duckdb/common/vector/`. On v1.5.2 they still live in the
//       monolithic header, pulled in transitively via `data_chunk.hpp`.
//
//    2. `FlatVector::GetData<T>` became const-only in dev. A new
//       `FlatVector::GetDataMutable<T>` provides the mutable pointer.
//       On v1.5.2 the original `GetData<T>` returns mutable.
//
//    3. `LogicalGet::GetColumnIndex(binding)` is a dev-era convenience that
//       wraps `column_ids[binding.column_index]` — v1.5.2 only has the raw
//       `GetColumnIds()` access.
//
//  This single header probes header layout once via `__has_include`, then
//  exposes thin inline helpers that the extension code uses uniformly. When
//  we drop dev compatibility (once 1.6 lands and the APIs stabilise), this
//  file goes away.
//===----------------------------------------------------------------------===//

#pragma once

// Pull in the always-present entry point that defines `Vector`, `DataChunk`,
// `LogicalGet`, and friends regardless of DuckDB version. On v1.5.2 this
// transitively also brings in the vector helpers themselves; on dev we then
// explicitly include the split-out headers below.
#include "duckdb/common/types/data_chunk.hpp"
#include "duckdb/common/column_index.hpp"
#include "duckdb/planner/column_binding.hpp"
#include "duckdb/planner/operator/logical_get.hpp"

// -----------------------------------------------------------------------------
// 1) Header-layout probe.
// -----------------------------------------------------------------------------
#if __has_include("duckdb/common/vector/flat_vector.hpp")
#  include "duckdb/common/vector/flat_vector.hpp"
#  include "duckdb/common/vector/string_vector.hpp"
#  define RIPDB_HAS_DEV_VECTOR_HEADERS 1
#else
#  define RIPDB_HAS_DEV_VECTOR_HEADERS 0
#endif

namespace ripdb_compat {

// -----------------------------------------------------------------------------
// 2) Mutable-pointer accessor for FlatVector.
//
//    * Dev: must call `GetDataMutable<T>` — plain `GetData<T>` now returns
//      `const T*`.
//    * v1.5.2: plain `GetData<T>` on a non-const Vector& already returns
//      `T*` (mutable).
//
//    Either way this helper returns `T*` to the caller, so downstream code
//    can keep writing `helper[row_idx] = value;` unchanged.
// -----------------------------------------------------------------------------
template <class T>
static inline T *FlatVecMutable(duckdb::Vector &vec) {
#if RIPDB_HAS_DEV_VECTOR_HEADERS
	return duckdb::FlatVector::GetDataMutable<T>(vec);
#else
	return duckdb::FlatVector::GetData<T>(vec);
#endif
}

// -----------------------------------------------------------------------------
// 3) ColumnIndex lookup off a LogicalGet, given a ColumnBinding.
//
//    Dev has `LogicalGet::GetColumnIndex(binding)`. v1.5.2 only has
//    `GetColumnIds()` — but the dev helper implements itself as exactly
//    `column_ids[binding.column_index]` after a table-index check, so the
//    shim is a semantically-identical one-liner.
//
//    Callers are already expected to verify `binding.table_index ==
//    get.table_index` themselves (ripdb_compat does not throw on mismatch
//    the way the dev helper does, because ripdb's existing code path
//    prefers silent failure to exceptions in this spot).
// -----------------------------------------------------------------------------
static inline const duckdb::ColumnIndex &GetColumnIndex(
    const duckdb::LogicalGet &get, const duckdb::ColumnBinding &binding) {
#if RIPDB_HAS_DEV_VECTOR_HEADERS
	return get.GetColumnIndex(binding);
#else
	return get.GetColumnIds()[binding.column_index];
#endif
}

} // namespace ripdb_compat
