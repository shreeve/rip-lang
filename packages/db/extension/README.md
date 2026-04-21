# `ripdb` — native DuckDB CLI integration (work in progress)

This directory is the implementation of the plan in
[`packages/db/CLI.md`](../CLI.md). That document is the load-bearing spec;
this README just tracks what's been landed here.

## Status

| Commit | Scope                                                                   | Status |
|--------|--------------------------------------------------------------------------|--------|
| **1**  | Decoder + standalone golden-test harness, **no DuckDB linkage**          | ✅ landed |
| **2**  | `ripdb.cpp` catalog + scan + `StorageExtension`, in-process driver, real `.duckdb_extension` via stock `duckdb -unsigned` | ✅ landed |
| 3      | Predicate pushdown, chunked HTTP, parallel scan                          | planned |
| 4      | Write forwarding + DDL + native DECIMAL + upstream PR                    | planned |

## Layout

```
packages/db/extension/
├── decoder.{h,cpp}             Commit 1 — standalone decoder (no DuckDB headers)
├── ripdb.cpp                   Commit 2 — the extension itself: catalog + scan
│                                + transaction manager + storage extension
│                                + DUCKDB_CPP_EXTENSION_ENTRY entry point
├── decoder_test.cpp            Commit 1 golden-test harness
├── extension_test.cpp          Commit 2 Phase 2A in-process smoke driver
├── build.sh                    Commit 1 test build
├── build-extension.sh          Commit 2 Phase 2A build (links libduckdb, runs
│                                extension_test against rip-db on :4214)
├── build-loadable.sh           Commit 2 Phase 2B build — compiles
│                                ripdb.duckdb_extension as a shared library
│                                and appends the 534-byte metadata footer so it
│                                loads via `duckdb -unsigned / LOAD '...'`
├── scripts/
│   ├── capture-fixtures.rip    Commit 1 — encoder-driven fixture generator
│   ├── capture-live.rip        Commit 1 — live /ddb/run integration capture
│   └── smoke-server.rip        Commit 2 — :memory: rip-db seeded with two
│                                tables used by extension_test
└── test/fixtures/              Commit 1 — see fixtures/README.md for the format spec
    ├── types/<type>/<pattern>.{bin,golden}    190 encoder-driven fixtures
    ├── envelopes/{error_*,zero_rows_*,multichunk_*}.{bin,golden}
    ├── malformed/*.{bin,reject}               8 adversarial-byte fixtures
    ├── integration/{small_mixed,multichunk}.{bin,info}
    └── manifest.json
```

## Build & run

### Commit 1 — decoder golden tests (no DuckDB needed)

```
./build.sh                    # compile and run tests; exit 0 on all-pass
./build.sh --no-run           # compile only
./decoder_test test/fixtures  # run tests against a specific fixture root
```

### Commit 2 — the extension itself

Prerequisite: build DuckDB from `misc/duckdb/` once (~2.5 minutes):

```
cd ../../../misc/duckdb && make release
```

Then, in one terminal, start the seeded rip-db smoke server:

```
rip packages/db/extension/scripts/smoke-server.rip   # serves on :4214
```

In another terminal, either:

```
# Phase 2A — in-process driver (fast iteration, no packaging)
./build-extension.sh           # compiles + runs extension_test (14 assertions)

# Phase 2B — real .duckdb_extension + stock CLI
./build-loadable.sh            # produces ripdb.duckdb_extension with metadata footer
../../../misc/duckdb/build/release/duckdb -unsigned -c \
  "LOAD '$PWD/ripdb.duckdb_extension';
   ATTACH 'rip://localhost:4214' AS rip (TYPE ripdb);
   SHOW TABLES FROM rip;
   SELECT count(*) FROM rip.smoke_orders;"
```

### Publishing / consuming via a custom repository

The [`.github/workflows/ripdb-extension.yml`](../../../.github/workflows/ripdb-extension.yml)
workflow builds `ripdb.duckdb_extension` for four native platforms
(`osx_arm64`, `osx_amd64`, `linux_amd64`, `linux_arm64`), gzips each one,
and commits the tree into `docs/extensions/duckdb/` on `main`. The
existing Pages site (served from `main /docs`) then exposes them at the
DuckDB-custom-repository URL layout:

```
https://shreeve.github.io/rip-lang/extensions/duckdb/<duckdb_version>/<platform>/ripdb.duckdb_extension.gz
```

End-users consume it with:

```sql
SET allow_unsigned_extensions = true;
INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';
LOAD ripdb;
```

The workflow triggers on pushes to the extension sources (rebuilds against
the default `v1.5.2` DuckDB) or via **Actions → Build ripdb DuckDB extension
→ Run workflow** when you want to override the DuckDB or ripdb version. Each
run only touches its `<duckdb_version>/<platform>/` cell — previous versions
stay put, so multiple DuckDB releases are supported simultaneously.

No manual Pages setup is needed: the existing `main /docs` Pages source
picks up the new `docs/extensions/duckdb/` subtree automatically.

#### How DuckDB picks the right build

Client-side DuckDB already knows its own version and platform and builds
the full URL itself. When a user runs
`INSTALL ripdb FROM '<base>'`, DuckDB fetches exactly:

```
<base>/<duckdb_version>/<platform>/ripdb.duckdb_extension.gz
```

and then cross-checks the 534-byte metadata footer inside the file
against its own version + platform before loading. The URL path *is* the
version-routing mechanism — the client never has to know what versions
you publish. If the user's DuckDB version isn't in the published tree
(e.g. they're on `v1.4.0` but we only publish `v1.5.2`), the fetch
returns 404 and they get a clear install error pointing at the missing
version. The fix is to run the workflow again with that DuckDB version
as input — it adds a new `v1.4.0/` subfolder alongside the existing
ones and both DuckDB releases work simultaneously.

#### Quick end-to-end verification

After the workflow publishes the first build, a user can sanity-check
everything without any DuckDB session state:

```bash
# 1) Which DuckDB are you running?
duckdb -csv -noheader -c "SELECT library_version FROM pragma_version()"
# → v1.5.2

# 2) Which platform?
duckdb -csv -noheader -c "PRAGMA platform"
# → osx_arm64

# 3) Is a build published for that exact (version, platform) pair?
curl -I "https://shreeve.github.io/rip-lang/extensions/duckdb/v1.5.2/osx_arm64/ripdb.duckdb_extension.gz"
# → HTTP/2 200 with content-type: application/octet-stream
```

If step 3 returns **200**, the install will succeed. If it returns
**404**, the (version, platform) cell hasn't been published yet — run
the workflow with the missing version as input.

### Regenerating fixtures

```
rip packages/db/extension/scripts/capture-fixtures.rip   # encoder-driven (deterministic)
rip packages/db/extension/scripts/capture-live.rip       # live /ddb/run (spins up rip-db on :4214)
```

Both scripts are committed-output-idempotent — re-running must produce
byte-identical output. If it doesn't, the encoder or the capture script
changed; the diff is the review.

## What this commit tests

* All **26 native-wire types** round-trip: BOOLEAN, TINYINT/UTINYINT,
  SMALLINT/USMALLINT, INTEGER/UINTEGER, BIGINT/UBIGINT, HUGEINT/UHUGEINT,
  FLOAT, DOUBLE, DATE, TIME/TIME_NS/TIME_TZ, TIMESTAMP/TIMESTAMP_SEC/MS/NS/TZ,
  INTERVAL, UUID, VARCHAR, CHAR.
* The four **Tier-2 types** (UUID, TIME_TZ, HUGEINT/UHUGEINT, INTERVAL) are
  decoded via explicit per-row reads — no memcpy fast paths anywhere in
  Commit 1, including Tier-1. Every type passes with the slow path, which
  becomes the oracle for any future fast-path optimization.
* **Six null patterns per type**: `all_valid`, `all_null`, `alternating`,
  `every_64th`, `partial_word`, `bursty`. The bursty pattern is deliberately
  irregular (non-periodic) to catch indexing bugs that accidentally pass
  symmetric patterns.
* **Multi-chunk** decoding with partial-word last chunks
  (via the new `chunkSize` option on `serializeSuccessResult`).
* **Error envelopes** and degenerate success envelopes (zero rows + N
  columns, zero rows + zero columns).
* **Malformed / adversarial inputs** — decoder rejects with a stable-enough
  message substring to assert in tests.
* **Live integration** — bytes captured from a real rip-db server against
  a :memory: database are decoded and structural metadata (row count,
  column count, chunk count) matches the `.info` sidecar.

## What this commit deliberately does not do

* No DuckDB headers are included and nothing links against DuckDB.
* No `DataChunk` / `Vector` / `StringVector::AddString` / catalog / scan
  function code. Commit 2 adds those on top of a decoder that's already
  proven correct here.
* No memcpy fast paths, even for Tier-1 numeric types. Any such path is
  added later, gated on a byte-equivalence test against this slow path over
  the existing fixture matrix.

## Server-side changes landed alongside

* `packages/db/lib/duckdb-binary.rip` — `serializeSuccessResult` accepts an
  optional `opts.chunkSize` parameter that splits a result into N chunks of
  that size (last chunk may be partial). Default behavior (a single chunk
  containing every row) is unchanged — existing DuckDB UI clients see no
  difference. `parseInterval` now also accepts an `{months, days, micros}`
  object pass-through for callers that want to emit intervals the text form
  can't express (mixed-sign fields, INT32_MIN days, etc.).
* `packages/db/db.rip` — `POST /ddb/run` reads the optional
  `X-Rip-DB-Chunk-Size` header and forwards it as `opts.chunkSize` to the
  encoder, so live clients (including the fixture capture script) can
  exercise the multi-chunk wire path end-to-end.
