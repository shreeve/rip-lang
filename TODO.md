# TODO

Forward-looking work for the rip-lang repo. The earlier polish and
correctness items have all been resolved (see commit history). What
remains is one substantial future feature that's worth building when
there's a real trigger — it's not on a critical path today.

(Browser debugger / DevTools source-map support is now complete across
both code paths — inline `<script type="text/rip">` blocks and bundle
components compiled via `app.launch()`. Verified end-to-end via the
unit tests and bundle smoke checks; ongoing correctness is covered by
`test/bundle.test.js` and the regular test suite.)

---

## 1. Migration diff generator (`rip migrate generate`)

Automate the "edit a `:model` schema → figure out the `ALTER TABLE`
statements" step. Today `Model.toSQL()` is a **snapshot generator** — it
emits `CREATE TABLE` for the current model shape but doesn't know what the
DB looks like now. Evolving an existing table requires hand-writing
timestamped SQL migration files that have to stay in sync with the model by
discipline alone.

Every mature ORM has solved this in one of three ways:

- **Django** — `makemigrations` diffs `models.py` against a serialized
  snapshot of prior state; prompts interactively on rename ambiguity.
- **Prisma Migrate** — `migrate dev` uses a shadow database (replays
  migration history) and diffs against the current `schema.prisma`.
- **Drizzle Kit** — `generate` diffs the `schema.ts` against JSON snapshots
  stored in `drizzle/meta/`; interactive rename prompts.

Rip has none of these. Timestamped SQL + `runMigrations` (the pattern apps
use today) is the right runner architecture, but the **authoring** step is
fully manual. This is the biggest usability gap in Rip DB.

The architecture I'd pick for Rip: **Drizzle Kit's approach adapted**.
Reasons: no shadow DB (operational simplicity wins), snapshots are
git-tracked code (reviewable in PRs), plain SQL output (portable, auditable),
and it fits Rip's "code is the source of truth" philosophy.

#### Proposed shape

```
apps/<app>/api/migrations/
├── meta/
│   ├── 0001_snapshot.json        ← model state after migration 0001
│   ├── 0002_snapshot.json
│   └── 0003_snapshot.json
├── 20260417190000000-initial-schema.sql
├── 20260501120000000-rename-user-email.sql
└── 20260510180000000-add-order-items-discount.sql
```

```bash
$ rip migrate generate "rename-user-email"
[migrate] Diffing apps/medlabs/api/models.rip against meta/0002_snapshot.json…
[migrate] Detected: users.email removed, users.email_address added (same type/constraints)
[migrate] Is this a rename? users.email → users.email_address [Y/n]: Y
[migrate] Wrote migrations/20260501120000000-rename-user-email.sql
[migrate] Wrote migrations/meta/0003_snapshot.json
```

```bash
$ rip migrate apply
[migrate] Applied 20260501120000000-rename-user-email.sql
[migrate] DB now at 20260501120000000
```

#### Implementation sketch

- **Snapshot serializer** — walk `.toSQL()`-equivalent internals and emit a
  structured JSON representation (tables → columns with types/constraints/defaults,
  indexes, foreign keys). Small extension of the existing Layer 4b DDL
  emitter in `packages/schema/src/schema.js`.
- **Snapshot diff** — naive structural diff is enough for most operations
  (add column, drop column, type change, index add/drop, FK add/drop).
  Handles 80% of cases without getting clever.
- **Rename detection** — when a table has "N removed columns, N added
  columns of identical type+constraints," flag as ambiguous and prompt the
  user. Django's heuristic. Well-understood.
- **SQL emitter** — per dialect. Start with DuckDB (Rip's current target);
  PostgreSQL and SQLite follow naturally since the DDL subset Rip generates
  is standard.
- **CLI** — one new command in the `rip` binary: `rip migrate generate [name]`.
  Reuses the existing `runMigrations` helper as the apply path.

#### Effort estimate

| Work | Effort |
| --- | --- |
| Snapshot JSON format + serializer | ~1 day |
| Snapshot differ (add/drop/alter columns, indexes, FKs) | ~2 days |
| Rename-detection heuristic + interactive prompt | ~1 day |
| SQL emitter (DuckDB first) | ~1 day |
| CLI wiring + file management (meta/ folder, ordering) | ~1 day |
| Tests covering the matrix of diff cases | ~1 day |
| Docs in `docs/RIP-SCHEMA.md` §8 (replaces "hand-write SQL" guidance) | ~½ day |

Total: **~7 days** of focused work for a first-cut generator.

#### Trigger

Genuinely worth building when one of these happens:

- **Strongest** — a production app accumulates 5+ hand-written migration
  files and the "update model, write matching SQL, hope they agree"
  discipline starts producing bugs. At that point the manual tax exceeds the
  build cost.
- **Medium** — a second app starts using `:model` schemas and the two apps
  would share the generator. Reuse amortizes the cost.
- **Weak** — aesthetic pressure to "have a complete story." Real but not
  urgent — timestamped SQL files are a perfectly respectable production
  approach used by Rails, Laravel, golang-migrate, and Flyway for decades.
  The generator is a convenience, not a correctness improvement.

#### Non-goals for v1

- **Zero-downtime / concurrent index creation** — production deploys can
  hand-edit the generated SQL if needed.
- **Data migrations** (transforming row values during schema evolution) —
  Django's `RunPython` equivalent is a bigger design task; defer until a
  real case appears.
- **Multi-dialect** (PostgreSQL + MySQL + SQLite in one pass) — start with
  DuckDB, add dialects as apps need them.
- **Rollback generation** (`down.sql` / reversible migrations) — v1 is
  forward-only. Rollback in production is usually "restore from backup"
  anyway; the migration DSL's `down` is more dev-loop convenience than real
  safety net.
