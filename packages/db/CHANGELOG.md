# Changelog

All notable changes to `@rip-lang/db` and the `ripdb` DuckDB extension are
documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## M3 — Native DML write path

### Added

- **`ripdb` extension now supports native `INSERT` / `UPDATE` / `DELETE`
  against the remote DuckDB database.** Previously the extension was
  read-only and every DML statement returned a `PermissionException`.
- **Two-path DML strategy:**
  - **Source-AST passthrough** for the common case. The user's original
    SQL is sliced via `stmt_location` / `stmt_length`, reparsed, walked
    for safety, AST-rewritten to canonicalize the catalog qualifier
    (`r.t` → `main.t`), and POSTed to a new `/ddb/exec` endpoint.
  - **INSERT-only sink fallback** for `INSERT ... SELECT` whose source
    plan touches local DuckDB data. Child chunks are buffered locally,
    each cell is formatted into a typed SQL literal (`DATE 'x'`,
    `'12.34'::DECIMAL(p,s)`, etc.), and one multi-row
    `INSERT INTO main."t" VALUES (…), (…)` statement is sent in a single
    atomic request.
  - `UPDATE` / `DELETE` have **no fallback** — passthrough rejection
    throws `NotImplementedException` with workaround guidance.
- **New server endpoint: `POST /ddb/exec`** for DML execution. Returns a
  JSON envelope `{ok, kind: 'exec', statement_type, affected_rows, timeMs}`.
  `affected_rows` is a **decimal string** (avoids JS-number precision
  loss above 2^53 on huge tables).
- **New FFI bindings in `lib/duckdb.mjs`** (all following the established
  Bun-on-Linux-x64 `'u64'`/BigInt convention):
  - `duckdb_rows_changed`
  - `duckdb_extract_statements` (+ `_error` and `duckdb_destroy_extracted`)
- **`Connection.countStatements(sql)`** wrapper that uses DuckDB's own
  parser to count statements. Throws on parse failure (fail-closed).
- **`extension_test.cpp`** now runs 123 cases, including an INSERT/UPDATE/
  DELETE matrix, multi-`ripdb` USE-attack defense, NUL-byte attacks on
  both the source SQL and the `/ddb/exec` endpoint, multi-statement chain
  attacks, sink-fallback paths, fallback-VARCHAR write rejection, and
  fixture self-healing across re-runs.

### Changed

- **DuckDB `ATTACH` URLs: prefer `rip://` over `http://`.** This is the
  most user-visible behavior change and the most likely source of "DML
  appears broken" reports.

  ```sql
  -- Recommended
  ATTACH 'rip://localhost:4214' AS r (TYPE ripdb);

  -- Works for SELECT, but DML is silently disabled
  ATTACH 'http://localhost:4214' AS r (TYPE ripdb);
  ```

  Why: DuckDB's `DatabaseManager::AttachDatabase` resolves
  `IsRemoteFile(info.path)` *before* the `(TYPE ripdb)` clause is
  considered. `http://` and `https://` are in DuckDB's
  `EXTENSION_FILE_PREFIXES`, so an `http://` ATTACH whose `AccessMode`
  is `AUTOMATIC` (the default) gets silently bumped to `READ_ONLY` —
  every subsequent `INSERT` / `UPDATE` / `DELETE` is then refused by
  DuckDB's own read-only check before the `ripdb` planner even runs.
  `rip://` is not in the prefix map and keeps the access mode as
  `AUTOMATIC` → `READ_WRITE`.

  Bare `host:port` works the same as `rip://`. To opt in to read-only
  with the recommended scheme:

  ```sql
  ATTACH 'rip://localhost:4214' AS r (TYPE ripdb, READ_ONLY);
  ```

- **Identifier validation at attach time.** Remote table and column
  names must match `^[A-Za-z_][A-Za-z0-9_]*$`. Tables (or columns) with
  identifiers requiring quotes — Unicode characters, spaces, leading
  digits, etc. — are now skipped from the catalog with a clear printed
  warning instead of silently mis-routing on the wire. The SELECT
  scenarios that worked before may now show fewer tables when the
  remote schema contains unsafe names. This guard is what makes the
  AST rewriter and SQL emitter safe to round-trip without runtime
  identifier escaping; it can be lifted once URL-encoding lands on both
  sides of the wire.

- **`/ddb/run` row-limit semantics fixed.** Previously, an absent
  `x-duckdb-ui-result-row-limit` header silently truncated every scan
  at 10000 rows — the right default for the in-browser DuckDB UI but
  the wrong default for the `ripdb` extension and other non-UI
  clients, which assumed unlimited and silently lost data on tables
  larger than 10k rows. New semantics:

  | Header value | Behavior |
  |---|---|
  | absent | unlimited (correct default for non-UI clients) |
  | positive integer | hard cap at that count (UI behavior preserved) |
  | `0` or `-1` | unlimited (explicit opt-out for the UI) |

  This is technically a behavior change for any caller that was
  unintentionally relying on the silent 10k truncation, but matches
  what the docs always claimed.

### Security

- **No transport security in `rip-db` server.** The HTTP/1.1 listener
  has **no TLS and no authentication on the SQL endpoints**. The
  `/shutdown` endpoint is bearer-token-protected when bound non-locally.
  This is by design for the v1 trust model: `rip-db` is intended for
  **localhost or explicitly trusted networks only**.
  - Default bind address is `127.0.0.1` (loopback only).
  - Binding to `0.0.0.0` or any non-loopback address triggers a loud
    startup warning and disables `/shutdown` entirely unless
    `--auth-token` is supplied.
  - Anyone reachable on a non-loopback bind can issue arbitrary SQL
    against the server. Do not expose to untrusted networks.

- **The `ripdb` extension is the safety boundary, not the server.**
  The five-phase validation pipeline (NUL-byte rejection, single-
  statement enforcement, parser-AST reject list, multi-`ripdb`
  USE-attack defense, bound-plan dependency walk) lives in the
  extension. The server's `/ddb/exec` endpoint adds defense-in-depth
  (leading-keyword classification + `duckdb_extract_statements`-based
  single-statement enforcement + NUL rejection) but does NOT enforce
  the extension's full reject list. A direct HTTP caller bypassing the
  extension can issue any single, NUL-free `INSERT` / `UPDATE` /
  `DELETE` of their choice. This is acceptable because `/ddb/exec` is
  only reachable by callers that can already issue arbitrary SQL via
  `/sql`; it is not a privilege escalation.

- **Embedded NUL bytes in DML are refused** at multiple layers
  (extension-side pre-parse check, server-side request body check, and
  per-cell check inside the sink-fallback literal formatter). NULs do
  not survive HTTP-as-text transport and tooling truncates strings at
  the first NUL — the M3 write path refuses rather than silently
  truncating.

### Compatibility

- **Extension and server must be upgraded together.** The new extension
  requires the new server's `/ddb/exec` endpoint. Old extension against
  new server: read paths still work; the old extension never sends DML.
  New extension against old server: DML will fail with a 404 from
  `/ddb/exec` instead of mutating remote data.
- **Linux x64 builds are unchanged in their build/distribution path.**
  The `.duckdb_extension` for `linux_amd64` is built automatically by
  `.github/workflows/ripdb-extension.yml` against the pinned DuckDB
  v1.5.2 via DuckDB's `extension-ci-tools` reusable workflow, and
  published to
  `https://shreeve.github.io/rip-lang/extensions/duckdb/v1.5.2/linux_amd64/ripdb.duckdb_extension.gz`.
- **macOS `arm64` builds the same way**, published to the
  `osx_arm64/` subdirectory of the same path. `osx_amd64` is currently
  in the `exclude_archs` list; remove that string from the workflow if
  you need an Intel-Mac build.

### Notes

- The `/ddb/exec` endpoint is documented in `packages/db/CLI.md`
  §"Protocol and HTTP API".
- The `http://` vs `rip://` ATTACH gotcha is documented in
  `packages/db/CLI.md` §"ATTACH" and the
  `packages/db/extension/README.md` §"Troubleshooting" entry titled
  *"INSERT/UPDATE/DELETE fails with `attached in read-only mode`"*.
- The full M3 architecture (two-path strategy, layered safety, type
  emission table, server endpoint contract) is in
  `packages/db/AGENTS.md` §"DML write path (M3)".
