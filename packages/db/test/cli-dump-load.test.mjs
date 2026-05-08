// =============================================================================
// cli-dump-load.test.mjs — round-trip integration test for `rip-db dump|load`.
// =============================================================================
//
// Spawns two ephemeral `:memory:` rip-db servers, seeds the source with a
// small typed schema (covering INTEGER/VARCHAR/DECIMAL/TIMESTAMP/NULL +
// custom enum types — same shape medlabs uses), then:
//
//   1. `rip-db dump` from the source server  → tar.gz on disk
//   2. `rip-db load`  into the empty target server
//   3. assert table list, row counts, and a representative typed value
//      round-tripped exactly
//
// This is the safety net for a feature that silently regresses easily —
// temp-dir handling, tar flags, SQL string escaping, archive layout,
// EXPORT/IMPORT semantics, and the empty-DB precheck all flow through here.
// =============================================================================

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import net from 'node:net';
import path from 'node:path';
import { existsSync, mkdtempSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE   = path.dirname(fileURLToPath(import.meta.url));
const PKG    = path.resolve(HERE, '..');
const RIP_DB = path.join(PKG, 'bin', 'rip-db');
const DB_RIP = path.join(PKG, 'db.rip');

// -----------------------------------------------------------------------------
// Helpers (mirrored from http-integration.test.mjs — kept inline so this test
// file is self-contained and can be deleted/moved without breaking the other.)
// -----------------------------------------------------------------------------

async function freePort() {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  const proc = Bun.spawn(['rip', DB_RIP, ':memory:', `--port=${port}`], {
    cwd: PKG,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env },
  });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) break;
    } catch (e) { lastErr = e; }
    await new Promise(r => setTimeout(r, 100));
  }
  if (Date.now() >= deadline) {
    try { proc.kill(); } catch {}
    throw new Error(`rip-db did not become healthy within 10s: ${lastErr?.message ?? 'unknown'}`);
  }
  return {
    url, port, proc,
    async stop() {
      try { proc.kill('SIGTERM'); } catch {}
      try { await proc.exited; } catch {}
    },
  };
}

const sql = async (url, query) => {
  const res = await fetch(`${url}/sql`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sql: query }),
  });
  if (!res.ok) throw new Error(`/sql ${res.status}: ${await res.text()}`);
  return res.json();
};

const ripDb = (env, ...args) => {
  const proc = Bun.spawnSync([RIP_DB, ...args], {
    env: { ...Bun.env, ...env },
  });
  return {
    code:   proc.exitCode,
    stdout: new TextDecoder().decode(proc.stdout),
    stderr: new TextDecoder().decode(proc.stderr),
  };
};

// -----------------------------------------------------------------------------
// Guard: same shape as http-integration.test.mjs — skip when toolchain absent.
// -----------------------------------------------------------------------------

let canRun = false;
try {
  await import('../lib/duckdb.mjs');
  canRun = Bun.which('rip') !== null && Bun.which('tar') !== null;
} catch {}
const describeIf = canRun ? describe : describe.skip;

// =============================================================================
// Suite
// =============================================================================

describeIf('rip-db dump / load round-trip', () => {
  let src, dst, archive, workDir;

  beforeAll(async () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'ripdb-roundtrip-'));
    archive = path.join(workDir, 'snapshot.tar.gz');
    src = await startServer();
    dst = await startServer();

    // Seed source with a representative typed schema. INTEGER PK + VARCHAR +
    // DECIMAL(10,2) + TIMESTAMP + NULL + custom enum — covers the medlabs
    // shape and exercises type round-tripping through CSV.
    await sql(src.url, "CREATE TYPE order_status AS ENUM ('draft','submitted','complete')");
    await sql(src.url, `
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer VARCHAR NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes VARCHAR,
        status order_status NOT NULL DEFAULT 'draft'
      )
    `);
    await sql(src.url, `
      INSERT INTO orders (id, customer, amount, notes, status) VALUES
        (1, 'Alice',  12.50, NULL,           'draft'),
        (2, 'Bob',   100.00, 'rush order',   'submitted'),
        (3, 'Carol',   0.05, '',             'complete')
    `);
  });

  afterAll(async () => {
    if (src) await src.stop();
    if (dst) await dst.stop();
    if (workDir) rmSync(workDir, { recursive: true, force: true });
  });

  test('--help prints usage and exits 0', () => {
    for (const cmd of ['dump', 'load']) {
      const r = ripDb({}, cmd, '--help');
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(`Usage: rip-db ${cmd}`);
      expect(r.stdout).toContain('RIPDB_URL');
    }
  });

  test('dump produces a non-empty .tar.gz with schema.sql + load.sql + table CSVs', () => {
    const r = ripDb({ RIPDB_URL: src.url }, 'dump', archive);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('wrote');
    expect(existsSync(archive)).toBe(true);
    expect(statSync(archive).size).toBeGreaterThan(0);

    // Inspect the archive contents without extracting.
    const list = Bun.spawnSync(['tar', '-tzf', archive]);
    const entries = new TextDecoder().decode(list.stdout).split('\n');
    expect(entries).toContain('./schema.sql');
    expect(entries).toContain('./load.sql');
    expect(entries.some(e => e.endsWith('orders.csv'))).toBe(true);
  });

  test('load.sql in archive uses paths relative to the dump dir', () => {
    // Extract just load.sql to stdout and inspect its contents.
    const out = Bun.spawnSync(['tar', '-xzOf', archive, './load.sql']);
    const loadSql = new TextDecoder().decode(out.stdout);
    // Each COPY should reference the bare CSV basename, not an absolute path.
    expect(loadSql).toContain("FROM 'orders.csv'");
    // The original /tmp/ripdb-XXXX prefix must be gone — the rewrite is
    // what makes the archive relocatable for direct load.sql replay.
    expect(loadSql).not.toContain('/tmp/');
    expect(loadSql).not.toContain('/ripdb-');
  });

  test('schema.sql in archive has no doubled `;;` and no trailing blank line', () => {
    const out = Bun.spawnSync(['tar', '-xzOf', archive, './schema.sql']);
    const schemaSql = new TextDecoder().decode(out.stdout);
    // No statement ends in two or three semicolons — that's the upstream
    // DuckDB cosmetic bug we strip in cleanupSchemaSql().
    expect(schemaSql).not.toMatch(/;;/);
    // File ends with exactly one newline (no trailing blank lines).
    expect(schemaSql).toMatch(/[^\n]\n$/);
    // Sanity: the actual statements survived.
    expect(schemaSql).toContain('CREATE TYPE order_status');
    expect(schemaSql).toContain('CREATE TABLE orders');
  });

  test('refuses to overwrite an existing archive', () => {
    const r = ripDb({ RIPDB_URL: src.url }, 'dump', archive);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('refusing to overwrite');
  });

  test('load restores schema, row count, and typed values into an empty target', async () => {
    const r = ripDb({ RIPDB_URL: dst.url }, 'load', archive);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('loaded');

    // Tables came back.
    const tables = await fetch(`${dst.url}/tables`).then(x => x.json());
    expect(tables.tables).toContain('orders');

    // Row count matches the source.
    const count = await sql(dst.url, 'SELECT count(*) FROM orders');
    expect(Number(count.data[0][0])).toBe(3);

    // Typed values preserved through CSV — DECIMAL precision, NULL, enum.
    const row = await sql(dst.url, "SELECT amount, notes, status FROM orders WHERE id = 1");
    expect(String(row.data[0][0])).toBe('12.50');
    expect(row.data[0][1]).toBe(null);
    expect(row.data[0][2]).toBe('draft');
  });

  test('load refuses if target database already has tables', () => {
    // Target is now populated from the previous test — second load must reject.
    const r = ripDb({ RIPDB_URL: dst.url }, 'load', archive);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('target database is not empty');
  });

  test('load fails clearly on a missing archive', () => {
    const r = ripDb({ RIPDB_URL: src.url }, 'load', path.join(workDir, 'nope.tar.gz'));
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('no such file');
  });

  test('dump fails clearly when the server is unreachable', () => {
    const dead = path.join(workDir, 'should-not-exist.tar.gz');
    const r = ripDb({ RIPDB_URL: 'http://127.0.0.1:1' }, 'dump', dead);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('could not reach rip-db');
    expect(existsSync(dead)).toBe(false);
  });

  test('dump into an existing directory drops an auto-named archive inside it', () => {
    const intoDir = mkdtempSync(path.join(tmpdir(), 'ripdb-dropdir-'));
    try {
      const r = ripDb({ RIPDB_URL: src.url }, 'dump', intoDir);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain('wrote');
      // The auto-named archive should land inside the target directory.
      const written = Bun.spawnSync(['ls', intoDir]);
      const entries = new TextDecoder().decode(written.stdout).split('\n').filter(Boolean);
      expect(entries.length).toBe(1);
      expect(entries[0]).toMatch(/^.+-\d{8}-\d{6}\.tar\.gz$/);
    } finally {
      rmSync(intoDir, { recursive: true, force: true });
    }
  });

  test('dump rejects a path that is neither a directory nor a .tar.gz/.tgz file', () => {
    const weird = path.join(workDir, 'snapshot.zip');
    const r = ripDb({ RIPDB_URL: src.url }, 'dump', weird);
    expect(r.code).not.toBe(0);
    expect(r.stderr).toContain('must end in .tar.gz or .tgz');
    expect(existsSync(weird)).toBe(false);
  });
});
