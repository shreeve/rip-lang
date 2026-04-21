// ============================================================================
// decoder.h — Public interface for the standalone rip-db wire decoder.
//
// Commit 1 scope: no DuckDB types are exposed or consumed. The decoder parses
// a rip-db /ddb/run response body into a simple in-memory representation,
// which the golden-test harness (decoder_test.cpp) compares against the
// captured fixture's canonical text rendering.
//
// The interface deliberately does NOT use any DuckDB types. The DataChunk /
// Vector binding is a later commit.
// ============================================================================

#pragma once

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

namespace ripdb {

// DuckDB LogicalTypeId values — mirrors the enum in duckdb-binary.rip.
enum class TypeId : uint8_t {
  BOOLEAN       = 10,
  TINYINT       = 11,
  SMALLINT      = 12,
  INTEGER       = 13,
  BIGINT        = 14,
  DATE          = 15,
  TIME          = 16,
  TIMESTAMP_SEC = 17,
  TIMESTAMP_MS  = 18,
  TIMESTAMP     = 19,
  TIMESTAMP_NS  = 20,
  DECIMAL       = 21,
  FLOAT         = 22,
  DOUBLE        = 23,
  CHAR          = 24,
  VARCHAR       = 25,
  INTERVAL      = 27,
  UTINYINT      = 28,
  USMALLINT     = 29,
  UINTEGER      = 30,
  UBIGINT       = 31,
  TIMESTAMP_TZ  = 32,
  TIME_TZ       = 34,
  TIME_NS       = 35,
  UHUGEINT      = 49,
  HUGEINT       = 50,
  UUID          = 54,
};

// 128-bit split representations. We carry them as (lo, hi) pairs rather than
// as __int128 in the public interface to keep the golden rendering trivial
// and to make every decode path explicit.
struct Int128Pair  { uint64_t lo; int64_t  hi; };
struct UInt128Pair { uint64_t lo; uint64_t hi; };

struct IntervalV   { int32_t months; int32_t days; int64_t micros; };

// Decoded cell — a discriminated union covering every native wire type.
// The mapping between TypeId and Cell::Tag is:
//
//   TypeId           → Tag
//   BOOLEAN          → BOOL
//   TINYINT/...      → I8/I16/I32/I64 (i64 holds sign-extended value)
//   UTINYINT/...     → U8/U16/U32/U64 (u64 holds zero-extended value)
//   FLOAT            → F32BITS
//   DOUBLE           → F64BITS
//   DATE             → I32           (days since epoch)
//   TIME/TIME_NS     → I64           (micros/nanos of day)
//   TIME_TZ          → U64           (packed (micros<<24)|offset+86399)
//   TIMESTAMP*/TZ    → I64           (units match encoder column type)
//   HUGEINT / UUID   → I128V         (lo unsigned, hi signed)
//   UHUGEINT         → U128V         (both unsigned)
//   INTERVAL         → INTERVALV
//   VARCHAR / CHAR   → BYTES         (raw UTF-8 / string bytes)
struct Cell {
  enum Tag {
    NUL,
    BOOL,
    I8,  U8,
    I16, U16,
    I32, U32,
    I64, U64,
    F32BITS,
    F64BITS,
    I128V,   // UUID + HUGEINT share this representation; the column's TypeId
             // decides how the golden-text renderer tags it (UUIDPAIR vs HUGEPAIR).
    U128V,
    INTERVALV,
    BYTES,
  };

  Tag tag = NUL;

  // Active-field union; we avoid std::variant to keep the public interface
  // C++17 with no hidden allocations. Only one of these is meaningful at a time.
  bool         b       = false;
  int64_t      i64     = 0;
  uint64_t     u64     = 0;
  uint32_t     f32bits = 0;
  uint64_t     f64bits = 0;
  Int128Pair   i128    = {0, 0};
  UInt128Pair  u128    = {0, 0};
  IntervalV    iv      = {0, 0, 0};
  std::string  bytes;  // only for Tag::BYTES
};

struct ColumnInfo {
  uint8_t     typeId = 0;
  std::string name;
  // Only set when typeId == DECIMAL. Carries the on-wire precision so
  // the scan layer can build DuckDB's LogicalType::DECIMAL(w, s) and
  // the golden-text renderer can format values correctly.
  uint8_t     decimal_width = 0;
  uint8_t     decimal_scale = 0;
};

struct Chunk {
  uint32_t                         rowCount = 0;
  // cells[colIdx][rowIdx]
  std::vector<std::vector<Cell>>   columns;
};

struct SuccessEnvelope {
  std::vector<ColumnInfo> columns;
  std::vector<Chunk>      chunks;
};

struct ErrorEnvelope {
  std::string message;
};

struct DecodedResult {
  bool            isError = false;
  SuccessEnvelope success;
  ErrorEnvelope   error;
};

// Thrown for any malformed input. The message is a human-readable description
// with a stable-enough substring ("unexpected end of buffer", "end marker",
// "unknown typeId", "string length", "bitmap", "boolean") that tests in
// test/fixtures/malformed/*.reject can assert on.
class DecodeError : public std::runtime_error {
public:
  using std::runtime_error::runtime_error;
};

// Parse a rip-db /ddb/run response body. Throws DecodeError on any
// malformed input. The returned value is self-contained (owns all strings).
DecodedResult decode(const uint8_t* data, std::size_t len);

// Render a DecodedResult as canonical golden text. This is the same format
// produced by packages/db/extension/scripts/capture-fixtures.rip. A successful
// round-trip is:  renderGolden(decode(read_file("x.bin"))) == read_file("x.golden")
std::string renderGolden(const DecodedResult& r);

} // namespace ripdb
