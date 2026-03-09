import { describe, test, expect } from 'bun:test';
import {
  BinarySerializer,
  LogicalTypeId,
  serializeSuccessResult,
  serializeErrorResult,
  serializeEmptyResult,
  serializeTokenizeResult,
  tokenizeSQL,
} from '../lib/duckdb-binary.rip';

// =============================================================================
// Minimal deserializer matching the DuckDB UI's BinaryDeserializer
// =============================================================================

class BinaryReader {
  constructor(buffer) {
    this.buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.dv = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    this.pos = 0;
  }

  readUint8() { return this.buf[this.pos++]; }

  readUint16LE() {
    const v = this.dv.getUint16(this.pos, true);
    this.pos += 2;
    return v;
  }

  readInt32LE() {
    const v = this.dv.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readUint32LE() {
    const v = this.dv.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readBigInt64LE() {
    const v = this.dv.getBigInt64(this.pos, true);
    this.pos += 8;
    return v;
  }

  readBigUint64LE() {
    const v = this.dv.getBigUint64(this.pos, true);
    this.pos += 8;
    return v;
  }

  readFloat32LE() {
    const v = this.dv.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readFloat64LE() {
    const v = this.dv.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  readVarInt() {
    let result = 0, shift = 0;
    while (true) {
      const byte = this.buf[this.pos++];
      result |= (byte & 0x7F) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result >>> 0;
  }

  readString() {
    const len = this.readVarInt();
    const bytes = this.buf.slice(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(bytes);
  }

  readData() {
    const len = this.readVarInt();
    const data = this.buf.slice(this.pos, this.pos + len);
    this.pos += len;
    return data;
  }

  readFieldId() { return this.readUint16LE(); }

  expectEndMarker() {
    const id = this.readFieldId();
    if (id !== 0xFFFF) throw new Error(`Expected end marker, got field ${id}`);
  }
}

function readSuccessResult(buf) {
  const r = new BinaryReader(buf);
  const f100 = r.readFieldId(); // 100 = success
  const success = r.readUint8() !== 0;
  if (!success) {
    const f101 = r.readFieldId(); // 101 = error
    const error = r.readString();
    r.expectEndMarker();
    return { success: false, error };
  }

  // field 101: ColumnNamesAndTypes object
  r.readFieldId(); // 101
  // inner field 100: list of names
  r.readFieldId(); // 100
  const nameCount = r.readVarInt();
  const names = [];
  for (let i = 0; i < nameCount; i++) names.push(r.readString());
  // inner field 101: list of types
  r.readFieldId(); // 101
  const typeCount = r.readVarInt();
  const types = [];
  for (let i = 0; i < typeCount; i++) {
    r.readFieldId(); // 100 = type id
    const typeId = r.readUint8();
    r.readFieldId(); // 101 = type info
    const typeInfo = r.readUint8();
    r.expectEndMarker();
    types.push({ id: typeId, info: typeInfo });
  }
  r.expectEndMarker(); // end of ColumnNamesAndTypes

  // field 102: list<DataChunk>
  r.readFieldId(); // 102
  const chunkCount = r.readVarInt();
  const chunks = [];
  for (let c = 0; c < chunkCount; c++) {
    r.readFieldId(); // 100 = row_count
    const rowCount = r.readVarInt();
    r.readFieldId(); // 101 = vectors list
    const vecCount = r.readVarInt();
    const vectors = [];
    for (let v = 0; v < vecCount; v++) {
      vectors.push(readVector(r, types[v]));
    }
    r.expectEndMarker(); // end of DataChunk
    chunks.push({ rowCount, vectors });
  }
  r.expectEndMarker(); // end of SuccessResult

  return { success: true, names, types, chunks };
}

function readVector(r, type) {
  const af100 = r.readFieldId(); // 100 = allValid
  const allValid = r.readUint8();
  let validity = null;
  if (allValid) {
    const vf101 = r.readFieldId(); // 101 = validity bitmap
    validity = r.readData();
  }

  const typeId = type.id;
  let data;

  if (typeId === LogicalTypeId.VARCHAR || typeId === LogicalTypeId.CHAR) {
    // String list
    const df102 = r.readFieldId(); // 102
    const count = r.readVarInt();
    const strings = [];
    for (let i = 0; i < count; i++) strings.push(r.readString());
    data = { kind: 'string', values: strings };
  } else {
    // Raw data
    const df102 = r.readFieldId(); // 102
    const rawData = r.readData();
    data = { kind: 'data', bytes: rawData };
  }

  r.expectEndMarker();
  return { allValid, validity, data };
}

// =============================================================================
// Helper to make column/row inputs for serializeSuccessResult
// =============================================================================

function makeResult(colDefs, rowData) {
  const columns = colDefs.map(([name, type]) => ({ name, type }));
  return serializeSuccessResult(columns, rowData);
}

// =============================================================================
// serializeSuccessResult structure
// =============================================================================

describe('serializeSuccessResult: structure', () => {
  test('basic integer result', () => {
    const buf = makeResult([['num', 'INTEGER']], [[42]]);
    const result = readSuccessResult(buf);
    expect(result.success).toBe(true);
    expect(result.names).toEqual(['num']);
    expect(result.types[0].id).toBe(LogicalTypeId.INTEGER);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].rowCount).toBe(1);
  });

  test('multiple columns and rows', () => {
    const buf = makeResult(
      [['id', 'INTEGER'], ['name', 'VARCHAR']],
      [[1, 'Alice'], [2, 'Bob']]
    );
    const result = readSuccessResult(buf);
    expect(result.names).toEqual(['id', 'name']);
    expect(result.chunks[0].rowCount).toBe(2);
    expect(result.chunks[0].vectors).toHaveLength(2);
  });

  test('empty result', () => {
    const buf = makeResult([['x', 'INTEGER']], []);
    const result = readSuccessResult(buf);
    expect(result.chunks[0].rowCount).toBe(0);
  });
});

// =============================================================================
// serializeErrorResult
// =============================================================================

describe('serializeErrorResult', () => {
  test('error message is readable', () => {
    const buf = serializeErrorResult('Something went wrong');
    const r = new BinaryReader(buf);
    const f100 = r.readFieldId();
    const success = r.readUint8();
    expect(success).toBe(0);
    const f101 = r.readFieldId();
    const msg = r.readString();
    expect(msg).toBe('Something went wrong');
  });
});

// =============================================================================
// serializeEmptyResult
// =============================================================================

describe('serializeEmptyResult', () => {
  test('produces an empty buffer', () => {
    const buf = serializeEmptyResult();
    expect(buf.byteLength).toBe(0);
  });
});

// =============================================================================
// Vector wire format — numeric types
// =============================================================================

describe('vector wire format: numeric types', () => {
  test('BOOLEAN serializes as 1-byte values', () => {
    const buf = makeResult([['v', 'BOOLEAN']], [[true], [false]]);
    const result = readSuccessResult(buf);
    const data = result.chunks[0].vectors[0].data;
    expect(data.kind).toBe('data');
    expect(data.bytes[0]).toBe(1);
    expect(data.bytes[1]).toBe(0);
  });

  test('INTEGER serializes as 4-byte LE', () => {
    const buf = makeResult([['v', 'INTEGER']], [[42]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getInt32(0, true)).toBe(42);
  });

  test('BIGINT serializes as 8-byte LE', () => {
    const buf = makeResult([['v', 'BIGINT']], [[1234567890]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getBigInt64(0, true)).toBe(1234567890n);
  });

  test('FLOAT serializes as 4-byte LE float', () => {
    const buf = makeResult([['v', 'FLOAT']], [[3.14]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getFloat32(0, true)).toBeCloseTo(3.14, 2);
  });

  test('DOUBLE serializes as 8-byte LE double', () => {
    const buf = makeResult([['v', 'DOUBLE']], [[3.141592653589793]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getFloat64(0, true)).toBeCloseTo(3.141592653589793);
  });

  test('HUGEINT serializes as 16-byte LE', () => {
    const buf = makeResult([['v', 'HUGEINT']], [['12345678901234567890']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    expect(bytes.length).toBe(16);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const lo = dv.getBigUint64(0, true);
    const hi = dv.getBigInt64(8, true);
    const reconstructed = (hi << 64n) | lo;
    expect(reconstructed).toBe(12345678901234567890n);
  });

  test('UHUGEINT serializes as 16-byte LE', () => {
    const buf = makeResult([['v', 'UHUGEINT']], [['340282366920938463463374607431768211455']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    expect(bytes.length).toBe(16);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const lo = dv.getBigUint64(0, true);
    const hi = dv.getBigUint64(8, true);
    const mask64 = (1n << 64n) - 1n;
    const reconstructed = ((hi & mask64) << 64n) | lo;
    expect(reconstructed).toBe(340282366920938463463374607431768211455n);
  });
});

// =============================================================================
// Vector wire format — temporal types
// =============================================================================

describe('vector wire format: temporal types', () => {
  test('TIME serializes as int64 microseconds', () => {
    const buf = makeResult([['v', 'TIME']], [['14:30:00']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const micros = dv.getBigInt64(0, true);
    expect(micros).toBe(BigInt(14 * 3600 + 30 * 60) * 1000000n);
  });

  test('TIME with fractional seconds', () => {
    const buf = makeResult([['v', 'TIME']], [['14:30:00.123456']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const micros = dv.getBigInt64(0, true);
    expect(micros).toBe(BigInt(14 * 3600 + 30 * 60) * 1000000n + 123456n);
  });

  test('TIME_TZ serializes as packed uint64', () => {
    const buf = makeResult([['v', 'TIME_TZ']], [['14:30:00+05:30']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const packed = dv.getBigUint64(0, true);
    const micros = Number(packed >> 24n);
    const offsetSec = Number(packed & 0xFFFFFFn) - 86399;
    expect(micros).toBe((14 * 3600 + 30 * 60) * 1000000);
    expect(offsetSec).toBe(5 * 3600 + 30 * 60);
  });

  test('TIMESTAMP_SEC serializes from Date', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    const buf = makeResult([['v', 'TIMESTAMP_SEC']], [[d]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const secs = dv.getBigInt64(0, true);
    expect(secs).toBe(BigInt(Math.floor(d.getTime() / 1000)));
  });

  test('TIMESTAMP_MS serializes from Date', () => {
    const d = new Date('2024-01-15T12:00:00.500Z');
    const buf = makeResult([['v', 'TIMESTAMP_MS']], [[d]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ms = dv.getBigInt64(0, true);
    expect(ms).toBe(BigInt(d.getTime()));
  });

  test('TIMESTAMP_NS serializes from Date', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    const buf = makeResult([['v', 'TIMESTAMP_NS']], [[d]]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ns = dv.getBigInt64(0, true);
    expect(ns).toBe(BigInt(d.getTime()) * 1000000n);
  });

  test('INTERVAL serializes as 16-byte struct', () => {
    const buf = makeResult([['v', 'INTERVAL']], [['3 months 2 days 1.5 seconds']]);
    const result = readSuccessResult(buf);
    const bytes = result.chunks[0].vectors[0].data.bytes;
    expect(bytes.length).toBe(16);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(dv.getInt32(0, true)).toBe(3);    // months
    expect(dv.getInt32(4, true)).toBe(2);    // days
    expect(dv.getBigInt64(8, true)).toBe(1500000n); // micros
  });
});

// =============================================================================
// Vector wire format — string types
// =============================================================================

describe('vector wire format: string types', () => {
  test('VARCHAR serializes as string list', () => {
    const buf = makeResult([['v', 'VARCHAR']], [['hello'], ['world']]);
    const result = readSuccessResult(buf);
    const data = result.chunks[0].vectors[0].data;
    expect(data.kind).toBe('string');
    expect(data.values).toEqual(['hello', 'world']);
  });
});

// =============================================================================
// NULL handling — validity bitmaps
// =============================================================================

describe('NULL handling', () => {
  test('validity bitmap is set for NULLs', () => {
    const buf = makeResult([['v', 'INTEGER']], [[42], [null], [7]]);
    const result = readSuccessResult(buf);
    const vec = result.chunks[0].vectors[0];
    expect(vec.allValid).toBe(1);
    expect(vec.validity).toBeTruthy();
    // bit 0 = valid (42), bit 1 = invalid (null), bit 2 = valid (7)
    expect(vec.validity[0] & 0x01).toBe(1); // row 0 valid
    expect(vec.validity[0] & 0x02).toBe(0); // row 1 null
    expect(vec.validity[0] & 0x04).toBe(4); // row 2 valid
  });

  test('no validity bitmap when all valid', () => {
    const buf = makeResult([['v', 'INTEGER']], [[1], [2]]);
    const result = readSuccessResult(buf);
    const vec = result.chunks[0].vectors[0];
    expect(vec.allValid).toBe(0);
    expect(vec.validity).toBe(null);
  });
});

// =============================================================================
// mapDuckDBType coverage
// =============================================================================

describe('mapDuckDBType via type IDs', () => {
  function getTypeId(typeName) {
    const buf = makeResult([['v', typeName]], [[null]]);
    const result = readSuccessResult(buf);
    return result.types[0].id;
  }

  test('basic numeric types', () => {
    expect(getTypeId('BOOLEAN')).toBe(LogicalTypeId.BOOLEAN);
    expect(getTypeId('TINYINT')).toBe(LogicalTypeId.TINYINT);
    expect(getTypeId('SMALLINT')).toBe(LogicalTypeId.SMALLINT);
    expect(getTypeId('INTEGER')).toBe(LogicalTypeId.INTEGER);
    expect(getTypeId('BIGINT')).toBe(LogicalTypeId.BIGINT);
    expect(getTypeId('UTINYINT')).toBe(LogicalTypeId.UTINYINT);
    expect(getTypeId('USMALLINT')).toBe(LogicalTypeId.USMALLINT);
    expect(getTypeId('UINTEGER')).toBe(LogicalTypeId.UINTEGER);
    expect(getTypeId('UBIGINT')).toBe(LogicalTypeId.UBIGINT);
    expect(getTypeId('FLOAT')).toBe(LogicalTypeId.FLOAT);
    expect(getTypeId('DOUBLE')).toBe(LogicalTypeId.DOUBLE);
    expect(getTypeId('HUGEINT')).toBe(LogicalTypeId.HUGEINT);
    expect(getTypeId('UHUGEINT')).toBe(LogicalTypeId.UHUGEINT);
  });

  test('string types', () => {
    expect(getTypeId('VARCHAR')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('TEXT')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('STRING')).toBe(LogicalTypeId.VARCHAR);
  });

  test('temporal types', () => {
    expect(getTypeId('DATE')).toBe(LogicalTypeId.DATE);
    expect(getTypeId('TIME')).toBe(LogicalTypeId.TIME);
    expect(getTypeId('TIMESTAMP')).toBe(LogicalTypeId.TIMESTAMP);
    expect(getTypeId('TIMESTAMP_S')).toBe(LogicalTypeId.TIMESTAMP_SEC);
    expect(getTypeId('TIMESTAMP_MS')).toBe(LogicalTypeId.TIMESTAMP_MS);
    expect(getTypeId('TIMESTAMP_NS')).toBe(LogicalTypeId.TIMESTAMP_NS);
    expect(getTypeId('TIMESTAMP_TZ')).toBe(LogicalTypeId.TIMESTAMP_TZ);
    expect(getTypeId('TIME_TZ')).toBe(LogicalTypeId.TIME_TZ);
    expect(getTypeId('TIME_NS')).toBe(LogicalTypeId.TIME_NS);
    expect(getTypeId('INTERVAL')).toBe(LogicalTypeId.INTERVAL);
  });

  test('special types', () => {
    expect(getTypeId('UUID')).toBe(LogicalTypeId.UUID);
  });

  test('complex types fall back to VARCHAR', () => {
    expect(getTypeId('ENUM')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('LIST')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('STRUCT')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('MAP')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('ARRAY')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('UNION')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('BLOB')).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId('BIT')).toBe(LogicalTypeId.VARCHAR);
  });

  test('aliases', () => {
    expect(getTypeId('BOOL')).toBe(LogicalTypeId.BOOLEAN);
    expect(getTypeId('INT')).toBe(LogicalTypeId.INTEGER);
    expect(getTypeId('LONG')).toBe(LogicalTypeId.BIGINT);
    expect(getTypeId('FLOAT4')).toBe(LogicalTypeId.FLOAT);
    expect(getTypeId('FLOAT8')).toBe(LogicalTypeId.DOUBLE);
    expect(getTypeId('DATETIME')).toBe(LogicalTypeId.TIMESTAMP);
    expect(getTypeId('TIMESTAMPTZ')).toBe(LogicalTypeId.TIMESTAMP_TZ);
    expect(getTypeId('TIMETZ')).toBe(LogicalTypeId.TIME_TZ);
  });

  test('null/undefined type defaults to VARCHAR', () => {
    expect(getTypeId(null)).toBe(LogicalTypeId.VARCHAR);
    expect(getTypeId(undefined)).toBe(LogicalTypeId.VARCHAR);
  });
});

// =============================================================================
// SQL Tokenizer
// =============================================================================

describe('tokenizeSQL', () => {
  test('simple SELECT', () => {
    const tokens = tokenizeSQL('SELECT 42');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].type).toBe(4); // KEYWORD
    expect(tokens[1].type).toBe(1); // NUMERIC_CONSTANT
  });

  test('string constant', () => {
    const tokens = tokenizeSQL("SELECT 'hello'");
    expect(tokens).toHaveLength(2);
    expect(tokens[1].type).toBe(2); // STRING_CONSTANT
  });

  test('identifiers', () => {
    const tokens = tokenizeSQL('SELECT my_col FROM my_table');
    expect(tokens[1].type).toBe(0); // IDENTIFIER
    expect(tokens[3].type).toBe(0); // IDENTIFIER
  });

  test('operators', () => {
    const tokens = tokenizeSQL('SELECT a + b');
    const opToken = tokens.find(t => t.type === 3);
    expect(opToken).toBeTruthy();
  });

  test('comments', () => {
    const tokens = tokenizeSQL('SELECT 1 -- comment');
    const commentToken = tokens.find(t => t.type === 5);
    expect(commentToken).toBeTruthy();
  });

  test('block comments', () => {
    const tokens = tokenizeSQL('SELECT /* block */ 1');
    const commentToken = tokens.find(t => t.type === 5);
    expect(commentToken).toBeTruthy();
  });

  test('offsets are correct', () => {
    const tokens = tokenizeSQL('SELECT 42');
    expect(tokens[0].offset).toBe(0);
    expect(tokens[1].offset).toBe(7);
  });
});

// =============================================================================
// serializeTokenizeResult
// =============================================================================

describe('serializeTokenizeResult', () => {
  test('produces readable output', () => {
    const tokens = tokenizeSQL('SELECT 42');
    const buf = serializeTokenizeResult(tokens);
    const r = new BinaryReader(buf);

    // field 100: offsets list
    expect(r.readFieldId()).toBe(100);
    const offsetCount = r.readVarInt();
    expect(offsetCount).toBe(2);
    const o1 = r.readVarInt();
    const o2 = r.readVarInt();
    expect(o1).toBe(0);
    expect(o2).toBe(7);

    // field 101: types list
    expect(r.readFieldId()).toBe(101);
    const typeCount = r.readVarInt();
    expect(typeCount).toBe(2);
    const t1 = r.readVarInt();
    const t2 = r.readVarInt();
    expect(t1).toBe(4); // KEYWORD
    expect(t2).toBe(1); // NUMERIC_CONSTANT
  });
});
