import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

let open, version, DUCKDB_TYPE, db, conn;
let available = false;

try {
  ({ open, version, DUCKDB_TYPE } = await import('../lib/duckdb.mjs'));
  available = true;
} catch {
  // DuckDB shared library not installed — tests will be skipped
}

const describeDB = available ? describe : describe.skip;

beforeAll(() => {
  if (!available) return;
  db = open(':memory:');
  conn = db.connect();
});

afterAll(() => {
  if (!available) return;
  conn.close();
  db.close();
});

// =============================================================================
// Lifecycle
// =============================================================================

describeDB('lifecycle', () => {
  test('open and close a database', () => {
    const d = open(':memory:');
    expect(d).toBeTruthy();
    d.close();
  });

  test('connect and disconnect', () => {
    const d = open(':memory:');
    const c = d.connect();
    expect(c).toBeTruthy();
    c.close();
    d.close();
  });

  test('version returns a string', () => {
    const v = version();
    expect(typeof v).toBe('string');
    expect(v).toMatch(/v?\d+\.\d+\.\d+/);
  });
});

// =============================================================================
// Basic queries
// =============================================================================

describeDB('basic queries', () => {
  test('SELECT literal integer', async () => {
    const rows = await conn.query('SELECT 42 AS num');
    expect(rows).toHaveLength(1);
    expect(rows[0].num).toBe(42);
  });

  test('SELECT literal string', async () => {
    const rows = await conn.query("SELECT 'hello' AS greeting");
    expect(rows).toHaveLength(1);
    expect(rows[0].greeting).toBe('hello');
  });

  test('SELECT multiple rows', async () => {
    const rows = await conn.query('SELECT * FROM range(5) t(i)');
    expect(rows).toHaveLength(5);
    expect(rows[0].i).toBe(0);
    expect(rows[4].i).toBe(4);
  });

  test('CREATE TABLE, INSERT, SELECT', async () => {
    await conn.query('CREATE TABLE test_basic (id INTEGER, name VARCHAR)');
    await conn.query("INSERT INTO test_basic VALUES (1, 'Alice'), (2, 'Bob')");
    const rows = await conn.query('SELECT * FROM test_basic ORDER BY id');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ id: 1, name: 'Alice' });
    expect(rows[1]).toEqual({ id: 2, name: 'Bob' });
    await conn.query('DROP TABLE test_basic');
  });

  test('columns metadata is attached to result', async () => {
    const rows = await conn.query('SELECT 1 AS a, 2 AS b');
    expect(rows.columns).toBeDefined();
    expect(rows.columns).toHaveLength(2);
    expect(rows.columns[0].name).toBe('a');
    expect(rows.columns[1].name).toBe('b');
  });
});

// =============================================================================
// Prepared statements
// =============================================================================

describeDB('prepared statements', () => {
  test('bind integer parameter', async () => {
    const rows = await conn.query('SELECT $1::INTEGER AS val', [42]);
    expect(rows[0].val).toBe(42);
  });

  test('bind string parameter', async () => {
    const rows = await conn.query('SELECT $1::VARCHAR AS val', ['hello']);
    expect(rows[0].val).toBe('hello');
  });

  test('bind null parameter', async () => {
    const rows = await conn.query('SELECT $1::INTEGER AS val', [null]);
    expect(rows[0].val).toBe(null);
  });

  test('bind boolean parameter', async () => {
    const rows = await conn.query('SELECT $1::BOOLEAN AS val', [true]);
    expect(rows[0].val).toBe(true);
  });

  test('bind double parameter', async () => {
    const rows = await conn.query('SELECT $1::DOUBLE AS val', [3.14]);
    expect(rows[0].val).toBeCloseTo(3.14);
  });

  test('bind bigint parameter', async () => {
    const rows = await conn.query('SELECT $1::BIGINT AS val', [9007199254740993n]);
    expect(rows[0].val).toBe(9007199254740993);
  });

  test('bind Date parameter', async () => {
    const d = new Date('2024-01-15T00:00:00Z');
    const rows = await conn.query('SELECT $1::TIMESTAMP AS val', [d]);
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('queryBatch executes multiple param sets', async () => {
    await conn.query('CREATE TABLE test_batch (id INTEGER, name VARCHAR)');
    const result = await conn.queryBatch(
      'INSERT INTO test_batch VALUES ($1, $2)',
      [[1, 'a'], [2, 'b'], [3, 'c']]
    );
    expect(result.rows).toBe(3);
    const rows = await conn.query('SELECT COUNT(*)::INTEGER AS cnt FROM test_batch');
    expect(rows[0].cnt).toBe(3);
    await conn.query('DROP TABLE test_batch');
  });
});

// =============================================================================
// Appender
// =============================================================================

describeDB('appender', () => {
  test('bulk insert with appender', async () => {
    await conn.query('CREATE TABLE test_append (id INTEGER, name VARCHAR, score DOUBLE)');
    const result = await conn.append('test_append', ['id', 'name', 'score'], [
      [1, 'Alice', 95.5],
      [2, 'Bob', 87.3],
      [3, 'Carol', 92.1],
    ]);
    expect(result.rows).toBe(3);
    const rows = await conn.query('SELECT * FROM test_append ORDER BY id');
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe('Alice');
    expect(rows[2].score).toBeCloseTo(92.1);
    await conn.query('DROP TABLE test_append');
  });
});

// =============================================================================
// Error handling
// =============================================================================

describeDB('error handling', () => {
  test('invalid SQL throws', async () => {
    expect(() => conn.query('SELCT INVALID')).toThrow();
  });

  test('prepare error throws', async () => {
    expect(() => conn.query('SELECT $1', [])).toThrow();
  });

  test('table not found throws', async () => {
    expect(() => conn.query('SELECT * FROM nonexistent_table')).toThrow();
  });
});

// =============================================================================
// Type reading — integers
// =============================================================================

describeDB('type reading: integers', () => {
  test('BOOLEAN', async () => {
    const rows = await conn.query('SELECT true AS t, false AS f');
    expect(rows[0].t).toBe(true);
    expect(rows[0].f).toBe(false);
  });

  test('TINYINT', async () => {
    const rows = await conn.query('SELECT 127::TINYINT AS val');
    expect(rows[0].val).toBe(127);
  });

  test('SMALLINT', async () => {
    const rows = await conn.query('SELECT 32000::SMALLINT AS val');
    expect(rows[0].val).toBe(32000);
  });

  test('INTEGER', async () => {
    const rows = await conn.query('SELECT 2147483647::INTEGER AS val');
    expect(rows[0].val).toBe(2147483647);
  });

  test('BIGINT', async () => {
    const rows = await conn.query('SELECT 9007199254740992::BIGINT AS val');
    expect(rows[0].val).toBe(9007199254740992);
  });

  test('UTINYINT', async () => {
    const rows = await conn.query('SELECT 255::UTINYINT AS val');
    expect(rows[0].val).toBe(255);
  });

  test('USMALLINT', async () => {
    const rows = await conn.query('SELECT 65535::USMALLINT AS val');
    expect(rows[0].val).toBe(65535);
  });

  test('UINTEGER', async () => {
    const rows = await conn.query('SELECT 4294967295::UINTEGER AS val');
    expect(rows[0].val).toBe(4294967295);
  });

  test('UBIGINT', async () => {
    const rows = await conn.query('SELECT 9007199254740992::UBIGINT AS val');
    expect(rows[0].val).toBe(9007199254740992);
  });
});

// =============================================================================
// Type reading — floats
// =============================================================================

describeDB('type reading: floats', () => {
  test('FLOAT', async () => {
    const rows = await conn.query('SELECT 3.14::FLOAT AS val');
    expect(rows[0].val).toBeCloseTo(3.14, 2);
  });

  test('DOUBLE', async () => {
    const rows = await conn.query('SELECT 3.141592653589793::DOUBLE AS val');
    expect(rows[0].val).toBeCloseTo(3.141592653589793);
  });
});

// =============================================================================
// Type reading — large integers
// =============================================================================

describeDB('type reading: large integers', () => {
  test('HUGEINT', async () => {
    const rows = await conn.query('SELECT 170141183460469231731687303715884105727::HUGEINT AS val');
    expect(rows[0].val).toBe('170141183460469231731687303715884105727');
  });

  test('UHUGEINT', async () => {
    const rows = await conn.query('SELECT 340282366920938463463374607431768211455::UHUGEINT AS val');
    expect(rows[0].val).toBe('340282366920938463463374607431768211455');
  });
});

// =============================================================================
// Type reading — strings
// =============================================================================

describeDB('type reading: strings', () => {
  test('VARCHAR', async () => {
    const rows = await conn.query("SELECT 'hello world'::VARCHAR AS val");
    expect(rows[0].val).toBe('hello world');
  });

  test('VARCHAR empty', async () => {
    const rows = await conn.query("SELECT ''::VARCHAR AS val");
    expect(rows[0].val).toBe('');
  });

  test('BLOB', async () => {
    const rows = await conn.query("SELECT '\\x48454C4C4F'::BLOB AS val");
    expect(rows[0].val).toBeTruthy();
  });
});

// =============================================================================
// Type reading — temporal
// =============================================================================

describeDB('type reading: temporal', () => {
  test('DATE', async () => {
    const rows = await conn.query("SELECT '2024-03-15'::DATE AS val");
    expect(rows[0].val).toBe('2024-03-15');
  });

  test('TIME', async () => {
    const rows = await conn.query("SELECT '14:30:00'::TIME AS val");
    expect(rows[0].val).toBe('14:30:00');
  });

  test('TIME with microseconds', async () => {
    const rows = await conn.query("SELECT '14:30:00.123456'::TIME AS val");
    expect(rows[0].val).toBe('14:30:00.123456');
  });

  test('TIMESTAMP', async () => {
    const rows = await conn.query("SELECT '2024-03-15 14:30:00'::TIMESTAMP AS val");
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('TIMESTAMP_S', async () => {
    const rows = await conn.query("SELECT '2024-03-15 14:30:00'::TIMESTAMP_S AS val");
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('TIMESTAMP_MS', async () => {
    const rows = await conn.query("SELECT '2024-03-15 14:30:00'::TIMESTAMP_MS AS val");
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('TIMESTAMP_NS', async () => {
    const rows = await conn.query("SELECT '2024-03-15 14:30:00'::TIMESTAMP_NS AS val");
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('TIMESTAMP WITH TIME ZONE', async () => {
    const rows = await conn.query("SELECT '2024-03-15 14:30:00+00'::TIMESTAMPTZ AS val");
    expect(rows[0].val).toBeInstanceOf(Date);
  });

  test('TIME WITH TIME ZONE', async () => {
    const rows = await conn.query("SELECT '14:30:00+05:30'::TIMETZ AS val");
    expect(rows[0].val).toMatch(/14:30:00/);
    expect(rows[0].val).toMatch(/[+-]\d{2}:\d{2}/);
  });

  test('INTERVAL', async () => {
    const rows = await conn.query("SELECT INTERVAL '3 months 2 days 1.5 seconds' AS val");
    expect(rows[0].val).toContain('3 months');
    expect(rows[0].val).toContain('2 days');
    expect(rows[0].val).toContain('second');
  });
});

// =============================================================================
// Type reading — special
// =============================================================================

describeDB('type reading: special', () => {
  test('UUID', async () => {
    const rows = await conn.query("SELECT 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID AS val");
    expect(rows[0].val).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  test('DECIMAL', async () => {
    const rows = await conn.query("SELECT 123.456::DECIMAL(10,3) AS val");
    expect(rows[0].val).toBe('123.456');
  });

  test('ENUM', async () => {
    await conn.query("CREATE TYPE mood AS ENUM ('happy', 'sad', 'neutral')");
    await conn.query("CREATE TABLE test_enum (m mood)");
    await conn.query("INSERT INTO test_enum VALUES ('happy'), ('sad')");
    const rows = await conn.query('SELECT m FROM test_enum ORDER BY m');
    expect(rows[0].m).toBe('happy');
    expect(rows[1].m).toBe('sad');
    await conn.query('DROP TABLE test_enum');
    await conn.query('DROP TYPE mood');
  });
});

// =============================================================================
// Type reading — nested
// =============================================================================

describeDB('type reading: nested', () => {
  test('LIST of integers', async () => {
    const rows = await conn.query('SELECT [1, 2, 3] AS val');
    expect(rows[0].val).toEqual([1, 2, 3]);
  });

  test('LIST with NULL', async () => {
    const rows = await conn.query('SELECT [1, NULL, 3] AS val');
    expect(rows[0].val).toEqual([1, null, 3]);
  });

  test('STRUCT', async () => {
    const rows = await conn.query("SELECT {'name': 'Alice', 'age': 30} AS val");
    expect(rows[0].val).toEqual({ name: 'Alice', age: 30 });
  });

  test('MAP', async () => {
    const rows = await conn.query("SELECT MAP {'a': 1, 'b': 2} AS val");
    expect(rows[0].val).toEqual({ a: 1, b: 2 });
  });

  test('ARRAY (fixed-size)', async () => {
    const rows = await conn.query("SELECT [1, 2, 3]::INT[3] AS val");
    expect(rows[0].val).toEqual([1, 2, 3]);
  });
});

// =============================================================================
// NULL handling
// =============================================================================

describeDB('NULL handling', () => {
  test('NULL integer', async () => {
    const rows = await conn.query('SELECT NULL::INTEGER AS val');
    expect(rows[0].val).toBe(null);
  });

  test('NULL varchar', async () => {
    const rows = await conn.query('SELECT NULL::VARCHAR AS val');
    expect(rows[0].val).toBe(null);
  });

  test('mixed NULL and non-NULL', async () => {
    const rows = await conn.query(
      "SELECT * FROM (VALUES (1, 'a'), (NULL, 'b'), (3, NULL)) t(id, name)"
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe(1);
    expect(rows[1].id).toBe(null);
    expect(rows[2].name).toBe(null);
  });
});

// =============================================================================
// DUCKDB_TYPE enum correctness
// =============================================================================

describeDB('DUCKDB_TYPE enum', () => {
  test('TIMESTAMP_TZ is 31 (not 32)', () => {
    expect(DUCKDB_TYPE.TIMESTAMP_TZ).toBe(31);
  });

  test('UHUGEINT is 32', () => {
    expect(DUCKDB_TYPE.UHUGEINT).toBe(32);
  });

  test('TIME_TZ is 30', () => {
    expect(DUCKDB_TYPE.TIME_TZ).toBe(30);
  });

  test('ARRAY is 33', () => {
    expect(DUCKDB_TYPE.ARRAY).toBe(33);
  });

  test('TIME_NS is 39', () => {
    expect(DUCKDB_TYPE.TIME_NS).toBe(39);
  });
});
