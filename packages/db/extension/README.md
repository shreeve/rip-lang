# `ripdb` — DuckDB extension for rip-db

`ripdb` is a **DuckDB storage extension** that lets the stock `duckdb` CLI (or
any DuckDB client) attach a running [`rip-db`](../README.md) server as a
first-class database. Once attached, tables on the remote server act like
local tables — `SHOW TABLES`, `SELECT`, `DESCRIBE`, joins, CTEs, views,
`count(*)`, everything — with the remote server doing storage and DuckDB
doing the query execution.

Think of it as the bring-your-own version of MotherDuck: your data stays in
your rip-db server, but you get DuckDB's full SQL engine on top of it.

---

## Quick start

```sql
-- one-time install from our GitHub Pages repository
SET allow_unsigned_extensions = true;
INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';

-- every session
LOAD ripdb;
ATTACH 'rip://localhost:4213' AS r (TYPE ripdb);
USE r;
SHOW TABLES;
SELECT count(*) FROM accounts;
```

That's it. Under the hood:

- `INSTALL ... FROM '<url>'` downloads the right build for your platform
  (`osx_arm64` or `linux_amd64`) and DuckDB version (`v1.5.2`) from Pages.
- `LOAD ripdb` loads the extension into your current session.
- `ATTACH 'rip://host:port' AS r (TYPE ripdb)` mounts a remote rip-db.
- `USE r` makes the remote catalog your default so you can drop the `r.`
  prefix on every query.

---

## A complete real session

```sql
-- Launch DuckDB in unsigned-extension mode (ripdb is unsigned):
$ duckdb -unsigned

-- First time, or after we ship new builds, force-refresh the download
-- (see "Upgrading" below for why FORCE INSTALL matters):
FORCE INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';

-- Load + verify:
LOAD ripdb;
SELECT 'loaded' AS ok;

-- Attach a running rip-db server (default port 4213):
ATTACH 'rip://localhost:4213' AS r (TYPE ripdb);

-- Explore:
SHOW TABLES FROM r;
SELECT count(*) FROM r.accounts;

-- Make r the default catalog, then query without prefixes:
USE r;
SHOW TABLES;
SELECT * FROM accounts LIMIT 10;
```

Everything in the rip-db schema is discoverable (`SHOW TABLES`,
`DESCRIBE t`, `information_schema.*`), and every `SELECT` is executed by
DuckDB itself against data streamed from rip-db over HTTP.

---

## Install commands in one place

| Situation                                      | Command                                                                               |
|------------------------------------------------|---------------------------------------------------------------------------------------|
| First time on a new machine                    | `INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';`          |
| We shipped a new build and you want the update | `FORCE INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';`    |
| Every DuckDB session after installing          | `LOAD ripdb;`                                                                         |
| Need to make rip-db your default DB            | `USE r;` (after `ATTACH 'rip://…' AS r (TYPE ripdb);`)                                |

## Unsigned extensions

`ripdb` is an unsigned extension (we don't publish through the DuckDB
extension repository). That means you need to allow unsigned extensions
for your DuckDB session. Any of these work:

```bash
# Option 1: start DuckDB with the flag
duckdb -unsigned

# Option 2: pass it on startup
duckdb -c "SET allow_unsigned_extensions = true; LOAD ripdb; ..."

# Option 3: a ~/.duckdbrc that auto-loads on every session start
echo "SET allow_unsigned_extensions = true;" >> ~/.duckdbrc
echo "LOAD ripdb;" >> ~/.duckdbrc
```

> Note: `SET allow_unsigned_extensions` cannot be changed after the database
> is running. Set it in `~/.duckdbrc` or via `duckdb -unsigned` — not with
> a mid-session `SET`.

---

## Supported platforms

Currently published:

| Platform       | DuckDB version |
|----------------|----------------|
| `osx_arm64`    | `v1.5.2`       |
| `linux_amd64`  | `v1.5.2`       |

These are the two platforms actively in use. The build system supports
`osx_amd64`, `linux_arm64`, and the various `wasm_*` / `windows_*` targets
too — they just aren't currently enabled in CI. See the
[workflow file](../../../.github/workflows/ripdb-extension.yml) — dropping
an entry from `exclude_archs` re-enables that target.

Publication manifest: [`docs/extensions/duckdb/manifest.json`](https://shreeve.github.io/rip-lang/extensions/duckdb/manifest.json)

---

## Upgrading: the `FORCE INSTALL` gotcha

DuckDB caches installed extensions at
`~/.duckdb/extensions/<version>/<platform>/<name>.duckdb_extension`. A plain
`INSTALL` against a custom URL **will not re-download if the file already
exists locally** — even if we've shipped a newer build upstream. That can
manifest as a confusing `undefined symbol: ...` error against the old cached
binary, even though the URL serves a working one.

Fix: use `FORCE INSTALL` to re-download:

```sql
FORCE INSTALL ripdb FROM 'https://shreeve.github.io/rip-lang/extensions/duckdb';
LOAD ripdb;
```

Or nuke the cache directly:

```bash
rm -f ~/.duckdb/extensions/v1.5.2/linux_amd64/ripdb.duckdb_extension
# (adjust version/platform for your machine)
```

Then re-install normally.

## Verifying a specific (DuckDB version, platform) is published

Before debugging an install failure, sanity-check that a build exists for
your exact DuckDB version and platform:

```bash
# 1) Your DuckDB version
duckdb -csv -noheader -c "SELECT library_version FROM pragma_version()"
# → v1.5.2

# 2) Your platform
duckdb -csv -noheader -c "PRAGMA platform"
# → osx_arm64 / linux_amd64

# 3) Is a build published for that (version, platform) pair?
curl -I "https://shreeve.github.io/rip-lang/extensions/duckdb/v1.5.2/osx_arm64/ripdb.duckdb_extension.gz"
# → HTTP/2 200 means INSTALL will succeed.
# → HTTP/2 404 means that cell isn't published; open an issue.
```

DuckDB constructs that URL itself from `<base>/<duckdb_version>/<platform>/…`,
so the URL path is the version-routing mechanism — you don't have to pick
a version when you install.

---

## Troubleshooting

### `undefined symbol: _ZN6duckdb12CatalogEntry10AlterEntryE…`

You're loading a stale, pre-fix cached binary. Use `FORCE INSTALL` (see
above) to replace it.

### `IO Error: Extension "…" could not be loaded`

Usually means one of:

- The file wasn't downloaded (404 on install) — verify with the `curl -I`
  step above.
- `allow_unsigned_extensions` is not set — start with `duckdb -unsigned`
  or add it to `~/.duckdbrc`.
- The DuckDB binary and extension are different versions — check with
  `SELECT library_version FROM pragma_version()` and re-install against
  your actual version.

### `Binder Error: database with name "r" already exists`

Your session already has `r` attached. Detach first (`DETACH r;`), or just
use the existing one (`USE r;`).

### `SHOW TABLES FROM r;` shows tables like `current_notebook_id`

Those are DuckDB UI virtual tables that sneak into `information_schema.tables`
when you've used the DuckDB UI against this rip-db. Recent rip-db server
versions filter them out (`/tables` uses `duckdb_tables()` instead of
`information_schema.tables`). If you see them, update the server.

---

## How it's built and published (brief)

The build and release pipeline uses DuckDB's official
[`duckdb/extension-ci-tools`](https://github.com/duckdb/extension-ci-tools)
— the same infrastructure that ships `postgres_scanner`, `sqlite_scanner`,
`iceberg`, etc.

- The extension is compiled **in-tree** with a pinned DuckDB source
  submodule, using DuckDB's own `build_loadable_extension()` CMake macro.
- All DuckDB internals the extension depends on
  (`TableCatalogEntry`, `SchemaCatalogEntry`, the vector system, the catalog
  machinery) are **statically linked into the extension's `.so`** via
  `EXTENSION_STATIC_BUILD=1`. This is the supported path for extensions
  that subclass internal C++ catalog classes, and it avoids the
  cross-DSO symbol-visibility issues that plague out-of-tree loadable
  extensions on Linux.
- The resulting `.duckdb_extension` files are ~8–11 MB compressed (they
  each ship their own copy of the DuckDB internals they use).

### Release pipeline

On every push to `main`, and on `ripdb-extension-v*` tags, the
[`.github/workflows/ripdb-extension.yml`](../../../.github/workflows/ripdb-extension.yml)
workflow:

1. Builds `ripdb.duckdb_extension` for each platform in the matrix
   (currently `osx_arm64`, `linux_amd64`) in parallel via DuckDB's reusable
   distribution workflow.
2. Validates each artifact's footer metadata (`duckdb_signature`,
   version, platform).
3. Gzips each build and commits it back to
   `docs/extensions/duckdb/v1.5.2/<platform>/ripdb.duckdb_extension.gz`
   on `main`.
4. Regenerates `docs/extensions/duckdb/manifest.json`.

GitHub Pages then serves the tree at
<https://shreeve.github.io/rip-lang/extensions/duckdb/>, which is the URL
users pass to `INSTALL ripdb FROM '...'`.

### Repo layout (extension-template convention)

DuckDB's extension-template requires a specific layout (Makefile alongside
the duckdb/ submodule). To keep the rip-lang root clean, that layout lives
*inside* `packages/db/`, with a 3-line forwarding Makefile at repo root
that delegates to it:

```
/Makefile                          # 3-line forwarder → packages/db
packages/db/
├── Makefile                       # wraps extension-ci-tools's duckdb_extension.Makefile
├── extension_config.cmake         # points at sibling extension/
├── vcpkg.json                     # extension dependencies (empty — we use raw sockets)
├── duckdb/                        # pinned DuckDB source submodule (v1.5.2)
├── extension-ci-tools/            # pinned build helpers submodule (v1.5-variegata)
└── extension/
    ├── CMakeLists.txt             # real CMakeLists for the extension
    ├── decoder.{h,cpp}            # the wire-format decoder (no DuckDB linkage)
    ├── ripdb.cpp                  # the extension itself: catalog, scan, attach
    ├── ripdb_compat.hpp           # DuckDB API compat shim across DuckDB versions
    └── ...
```

### Local development build

```bash
# From the repo root, one-time DuckDB build (~3 min on Apple Silicon):
make release
# → build/release/duckdb                                       (CLI)
# → build/release/repository/v1.5.2/osx_arm64/ripdb.duckdb_extension

# Sanity check:
./build/release/duckdb -unsigned -c "
  LOAD '$PWD/build/release/repository/v1.5.2/osx_arm64/ripdb.duckdb_extension';
  SELECT 'ok' AS loaded;
"
```

### Bumping DuckDB version

1. `cd duckdb && git fetch --tags && git checkout vX.Y.Z`
2. Update `duckdb_version:` (and `ci_tools_version:` if the CI-tools
   repo released a matching branch) in `.github/workflows/ripdb-extension.yml`.
3. Verify the extension compiles against the new DuckDB
   (`make release`), fixing any API diffs in `ripdb_compat.hpp` if needed.
4. Push — the workflow publishes new
   `docs/extensions/duckdb/vX.Y.Z/<platform>/ripdb.duckdb_extension.gz`
   cells alongside the existing ones; older DuckDB versions keep working.

---

## Design spec

The full design spec — wire format, catalog mapping, scan pipeline,
pushdown semantics — lives in [`../CLI.md`](../CLI.md). This file covers
"how to install and use it"; `CLI.md` covers "how it works inside".

## Contributing

See [`../AGENTS.md`](../AGENTS.md) for the contributor/agent-facing
conventions, and [`../CLI.md`](../CLI.md) for the architectural spec
before touching `ripdb.cpp`.
