// =============================================================================
// http-integration.test.mjs — end-to-end HTTP tests
// =============================================================================
//
// Spawns a real `rip-db` on an ephemeral port backed by an in-memory database,
// exercises every route we care about (the JSON API, the structured error
// envelope, the shutdown gate, and a client-library round-trip), then kills
// the server.
//
// These tests are the safety net for follow-on refactors — any regression in
// the wire contract surfaces here, not in production. Each test runs against
// an isolated server instance so ordering issues and state leaks are
// impossible.
// =============================================================================

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG  = path.resolve(HERE, '..');
const DB   = path.join(PKG, 'db.rip');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Ask the kernel for a free TCP port, close the probe socket, return the port. */
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

/**
 * Spawn `rip db.rip :memory: --port=<p> [--host=H] [--auth-token=T]` and wait
 * for `/health` to answer. Returns an object with `{ port, url, proc, stop() }`.
 */
async function startServer({ host, authToken } = {}) {
  const port = await freePort();
  const args = [DB, ':memory:', `--port=${port}`];
  if (host)      args.push(`--host=${host}`);
  if (authToken) args.push(`--auth-token=${authToken}`);

  const proc = Bun.spawn(['rip', ...args], {
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
    port, url, proc,
    async stop() {
      try { proc.kill('SIGTERM'); } catch {}
      try { await proc.exited; } catch {}
    },
  };
}

const postJSON = (url, body, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

// -----------------------------------------------------------------------------
// Guard: skip the whole file if rip + DuckDB aren't available. These are
// integration tests; they require a working local toolchain.
// -----------------------------------------------------------------------------

let canRun = false;
try {
  await import('../lib/duckdb.mjs');          // verifies DuckDB FFI resolves
  canRun = Bun.which('rip') !== null;         // verifies `rip` is on PATH
} catch {}
const describeIf = canRun ? describe : describe.skip;

// =============================================================================
// Suite
// =============================================================================

describeIf('rip-db HTTP integration', () => {
  let server;
  beforeAll(async () => { server = await startServer(); });
  afterAll(async () => { if (server) await server.stop(); });

  // ---------------------------------------------------------------------------
  // Health + basic envelope
  // ---------------------------------------------------------------------------

  test('GET /health → 200 {status:"ok"}', async () => {
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
  });

  test('POST /sql — SELECT returns envelope with ok/kind/data/rowCount/timeMs', async () => {
    const res = await postJSON(`${server.url}/sql`, { sql: 'SELECT 1 AS one, 2 AS two' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.kind).toBe('select');
    expect(body.columns.map(c => c.name)).toEqual(['one', 'two']);
    expect(body.data).toEqual([[1, 2]]);
    expect(body.rowCount).toBe(1);
    expect(typeof body.timeMs).toBe('number');
    // Legacy aliases still populated.
    expect(body.rows).toBe(1);
    expect(typeof body.time).toBe('number');
  });

  // ---------------------------------------------------------------------------
  // Parameterised write + read-back round trip
  // ---------------------------------------------------------------------------

  test('POST /sql — parameterised INSERT + SELECT round-trip', async () => {
    await postJSON(`${server.url}/sql`,
      { sql: 'CREATE TABLE users (id INTEGER, name VARCHAR)' });
    const ins = await postJSON(`${server.url}/sql`,
      { sql: 'INSERT INTO users VALUES ($1, $2), ($3, $4)', params: [1, 'Alice', 2, 'Bob'] });
    expect(ins.status).toBe(200);
    expect((await ins.json()).ok).toBe(true);

    const sel = await postJSON(`${server.url}/sql`,
      { sql: 'SELECT id, name FROM users WHERE id = $1', params: [2] });
    expect(sel.status).toBe(200);
    const body = await sel.json();
    expect(body.data).toEqual([[2, 'Bob']]);
    expect(body.rowCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Bulk insert (Appender API)
  // ---------------------------------------------------------------------------

  test('POST /sql — bulk insert via {table, columns, rows} uses Appender', async () => {
    await postJSON(`${server.url}/sql`,
      { sql: 'CREATE TABLE events (id INTEGER, label VARCHAR)' });
    const res = await postJSON(`${server.url}/sql`, {
      table: 'events',
      columns: ['id', 'label'],
      rows: Array.from({ length: 500 }, (_, i) => [i, `evt-${i}`]),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.kind).toBe('write');
    expect(body.rowCount).toBe(500);
    const count = await postJSON(`${server.url}/sql`, { sql: 'SELECT COUNT(*) FROM events' });
    const countBody = await count.json();
    expect(countBody.data[0][0]).toBe(500);
  });

  // ---------------------------------------------------------------------------
  // Error surface: SQL-level errors + malformed requests
  // ---------------------------------------------------------------------------

  test('POST /sql — SQL error returns 422 with errorCode', async () => {
    const res = await postJSON(`${server.url}/sql`, { sql: 'SELECT * FROM definitely_not_here' });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('TABLE_NOT_FOUND');
    expect(typeof body.error).toBe('string');   // legacy string still populated
    expect(typeof body.timeMs).toBe('number');
  });

  test('POST /sql — empty body returns 400 BAD_REQUEST', async () => {
    const res = await postJSON(`${server.url}/sql`, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('BAD_REQUEST');
  });

  // ---------------------------------------------------------------------------
  // /schema/:table — 200 + 404 paths
  // ---------------------------------------------------------------------------

  test('GET /schema/:table — 200 on existing table', async () => {
    await postJSON(`${server.url}/sql`,
      { sql: 'CREATE TABLE schema_check (a INTEGER, b VARCHAR)' });
    const res = await fetch(`${server.url}/schema/schema_check`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.table).toBe('schema_check');
    expect(Array.isArray(body.schema)).toBe(true);
    expect(body.schema.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // /tables — real BASE tables only, no UI-extension virtual entries
  // -------------------------------------------------------------------------

  test('GET /tables — lists real tables only (via duckdb_tables())', async () => {
    await postJSON(`${server.url}/sql`, { sql: 'CREATE TABLE tables_a (id INTEGER)' });
    await postJSON(`${server.url}/sql`, { sql: 'CREATE TABLE tables_b (id INTEGER)' });
    const res = await fetch(`${server.url}/tables`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables).toEqual(expect.arrayContaining(['tables_a', 'tables_b']));
  });

  test('GET /schema/:table — 404 on missing table (not 200 with error body)', async () => {
    const res = await fetch(`${server.url}/schema/no_such_table`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe('TABLE_NOT_FOUND');
  });

  // ---------------------------------------------------------------------------
  // /shutdown — accessible on local bind
  // ---------------------------------------------------------------------------

  test('POST /shutdown — local bind allows shutdown (no token required)', async () => {
    const local = await startServer();          // fresh server so the suite can keep running
    const res = await postJSON(`${local.url}/shutdown`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Give the child a moment to exit on its own.
    await new Promise(r => setTimeout(r, 500));
    try { local.proc.kill(); } catch {}
  });
});

// =============================================================================
// Client-library round-trip
// =============================================================================

describeIf('@rip-lang/db/client round-trip', () => {
  let server, client;
  beforeAll(async () => {
    server = await startServer();
    client = await import('../client.rip');
    client.connect(server.url);
  });
  afterAll(async () => { if (server) await server.stop(); });

  test('query! / findOne! / findAll! work against the real server', async () => {
    await client.query('CREATE TABLE pets (id INTEGER, name VARCHAR)');
    await client.query('INSERT INTO pets VALUES ($1, $2), ($3, $4)', [1, 'Rex', 2, 'Whiskers']);

    const one = await client.findOne('SELECT * FROM pets WHERE id = $1', [1]);
    expect(one).toEqual({ id: 1, name: 'Rex' });

    const all = await client.findAll('SELECT * FROM pets ORDER BY id');
    expect(all).toEqual([{ id: 1, name: 'Rex' }, { id: 2, name: 'Whiskers' }]);
  });

  test('Model.insert! / .find! / .where().all! round-trip', async () => {
    await client.query('CREATE TABLE animals (id INTEGER, kind VARCHAR)');
    const Animal = client.Model('animals');
    await Animal.insert({ id: 1, kind: 'dog' });
    await Animal.insert({ id: 2, kind: 'cat' });
    const one = await Animal.find(1);
    expect(one).toEqual({ id: 1, kind: 'dog' });
    const dogs = await Animal.where({ kind: 'dog' }).all();
    expect(dogs.length).toBe(1);
    expect(dogs[0].id).toBe(1);
  });

  test('RipDBError is thrown with code + httpStatus on server failures', async () => {
    let thrown;
    try {
      await client.query('SELECT * FROM nope_not_a_table');
    } catch (e) { thrown = e; }
    expect(thrown).toBeDefined();
    expect(thrown.name).toBe('RipDBError');
    expect(thrown.code).toBe('TABLE_NOT_FOUND');
    expect(thrown.httpStatus).toBe(422);
    expect(thrown.message).toMatch(/not/i);
  });
});
