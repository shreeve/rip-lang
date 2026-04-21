// ============================================================================
// decoder.cpp — Standalone decoder for rip-db's binary wire format.
//
// This file is the inverse of packages/db/lib/duckdb-binary.rip. It parses
// the byte stream emitted by `serializeSuccessResult` / `serializeErrorResult`
// into a simple in-memory representation (`DecodedResult`), and can render
// that representation as canonical golden-fixture text.
//
// Commit 1 scope (per packages/db/CLI.md):
//   - No DuckDB headers are included.
//   - No memcpy fast paths anywhere, including Tier-1 numeric types. Every
//     row is decoded via explicit per-row reads. A later commit may add
//     memcpy fast paths, gated on byte-for-byte equivalence tests against
//     this slow path over the existing fixture matrix.
//   - Tier-2 types (UUID, TIME_TZ, HUGEINT, UHUGEINT, INTERVAL) are decoded
//     field-by-field from the wire, never reinterpreted from a raw buffer.
//
// The wire format is defined in CLI.md §"Wire protocol — decoder plan".
// ============================================================================

#include "decoder.h"

#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

namespace ripdb {

// ---------------------------------------------------------------------------
// 128-bit decimal rendering (we don't link any bigint library).
// ---------------------------------------------------------------------------

static std::string u128_to_decimal(unsigned __int128 x) {
  if (x == 0) return "0";
  char buf[64];
  int  n = 0;
  while (x > 0) {
    buf[n++] = char('0' + (int)(x % 10));
    x /= 10;
  }
  std::string out;
  out.resize(n);
  for (int i = 0; i < n; ++i) out[i] = buf[n - 1 - i];
  return out;
}

static std::string i128_to_decimal(__int128 x) {
  if (x == 0) return "0";
  if (x < 0) {
    // Compute absolute value as unsigned; handles INT128_MIN correctly.
    unsigned __int128 u = (unsigned __int128)(-(x + 1)) + 1;
    return "-" + u128_to_decimal(u);
  }
  return u128_to_decimal((unsigned __int128)x);
}

// Assemble I128 from (lo, hi) where hi is signed 64-bit.
static __int128 make_i128(uint64_t lo, int64_t hi) {
  __int128 v = (__int128)(unsigned __int128)(uint64_t)hi << 64;
  v |= (__int128)lo;
  return v;
}

static unsigned __int128 make_u128(uint64_t lo, uint64_t hi) {
  return ((unsigned __int128)hi << 64) | (unsigned __int128)lo;
}

// ---------------------------------------------------------------------------
// Low-level reader over a byte range.
// ---------------------------------------------------------------------------

class Reader {
public:
  Reader(const uint8_t* data, size_t len) : p_(data), end_(data + len) {}

  size_t remaining() const { return (size_t)(end_ - p_); }
  bool   eof()       const { return p_ >= end_; }
  const uint8_t* cursor() const { return p_; }

  void need(size_t n, const char* ctx) {
    if ((size_t)(end_ - p_) < n) {
      throw DecodeError(std::string("unexpected end of buffer while reading ") + ctx);
    }
  }

  uint8_t u8(const char* ctx) {
    need(1, ctx);
    return *p_++;
  }

  uint16_t u16le(const char* ctx) {
    need(2, ctx);
    uint16_t v = (uint16_t)p_[0] | ((uint16_t)p_[1] << 8);
    p_ += 2;
    return v;
  }

  uint32_t u32le(const char* ctx) {
    need(4, ctx);
    uint32_t v = 0;
    for (int i = 0; i < 4; ++i) v |= ((uint32_t)p_[i]) << (i * 8);
    p_ += 4;
    return v;
  }

  uint64_t u64le(const char* ctx) {
    need(8, ctx);
    uint64_t v = 0;
    for (int i = 0; i < 8; ++i) v |= ((uint64_t)p_[i]) << (i * 8);
    p_ += 8;
    return v;
  }

  int8_t  i8 (const char* c) { return (int8_t ) u8 (c); }
  int16_t i16(const char* c) { return (int16_t) u16le(c); }
  int32_t i32(const char* c) { return (int32_t) u32le(c); }
  int64_t i64(const char* c) { return (int64_t) u64le(c); }

  // Encoder emits 32-bit varints (writeVarInt truncates via `v >>> 0`).
  // We accept up to 5 bytes (35 bits, bounded by uint32_t range anyway).
  uint32_t varint(const char* ctx) {
    uint32_t v      = 0;
    int      shift  = 0;
    int      read   = 0;
    while (true) {
      if (read >= 5) throw DecodeError(std::string("varint too long in ") + ctx);
      uint8_t b = u8(ctx);
      v |= ((uint32_t)(b & 0x7f)) << shift;
      if ((b & 0x80) == 0) return v;
      shift += 7;
      ++read;
    }
  }

  // writeData: varint length + raw bytes.
  std::string data(const char* ctx) {
    uint32_t n = varint(ctx);
    need(n, ctx);
    std::string s(reinterpret_cast<const char*>(p_), n);
    p_ += n;
    return s;
  }

  // writeString: same layout as data but with a semantic label.
  std::string str(const char* ctx) {
    uint32_t n = varint(ctx);
    need(n, ctx);
    std::string s(reinterpret_cast<const char*>(p_), n);
    p_ += n;
    return s;
  }

  // Field-id read (u16le) with optional expected value.
  uint16_t field_id(const char* ctx) { return u16le(ctx); }

  void expect_field(uint16_t expected, const char* ctx) {
    uint16_t got = u16le(ctx);
    if (got != expected) {
      char buf[128];
      std::snprintf(buf, sizeof(buf),
                    "expected field id %u in %s, got 0x%04x", expected, ctx, got);
      throw DecodeError(buf);
    }
  }

  void expect_end(const char* ctx) {
    uint16_t got = u16le(ctx);
    if (got != 0xFFFF) {
      char buf[128];
      std::snprintf(buf, sizeof(buf),
                    "expected end marker 0xFFFF in %s, got 0x%04x", ctx, got);
      throw DecodeError(buf);
    }
  }

private:
  const uint8_t* p_;
  const uint8_t* end_;
};

// ---------------------------------------------------------------------------
// Validity bitmap helper.
//   - Bitmap is a byte array where set bits mean "valid" (not null).
//   - Bit order within a byte is LSB-first, so rowIdx=0 is bit 0 of byte 0.
//   - Trailing bits past row_count are ignored (CLI.md Risk 3 + peer review).
//   - When `has_validity` is 0, all rows are valid; no bitmap is read.
// ---------------------------------------------------------------------------

static std::vector<bool> parse_validity(Reader& r, bool has_validity, uint32_t row_count) {
  std::vector<bool> out(row_count, true);
  if (!has_validity) return out;

  r.expect_field(101, "vector.validity");
  std::string bitmap = r.data("vector.validity");
  size_t      required_bytes = (row_count + 7) / 8;
  if (bitmap.size() < required_bytes) {
    throw DecodeError("validity bitmap too short for row_count");
  }
  for (uint32_t i = 0; i < row_count; ++i) {
    bool bit = (uint8_t)bitmap[i / 8] & (uint8_t)(1u << (i % 8));
    out[i]   = bit;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-type vector decoders.
//
// All decoders read row_count values from the "field 102" payload for that
// type. The payload shape depends on the type:
//   - Scalar fixed-width types: field 102 is a `writeData` blob (varint length
//     + packed raw bytes). We consume the varint but also validate it against
//     the expected byte count, then explicitly read each row.
//   - VARCHAR/CHAR: field 102 is a `writeList`, i.e. varint count + N strings.
// ---------------------------------------------------------------------------

// Read the "scalar data blob" field-102 header and return a sub-reader that
// views only the blob's bytes. Validates the declared byte length against
// `expected_bytes` (computed from row_count * row_width).
static Reader read_scalar_blob(Reader& r, uint32_t expected_bytes, const char* ctx) {
  r.expect_field(102, ctx);
  uint32_t declared = r.varint(ctx);
  if (declared != expected_bytes) {
    char buf[160];
    std::snprintf(buf, sizeof(buf),
                  "scalar blob length mismatch in %s: declared %u, expected %u",
                  ctx, declared, expected_bytes);
    throw DecodeError(buf);
  }
  r.need(declared, ctx);
  const uint8_t* p = r.cursor();
  // Advance the outer reader past the blob.
  Reader blob(p, declared);
  // We need the outer reader's cursor to advance. The blob will be consumed
  // by row-by-row reads, but it's safer to manually step the outer reader.
  for (uint32_t i = 0; i < declared; ++i) r.u8(ctx);
  return blob;
}

static std::vector<Cell> decode_boolean(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 1u, "vector.bool");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint8_t byte = blob.u8("bool");
    if (valid[i]) { out[i].tag = Cell::BOOL; out[i].b = (byte != 0); }
    else          { out[i].tag = Cell::NUL; }
  }
  return out;
}

template<typename IntT, Cell::Tag TAG>
static std::vector<Cell> decode_int_fixed(Reader& r, uint32_t row_count,
                                          const std::vector<bool>& valid,
                                          const char* ctx) {
  Reader blob = read_scalar_blob(r, row_count * (uint32_t)sizeof(IntT), ctx);
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    IntT v = 0;
    for (size_t b = 0; b < sizeof(IntT); ++b) {
      uint8_t byte = blob.u8(ctx);
      v |= (IntT)((IntT)byte << (b * 8));
    }
    if (valid[i]) {
      out[i].tag = TAG;
      // Route by TAG
      switch (TAG) {
        case Cell::I8:  case Cell::I16: case Cell::I32: case Cell::I64:
          out[i].i64 = (int64_t)(typename std::make_signed<IntT>::type)v; break;
        case Cell::U8:  case Cell::U16: case Cell::U32: case Cell::U64:
          out[i].u64 = (uint64_t)(typename std::make_unsigned<IntT>::type)v; break;
        default: break;
      }
    } else {
      out[i].tag = Cell::NUL;
    }
  }
  return out;
}

static std::vector<Cell> decode_float32(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 4u, "vector.float");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint32_t bits = 0;
    for (int b = 0; b < 4; ++b) bits |= ((uint32_t)blob.u8("f32")) << (b * 8);
    if (valid[i]) { out[i].tag = Cell::F32BITS; out[i].f32bits = bits; }
    else          { out[i].tag = Cell::NUL; }
  }
  return out;
}

static std::vector<Cell> decode_float64(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 8u, "vector.double");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint64_t bits = 0;
    for (int b = 0; b < 8; ++b) bits |= ((uint64_t)blob.u8("f64")) << (b * 8);
    if (valid[i]) { out[i].tag = Cell::F64BITS; out[i].f64bits = bits; }
    else          { out[i].tag = Cell::NUL; }
  }
  return out;
}

static std::vector<Cell> decode_varchar(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  r.expect_field(102, "vector.varchar");
  uint32_t count = r.varint("vector.varchar.count");
  if (count != row_count) {
    throw DecodeError("varchar vector list count != row_count");
  }
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint32_t    n = r.varint("vector.varchar.string_len");
    if (n > r.remaining()) {
      // Explicit "string length" substring keeps malformed/string_len_overrun.reject aligned.
      throw DecodeError("string length exceeds remaining buffer");
    }
    std::string s(reinterpret_cast<const char*>(r.cursor()), n);
    for (uint32_t j = 0; j < n; ++j) r.u8("string_bytes");
    if (valid[i]) { out[i].tag = Cell::BYTES; out[i].bytes = std::move(s); }
    else          { out[i].tag = Cell::NUL; }
  }
  return out;
}

// Explicit per-row decoders for Tier-2 types.
// These intentionally do not memcpy from the blob into a structured type.

static std::vector<Cell> decode_uuid(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 16u, "vector.uuid");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint64_t lo = 0;
    int64_t  hi = 0;
    for (int b = 0; b < 8; ++b) lo |= ((uint64_t)blob.u8("uuid.lo")) << (b * 8);
    uint64_t hi_u = 0;
    for (int b = 0; b < 8; ++b) hi_u |= ((uint64_t)blob.u8("uuid.hi")) << (b * 8);
    hi = (int64_t)hi_u;  // reinterpret as signed
    if (valid[i]) {
      out[i].tag = Cell::I128V;
      out[i].i128.lo = lo;
      out[i].i128.hi = hi;
    } else {
      out[i].tag = Cell::NUL;
    }
  }
  return out;
}

static std::vector<Cell> decode_hugeint(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 16u, "vector.hugeint");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint64_t lo = 0;
    for (int b = 0; b < 8; ++b) lo |= ((uint64_t)blob.u8("hugeint.lo")) << (b * 8);
    uint64_t hi_u = 0;
    for (int b = 0; b < 8; ++b) hi_u |= ((uint64_t)blob.u8("hugeint.hi")) << (b * 8);
    if (valid[i]) {
      out[i].tag = Cell::I128V;
      out[i].i128.lo = lo;
      out[i].i128.hi = (int64_t)hi_u;
    } else {
      out[i].tag = Cell::NUL;
    }
  }
  return out;
}

static std::vector<Cell> decode_uhugeint(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 16u, "vector.uhugeint");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint64_t lo = 0;
    for (int b = 0; b < 8; ++b) lo |= ((uint64_t)blob.u8("uhugeint.lo")) << (b * 8);
    uint64_t hi = 0;
    for (int b = 0; b < 8; ++b) hi |= ((uint64_t)blob.u8("uhugeint.hi")) << (b * 8);
    if (valid[i]) {
      out[i].tag = Cell::U128V;
      out[i].u128.lo = lo;
      out[i].u128.hi = hi;
    } else {
      out[i].tag = Cell::NUL;
    }
  }
  return out;
}

static std::vector<Cell> decode_interval(Reader& r, uint32_t row_count, const std::vector<bool>& valid) {
  Reader blob = read_scalar_blob(r, row_count * 16u, "vector.interval");
  std::vector<Cell> out(row_count);
  for (uint32_t i = 0; i < row_count; ++i) {
    uint32_t mo_u = 0;
    for (int b = 0; b < 4; ++b) mo_u |= ((uint32_t)blob.u8("iv.months")) << (b * 8);
    uint32_t da_u = 0;
    for (int b = 0; b < 4; ++b) da_u |= ((uint32_t)blob.u8("iv.days")) << (b * 8);
    uint64_t us_u = 0;
    for (int b = 0; b < 8; ++b) us_u |= ((uint64_t)blob.u8("iv.micros")) << (b * 8);
    if (valid[i]) {
      out[i].tag       = Cell::INTERVALV;
      out[i].iv.months = (int32_t)mo_u;
      out[i].iv.days   = (int32_t)da_u;
      out[i].iv.micros = (int64_t)us_u;
    } else {
      out[i].tag = Cell::NUL;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// DECIMAL decoder. DuckDB's internal physical layout depends on precision:
//   width  1..4  → int16  (2 bytes)
//   width  5..9  → int32  (4 bytes)
//   width 10..18 → int64  (8 bytes)
//   width 19..38 → int128 (16 bytes, lo+hi)
// The value on the wire is the unscaled signed integer. We emit the same
// Cell tag variants used by the underlying integer width, and the
// ColumnInfo's decimal_width / decimal_scale carry enough metadata for
// the renderer and the DuckDB-binding layer to reconstruct the original.
static std::vector<Cell> decode_decimal(Reader& r, uint32_t row_count,
                                         const std::vector<bool>& valid,
                                         uint8_t width) {
  if (width == 0 || width > 38) {
    throw DecodeError(std::string("decimal width ") + std::to_string((int)width)
                      + " out of range (must be 1..38)");
  }
  if (width <= 4) {
    return decode_int_fixed<int16_t, Cell::I16>(r, row_count, valid, "vector.decimal.i16");
  }
  if (width <= 9) {
    return decode_int_fixed<int32_t, Cell::I32>(r, row_count, valid, "vector.decimal.i32");
  }
  if (width <= 18) {
    return decode_int_fixed<int64_t, Cell::I64>(r, row_count, valid, "vector.decimal.i64");
  }
  // width 19..38: int128 signed (lo unsigned, hi signed), 16 bytes LE.
  return decode_hugeint(r, row_count, valid);
}

// ---------------------------------------------------------------------------
// Vector dispatcher.
// ---------------------------------------------------------------------------

static std::vector<Cell> decode_vector(Reader& r, const ColumnInfo& col, uint32_t row_count) {
  TypeId type_id = (TypeId)col.typeId;
  r.expect_field(100, "vector.has_validity");
  uint8_t has_validity = r.u8("vector.has_validity");
  if (has_validity > 1) {
    // The encoder writes 0 or 1; any other value indicates corruption.
    throw DecodeError("vector.has_validity is not a boolean (0 or 1)");
  }
  std::vector<bool> valid = parse_validity(r, has_validity != 0, row_count);

  std::vector<Cell> cells;
  switch (type_id) {
    case TypeId::BOOLEAN:       cells = decode_boolean(r, row_count, valid); break;
    case TypeId::TINYINT:       cells = decode_int_fixed<int8_t,   Cell::I8 >(r, row_count, valid, "i8");  break;
    case TypeId::UTINYINT:      cells = decode_int_fixed<uint8_t,  Cell::U8 >(r, row_count, valid, "u8");  break;
    case TypeId::SMALLINT:      cells = decode_int_fixed<int16_t,  Cell::I16>(r, row_count, valid, "i16"); break;
    case TypeId::USMALLINT:     cells = decode_int_fixed<uint16_t, Cell::U16>(r, row_count, valid, "u16"); break;
    case TypeId::INTEGER:       cells = decode_int_fixed<int32_t,  Cell::I32>(r, row_count, valid, "i32"); break;
    case TypeId::UINTEGER:      cells = decode_int_fixed<uint32_t, Cell::U32>(r, row_count, valid, "u32"); break;
    case TypeId::BIGINT:
    case TypeId::TIME:
    case TypeId::TIME_NS:
    case TypeId::TIMESTAMP:
    case TypeId::TIMESTAMP_SEC:
    case TypeId::TIMESTAMP_MS:
    case TypeId::TIMESTAMP_NS:
    case TypeId::TIMESTAMP_TZ:  cells = decode_int_fixed<int64_t,  Cell::I64>(r, row_count, valid, "i64"); break;
    case TypeId::UBIGINT:
    case TypeId::TIME_TZ:       cells = decode_int_fixed<uint64_t, Cell::U64>(r, row_count, valid, "u64"); break;
    case TypeId::DATE:          cells = decode_int_fixed<int32_t,  Cell::I32>(r, row_count, valid, "i32"); break;
    case TypeId::FLOAT:         cells = decode_float32(r, row_count, valid); break;
    case TypeId::DOUBLE:        cells = decode_float64(r, row_count, valid); break;
    case TypeId::VARCHAR:
    case TypeId::CHAR:          cells = decode_varchar(r, row_count, valid); break;
    case TypeId::UUID:          cells = decode_uuid    (r, row_count, valid); break;
    case TypeId::HUGEINT:       cells = decode_hugeint (r, row_count, valid); break;
    case TypeId::UHUGEINT:      cells = decode_uhugeint(r, row_count, valid); break;
    case TypeId::INTERVAL:      cells = decode_interval(r, row_count, valid); break;
    case TypeId::DECIMAL:       cells = decode_decimal (r, row_count, valid, col.decimal_width); break;
    default:
      throw DecodeError(std::string("unknown typeId ") + std::to_string((int)type_id));
  }

  r.expect_end("vector.end");
  return cells;
}

// ---------------------------------------------------------------------------
// Top-level envelope parsing.
// ---------------------------------------------------------------------------

DecodedResult decode(const uint8_t* data, size_t len) {
  Reader r(data, len);
  DecodedResult out;

  r.expect_field(100, "envelope.success_flag");
  uint8_t success = r.u8("envelope.success_flag");
  if (success != 0 && success != 1) {
    throw DecodeError("envelope.success_flag is not a boolean (0 or 1)");
  }

  if (success == 0) {
    r.expect_field(101, "envelope.error_message");
    out.isError       = true;
    out.error.message = r.str("envelope.error_message");
    r.expect_end("envelope.error_end");
    return out;
  }

  // Success: parse ColumnNamesAndTypes
  r.expect_field(101, "envelope.columns");

  r.expect_field(100, "columns.names");
  uint32_t name_count = r.varint("columns.names.count");
  std::vector<std::string> names;
  names.reserve(name_count);
  for (uint32_t i = 0; i < name_count; ++i) names.push_back(r.str("column.name"));

  r.expect_field(101, "columns.types");
  uint32_t type_count = r.varint("columns.types.count");
  if (type_count != name_count) {
    throw DecodeError("column names/types count mismatch");
  }
  // Each type record: field 100 (typeId u8) + field 101 (legacy extra u8)
  // + optional type-specific fields + 0xFFFF end. For DECIMAL, fields
  // 102 (width u8) + 103 (scale u8) carry precision metadata.
  out.success.columns.reserve(name_count);
  for (uint32_t i = 0; i < name_count; ++i) {
    ColumnInfo c;
    c.name = names[i];
    r.expect_field(100, "type.id");
    c.typeId = r.u8("type.id");
    r.expect_field(101, "type.extra");
    (void)r.u8("type.extra");
    // Loop reading any additional type-specific fields until the end
    // marker. Unknown field ids are protocol errors — we can't skip
    // them without a length-prefix convention, so rejecting is safe.
    while (true) {
      uint16_t fid = r.field_id("type.next_field");
      if (fid == 0xFFFF) break;
      if ((TypeId)c.typeId == TypeId::DECIMAL && fid == 102) {
        c.decimal_width = r.u8("type.decimal_width");
      } else if ((TypeId)c.typeId == TypeId::DECIMAL && fid == 103) {
        c.decimal_scale = r.u8("type.decimal_scale");
      } else {
        char buf[96];
        std::snprintf(buf, sizeof(buf),
                      "unexpected type-record field 0x%04x for typeId %u",
                      fid, (unsigned)c.typeId);
        throw DecodeError(buf);
      }
    }
    out.success.columns.push_back(std::move(c));
  }
  r.expect_end("columns.end");

  // Pre-validate typeIds against our known set so malformed fixtures reject
  // before any chunk decoding.
  auto is_known_type = [](uint8_t t) {
    switch ((TypeId)t) {
      case TypeId::BOOLEAN:   case TypeId::TINYINT:       case TypeId::SMALLINT:
      case TypeId::INTEGER:   case TypeId::BIGINT:        case TypeId::DATE:
      case TypeId::TIME:      case TypeId::TIMESTAMP_SEC: case TypeId::TIMESTAMP_MS:
      case TypeId::TIMESTAMP: case TypeId::TIMESTAMP_NS:  case TypeId::DECIMAL:
      case TypeId::FLOAT:     case TypeId::DOUBLE:        case TypeId::CHAR:
      case TypeId::VARCHAR:   case TypeId::INTERVAL:      case TypeId::UTINYINT:
      case TypeId::USMALLINT: case TypeId::UINTEGER:      case TypeId::UBIGINT:
      case TypeId::TIMESTAMP_TZ: case TypeId::TIME_TZ:    case TypeId::TIME_NS:
      case TypeId::HUGEINT:   case TypeId::UHUGEINT:      case TypeId::UUID:
        return true;
      default:
        return false;
    }
  };
  for (const auto &c : out.success.columns) {
    if (!is_known_type(c.typeId)) {
      throw DecodeError(std::string("unknown typeId ") + std::to_string((int)c.typeId));
    }
    if ((TypeId)c.typeId == TypeId::DECIMAL &&
        (c.decimal_width == 0 || c.decimal_width > 38)) {
      throw DecodeError(std::string("decimal width ") + std::to_string((int)c.decimal_width)
                        + " out of range (must be 1..38)");
    }
  }

  // field 102: list<DataChunk>
  r.expect_field(102, "envelope.chunks");
  uint32_t chunk_count = r.varint("envelope.chunks.count");
  out.success.chunks.reserve(chunk_count);
  for (uint32_t ci = 0; ci < chunk_count; ++ci) {
    Chunk ch;
    r.expect_field(100, "chunk.rows");
    ch.rowCount = r.varint("chunk.rows.count");

    r.expect_field(101, "chunk.vectors");
    uint32_t vec_count = r.varint("chunk.vectors.count");
    if (vec_count != name_count) {
      throw DecodeError("chunk vector count != column count");
    }
    ch.columns.reserve(vec_count);
    for (uint32_t vi = 0; vi < vec_count; ++vi) {
      ch.columns.push_back(decode_vector(r, out.success.columns[vi], ch.rowCount));
    }
    r.expect_end("chunk.end");
    out.success.chunks.push_back(std::move(ch));
  }

  r.expect_end("envelope.end");
  return out;
}

// ---------------------------------------------------------------------------
// Canonical golden-text rendering.
//
// The output must match the format generated by
// packages/db/extension/scripts/capture-fixtures.rip exactly, byte for byte.
// ---------------------------------------------------------------------------

static std::string hex_of_bytes(const std::string& s) {
  static const char* digits = "0123456789abcdef";
  std::string out;
  out.resize(s.size() * 2);
  for (size_t i = 0; i < s.size(); ++i) {
    uint8_t b = (uint8_t)s[i];
    out[2 * i]     = digits[b >> 4];
    out[2 * i + 1] = digits[b & 0xf];
  }
  return out;
}

static std::string hex_u32_8(uint32_t v) {
  char buf[16];
  std::snprintf(buf, sizeof(buf), "0x%08x", v);
  return std::string(buf);
}

static std::string hex_u64_16(uint64_t v) {
  char buf[32];
  std::snprintf(buf, sizeof(buf), "0x%016llx", (unsigned long long)v);
  return std::string(buf);
}

static std::string render_cell(const Cell& c) {
  char tmp[128];
  switch (c.tag) {
    case Cell::NUL:
      return "NULL";
    case Cell::BOOL:
      return std::string("BOOL ") + (c.b ? "1" : "0");
    case Cell::I8:  std::snprintf(tmp, sizeof(tmp), "I8 %lld",  (long long)c.i64);            return tmp;
    case Cell::U8:  std::snprintf(tmp, sizeof(tmp), "U8 %llu",  (unsigned long long)c.u64);   return tmp;
    case Cell::I16: std::snprintf(tmp, sizeof(tmp), "I16 %lld", (long long)c.i64);            return tmp;
    case Cell::U16: std::snprintf(tmp, sizeof(tmp), "U16 %llu", (unsigned long long)c.u64);   return tmp;
    case Cell::I32: std::snprintf(tmp, sizeof(tmp), "I32 %lld", (long long)c.i64);            return tmp;
    case Cell::U32: std::snprintf(tmp, sizeof(tmp), "U32 %llu", (unsigned long long)c.u64);   return tmp;
    case Cell::I64: std::snprintf(tmp, sizeof(tmp), "I64 %lld", (long long)c.i64);            return tmp;
    case Cell::U64: std::snprintf(tmp, sizeof(tmp), "U64 %llu", (unsigned long long)c.u64);   return tmp;
    case Cell::F32BITS: return std::string("F32BITS ") + hex_u32_8(c.f32bits);
    case Cell::F64BITS: return std::string("F64BITS ") + hex_u64_16(c.f64bits);
    case Cell::I128V: {
      // Note: same shape used by both UUID and HUGEINT in the encoder; the
      // golden-fixture tag depends on the column's type. We let the renderer
      // decide via the typeId (passed in by the caller). Fallback: HUGEPAIR.
      return std::string();  // filled in by caller
    }
    case Cell::U128V: {
      return std::string();
    }
    case Cell::INTERVALV: {
      char buf[96];
      std::snprintf(buf, sizeof(buf),
                    "INTERVAL months=%d days=%d micros=%lld",
                    c.iv.months, c.iv.days, (long long)c.iv.micros);
      return buf;
    }
    case Cell::BYTES: {
      std::string out = "BYTES ";
      out += std::to_string(c.bytes.size());
      out += " ";
      out += hex_of_bytes(c.bytes);
      return out;
    }
  }
  return "UNKNOWN";
}

static std::string render_cell_typed(const Cell& c, const ColumnInfo& col) {
  uint8_t typeId = col.typeId;
  // DECIMAL gets its own rendering — underlying integer is the unscaled
  // value; we output it together with the declared width/scale so the
  // golden fixture captures the full on-wire precision.
  if ((TypeId)typeId == TypeId::DECIMAL && c.tag != Cell::NUL) {
    char tmp[128];
    std::string value_str;
    switch (c.tag) {
      case Cell::I16:
      case Cell::I32:
      case Cell::I64:
        value_str = std::to_string((long long)c.i64);
        break;
      case Cell::I128V:
        value_str = i128_to_decimal(make_i128(c.i128.lo, c.i128.hi));
        break;
      default:
        return "DEC UNKNOWN_PHYSICAL";
    }
    std::snprintf(tmp, sizeof(tmp), "DEC width=%u scale=%u value=%s",
                  (unsigned)col.decimal_width, (unsigned)col.decimal_scale,
                  value_str.c_str());
    return tmp;
  }
  if (c.tag == Cell::I128V) {
    char tmp[96];
    if ((TypeId)typeId == TypeId::UUID) {
      std::snprintf(tmp, sizeof(tmp),
                    "UUIDPAIR lo=%s hi=%s",
                    u128_to_decimal((unsigned __int128)c.i128.lo).c_str(),
                    i128_to_decimal((__int128)(int64_t)c.i128.hi).c_str());
    } else {
      std::snprintf(tmp, sizeof(tmp),
                    "HUGEPAIR lo=%s hi=%s",
                    u128_to_decimal((unsigned __int128)c.i128.lo).c_str(),
                    i128_to_decimal((__int128)(int64_t)c.i128.hi).c_str());
    }
    return tmp;
  }
  if (c.tag == Cell::U128V) {
    char tmp[96];
    std::snprintf(tmp, sizeof(tmp),
                  "UHUGEPAIR lo=%s hi=%s",
                  u128_to_decimal((unsigned __int128)c.u128.lo).c_str(),
                  u128_to_decimal((unsigned __int128)c.u128.hi).c_str());
    return tmp;
  }
  return render_cell(c);
}

std::string renderGolden(const DecodedResult& r) {
  std::string out;
  if (r.isError) {
    out += "ENVELOPE ERROR\n";
    out += "MESSAGE_HEX ";
    out += hex_of_bytes(r.error.message);
    out += "\n";
    return out;
  }

  out += "ENVELOPE SUCCESS\n";
  char buf[64];

  std::snprintf(buf, sizeof(buf), "CHUNKS %zu\n", r.success.chunks.size());
  out += buf;

  size_t total_rows = 0;
  for (const auto& ch : r.success.chunks) total_rows += ch.rowCount;
  std::snprintf(buf, sizeof(buf), "ROWS %zu\n", total_rows);
  out += buf;

  std::snprintf(buf, sizeof(buf), "COLS %zu\n", r.success.columns.size());
  out += buf;

  for (size_t i = 0; i < r.success.columns.size(); ++i) {
    const auto& c = r.success.columns[i];
    if ((TypeId)c.typeId == TypeId::DECIMAL) {
      std::snprintf(buf, sizeof(buf),
                    "COL %zu typeId=%u width=%u scale=%u name_hex=",
                    i, (unsigned)c.typeId, (unsigned)c.decimal_width,
                    (unsigned)c.decimal_scale);
    } else {
      std::snprintf(buf, sizeof(buf), "COL %zu typeId=%u name_hex=",
                    i, (unsigned)c.typeId);
    }
    out += buf;
    out += hex_of_bytes(c.name);
    out += "\n";
  }

  for (size_t ci = 0; ci < r.success.chunks.size(); ++ci) {
    const Chunk& ch = r.success.chunks[ci];
    std::snprintf(buf, sizeof(buf), "CHUNK %zu rows=%u\n", ci, ch.rowCount);
    out += buf;
    for (uint32_t ri = 0; ri < ch.rowCount; ++ri) {
      for (size_t col = 0; col < ch.columns.size(); ++col) {
        std::snprintf(buf, sizeof(buf), "CELL %zu %u %zu ", ci, ri, col);
        out += buf;
        out += render_cell_typed(ch.columns[col][ri], r.success.columns[col]);
        out += "\n";
      }
    }
  }
  return out;
}

} // namespace ripdb
