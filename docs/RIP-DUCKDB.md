<p align="center">
  <img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip-schema-social.png" alt="Rip + DuckDB" width="640">
</p>

# Rip on DuckDB — Foreign Key Constraints

> **What works, what doesn't, and how the Rip schema runtime keeps the rough edges off.**

DuckDB is Rip's primary backing database — used by `@rip-lang/db`, the
`schema :model` ORM, the migration tool, and the various sample apps.
Most of DuckDB's behavior matches what you'd expect from any SQL engine.
**Foreign-key constraints are the one place where DuckDB diverges
meaningfully from PostgreSQL/SQLite/MySQL.** This doc is the canonical
explanation of that divergence — what works, what doesn't, why, and
the design patterns Rip uses to keep your application code clean.

If you're hitting a `Constraint Error: Violates foreign key
constraint because key "X: N" is still referenced by a foreign key
in a different table` and trying to figure out what's going on,
you're in the right place.

---

# Contents

1. [The exact rule](#1-the-exact-rule)
2. [What works (probably almost everything you'll write)](#2-what-works)
3. [What doesn't (the narrow forbidden case)](#3-what-doesnt)
4. [How Rip's schema runtime keeps you out of trouble](#4-how-rips-schema-runtime-keeps-you-out-of-trouble)
5. [Worked example — patient records with orders](#5-worked-example)
6. [When you genuinely need to mutate a referenced indexed column](#6-when-you-genuinely-need-to-mutate)
7. [Escape hatches](#7-escape-hatches)
8. [Should I use DuckDB for OLTP at all?](#8-should-i-use-duckdb-for-oltp-at-all)
9. [Transactions, sequences, and migration edges](#9-transactions-sequences-and-migration-edges)

---

## 1. The exact rule

DuckDB rejects an UPDATE statement when **all three** conditions hold:

1. There is at least one row in another table whose foreign key
   references the row being updated.
2. The UPDATE statement's `SET` clause touches at least one column
   that participates in an **index** — `PRIMARY KEY` or `UNIQUE`.
3. The new value differs from the old value (DuckDB internally
   re-keys via a delete-then-insert cycle on the index).

If any of those three is false, the UPDATE succeeds.

The same rule applies to DELETE: DuckDB rejects DELETE on a row that
is currently referenced by another table's FK.

This is documented at <https://duckdb.org/docs/sql/constraints> under
"Foreign Keys" and is a deliberate design choice: DuckDB's index
maintenance and FK enforcement are tightly coupled, and supporting
in-place rewrites of indexed parent rows would require significant
internal restructuring.

The behavior is **stable across DuckDB versions** — at the time of
writing (DuckDB v1.5.2) and consistent back through several minor
releases.

---

## 2. What works

The narrow forbidden case is so narrow that nearly every operation
you'll write passes through fine. The decisive table:

| Operation | Status | Notes |
|---|---|---|
| INSERT into the parent table | works | |
| INSERT into the child table | works | The standard FK existence check on the parent runs as expected. |
| SELECT, JOIN, aggregate, anything read-only | works | |
| UPDATE non-indexed columns of an unreferenced parent | works | |
| UPDATE non-indexed columns of a *referenced* parent | **works** | This is the one that surprises people most. Demographics, status fields, body text — all fine. |
| UPDATE indexed columns of an *unreferenced* parent | works | |
| UPDATE child-table columns (any) | works | Only the parent side has the restriction. |
| DELETE child rows | works | |
| DELETE parent row that has no current children | works | |
| Multi-row UPDATE that doesn't change indexed values | works | |

The narrow case to watch:

| Operation | Status |
|---|---|
| UPDATE indexed column on a referenced parent, value actually changes | **rejected** |
| DELETE referenced parent row | **rejected** |

That's it. Two cases. Both rejected. Everything else works.

---

## 3. What doesn't

The forbidden operations are:

```sql
-- Suppose orders.patient_id REFERENCES patients(id), and there's
-- at least one orders row with patient_id = 42.

UPDATE patients SET id        = 999     WHERE id = 42;  -- rejected
UPDATE patients SET mrn       = 'NEW-X' WHERE id = 42;  -- rejected (mrn is in UNIQUE)
UPDATE patients SET partner_id = 7      WHERE id = 42;  -- rejected (partner_id is in UNIQUE)
DELETE FROM patients                    WHERE id = 42;  -- rejected

UPDATE patients SET first_name = 'Steve' WHERE id = 42;  -- works
UPDATE patients SET phone      = '...'   WHERE id = 42;  -- works
UPDATE patients SET mdm_id     = 'L00X'  WHERE id = 42;  -- works
UPDATE patients SET link_id    = 'PID9'  WHERE id = 42;  -- works
```

The error message DuckDB returns names the FK column on the *child*
side, not the indexed column on the *parent* side. That's confusing
the first time you see it:

```
Constraint Error: Violates foreign key constraint because key
"patient_id: 42" is still referenced by a foreign key in a different
table. If this is an unexpected constraint violation, please refer
to our foreign key limitations in the documentation
```

The phrase "patient_id: 42" means: the FK column in the child table
is `orders.patient_id`, and the value `42` is what's being referenced.
The actual offending column on the parent (the one that's in the
index DuckDB is trying to re-key) isn't named in the error.

---

## 4. How Rip's schema runtime keeps you out of trouble

The Rip schema runtime turns full-row updates into
**column-targeted** updates. Most application code that "just calls
`save!`" never trips the rule.

When you do:

```coffee
patient = Patient.find! 42
patient.phone = '801-555-9999'
patient.save!
```

an unaware ORM might emit something like:

```sql
UPDATE patients
   SET mrn=?, first_name=?, last_name=?, dob=?, sex=?, phone=?, email=?, mdm_id=?, link_id=?
 WHERE id=?
```

That's a full-row UPDATE that touches `mrn` (an indexed column). On a
patient with existing orders, DuckDB rejects it — even though the
*value* of `mrn` isn't changing.

Rip's runtime instead emits:

```sql
UPDATE patients SET phone=? WHERE id=?
```

because the snapshot captured at `find!` time tells `save!` exactly
which columns the application actually mutated. No-op writes to other
columns are skipped, and the UPDATE never touches an indexed column
unless you genuinely changed its value. See the
[`save()` semantics section in RIP-SCHEMA.md](./RIP-SCHEMA.md#what-save-actually-writes)
for the full story.

The practical consequence: **you generally don't have to think about
this at all when writing Rip code**. The runtime takes care of it for
the 99% case. You only feel the limitation when your application
deliberately tries to change `id` / `mrn` / `partner_id` / a
`@belongs_to` FK on a row that already has children — and that's
usually a domain-model question, not a tech question.

---

## 5. Worked example

A small healthcare-style schema, exactly the medlabs case the rule
was originally documented from:

```coffee
Partner = schema :model
  name!  string
  slug! string @unique

Patient = schema :model
  mrn?       string
  firstName! string
  lastName!  string
  dob?       date
  phone?     phone
  email?     email
  mdmId?     string
  linkId?    string
  @belongs_to Partner
  @timestamps
  @unique [:partnerId, :mrn]

Order = schema :model
  status     "draft" | "submitted" | "completed" | "cancelled", [:draft]
  totalPrice integer, [0]
  notes?     text
  @belongs_to Patient
  @belongs_to Partner?
  @timestamps
```

Indexed columns on `Patient`:
- `id` — surrogate PK, auto-managed
- `partner_id` — `@belongs_to` FK
- `(partner_id, mrn)` — composite UNIQUE

So the indexed-column set on `Patient` is `{id, partner_id, mrn}`.

### Operations that work, no thought required

```coffee
# INSERT — always works
patient = Patient.create!
  partnerId: ola.id
  mrn:       'MRN-00421'
  firstName: 'Larry'
  lastName:  'Jones'

# UPDATE non-indexed — always works
patient.phone = '(801) 555-0142'
patient.email = 'mjones@email.com'
patient.save!  # writes only phone, email; Order references stay valid

# Sync an external identity-system ID — works (mdm_id non-indexed)
patient.mdmId = '5801776951206141'
patient.save!  # writes only mdm_id

# Update a child row — child-side FK changes are fine
order = Order.find! 7
order.status = 'completed'
order.notes  = 'Patient picked up sample'
order.save!  # writes only status, notes

# Soft-delete an unreferenced row
new_patient = Patient.create! partnerId: ola.id, ...
new_patient.destroy!  # works — no children yet
```

### The one case that fails

```coffee
# Patient 10023 has at least one Order. We want to change their MRN.
patient = Patient.find! 10023
patient.mrn = 'MRN-NEW-99'
patient.save!
# => Constraint Error: Violates foreign key constraint because key
#    "patient_id: 10023" is still referenced by a foreign key in a
#    different table.
```

This is the genuine restriction. DuckDB is telling you "you can't
rotate this patient's MRN while they have orders pointing at them."

The runtime *does* try this UPDATE — it correctly emits
`UPDATE patients SET mrn=? WHERE id=?` (no full-row write), and DuckDB
rejects it because `mrn` is in the `(partner_id, mrn)` UNIQUE index
and the row is referenced. The error is correctly Wikipedia-style
informative — it points at the right concept.

### How to handle it at the application layer

Three sensible patterns, in roughly increasing complexity:

**(a) Treat the indexed column as immutable** after first reference.
Surface a 409 / 422 from the API:

```coffee
post '/patients/:id/mrn' ->
  user = userScope!
  patient = Patient.find! @params.id
  newMrn  = read 'mrn', 'string!'
  if Order.where(patientId: patient.id).count! > 0
    error! 'Cannot change MRN after first order; create new patient instead', 409,
      code: 'mrn_locked'
  patient.mrn = newMrn
  patient.save!
  patient.toPublic()
```

This is what most healthcare systems actually do — MRN is identity,
and identity rotates only via a dedicated patient-merge workflow.
Cheap to implement, defensible domain rule.

**(b) Migrate the row.** INSERT a new patient with the new MRN,
repoint child rows, soft-delete the old one:

```coffee
oldPatient = Patient.find! id
newPatient = Patient.create! { ...oldPatient.toJSON(), id: undefined, mrn: newMrn }
sql! 'UPDATE orders SET patient_id = ? WHERE patient_id = ?', [newPatient.id, oldPatient.id]
oldPatient.destroy!  # works after the UPDATE — old row is now unreferenced
```

The surrogate PK changes. Anything caching `patient.id` (a partner
holding it via API) breaks. Auditable, but operationally heavier.

**(c) Drop the FK constraint.** See [§7 escape hatches](#7-escape-hatches).

For most applications, **(a) is the right answer.** Codify the
"indexed columns are immutable after first reference" rule in your
domain model, and you stop fighting the database.

---

## 6. When you genuinely need to mutate

If your application's normal write patterns *require* mutating
indexed parent columns on referenced rows, that's a serious signal
about either the domain model or the choice of database.

Common cases that would hit this regularly:

| Pattern | Forbidden ops |
|---|---|
| Bulk-rename across joined tables ("lowercase all customer emails") | UPDATE on a UNIQUE column referenced by orders |
| Periodic merge of duplicate records | DELETE on a referenced row |
| Reassigning entities ("move all orders from user A to user B") | UPDATE on FK column of child OR DELETE old user |
| Auto-rotating UNIQUE business identifiers (e.g. account numbers) | UPDATE on UNIQUE column referenced elsewhere |

If your app does any of these *routinely*, you have two options:

1. Restructure so the indexed values are stable. (Often the right
   call regardless — bulk-mutable identifiers are fragile no matter
   what the database does.)
2. Use a different database. PostgreSQL and SQLite handle this
   correctly and aren't going anywhere. See [§8](#8-should-i-use-duckdb-for-oltp-at-all).

If your app does these *occasionally* — once a quarter, in batch jobs,
under operator supervision — then [§7](#7-escape-hatches) is for you.

---

## 7. Escape hatches

### Drop the FK constraint

DuckDB without FKs is a fast columnar engine with no FK surprises.
Application-level FK enforcement (existence check before write,
optional cleanup jobs) replaces what the DB was doing.

The `@belongs_to` directive in Rip emits a `REFERENCES` clause in
DDL by default. To skip the constraint while keeping the relation
accessor and the camelCase/snake_case alias machinery, override the
DDL emission in your migration:

```sql
-- Generated by Rip, then hand-edit before running:
CREATE TABLE orders (
  id          INTEGER PRIMARY KEY DEFAULT nextval('orders_seq'),
  patient_id  INTEGER NOT NULL,  -- was: REFERENCES patients(id)
  ...
);
```

You lose:
- DB-level guarantee that `orders.patient_id` always points at a
  real patient
- DuckDB's check that you can't DELETE a referenced parent

You gain:
- Freedom to UPDATE / DELETE anything anytime
- Slightly faster writes (no constraint check)

For analytical-flavored apps, this is the right tradeoff. For
financial or healthcare records that must always be join-able, less
clearly so — but if your application code is rigorous, app-level
enforcement is fine. Most ORMs in the JavaScript ecosystem have
worked this way for years.

### Soft-rotate via INSERT + repoint + DELETE

Pattern (b) from [§5](#5-worked-example). Wrap it in a helper:

```coffee
export rotateMrn = (oldPatient, newMrn) ->
  newPatient = Patient.create!
    partnerId:  oldPatient.partnerId
    mrn:        newMrn
    firstName:  oldPatient.firstName
    lastName:   oldPatient.lastName
    dob:        oldPatient.dob
    phone:      oldPatient.phone
    email:      oldPatient.email
    mdmId:      oldPatient.mdmId
    linkId:     oldPatient.linkId

  sql! 'UPDATE orders WHERE patient_id = ? SET patient_id = ?', [oldPatient.id, newPatient.id]

  oldPatient.destroy!  # works — now unreferenced
  newPatient
```

Surrogate ID changes; anything that cached the old ID externally
breaks. Acceptable for internal tools and scheduled migrations,
not for live API surfaces where partners hold the ID.

### Switch to a different database

If FK rigidity is repeatedly in the way:

- **SQLite** — file-based, no server, full FK semantics, well
  supported, embedded in everything. Excellent for single-machine
  apps. Limited write concurrency.
- **PostgreSQL** — server-based, full FK semantics including
  `ON DELETE CASCADE` / `ON UPDATE CASCADE`, mature concurrency,
  replication, point-in-time recovery, every feature you might
  ever want. Operational overhead.

The Rip schema runtime is mostly DB-agnostic (the
`__schemaSetAdapter` seam) and the SQL it emits is portable for
the common operations. Swapping the underlying DB is a real
project but not a hostile one.

---

## 8. Should I use DuckDB for OLTP at all?

DuckDB is, by design, an **analytical** database. The marketing
puts it next to MotherDuck, Apache Arrow, columnar storage, and
"in-process analytics" benchmarks. Using it for transactional
workloads — high-volume row-level INSERT/UPDATE/DELETE with FK
relationships — is going against the canonical use case.

That said, DuckDB is *very good* at lots of things that look like
OLTP:

- INSERT-heavy workloads (orders, events, log entries)
- SELECT-heavy workloads (lookups, aggregations, reports)
- Single-host applications with moderate concurrency
- Apps where most rows are append-only and rarely mutated

The medlabs healthcare app fits this profile. Patients are mostly
inserted, occasionally updated (demographics, never identity), and
never deleted. Orders are inserted and have their `status` /
`notes` updated — both non-indexed columns. The
column-targeted UPDATE behavior of the Rip ORM keeps the
non-indexed-column update path open.

DuckDB is a poor fit when:

- Multiple writers on the same machine need fine-grained locking
  (DuckDB has a single-writer model under the hood)
- Distributed write replication is required
- The workload mutates indexed business identifiers across joined
  tables routinely

DuckDB is a fine fit when:

- The workload is mostly read, with append-heavy writes
- Indexed columns are surrogate keys or stable identifiers
- The schema favors denormalization or has shallow FK relations
- You want analytics queries to live in the same engine as the
  transactional data

### Turning a mutation-shaped workload into an append-shaped one

A workload that looks write-heavy on paper is often append-heavy in
disguise. The standard move — shared by change feeds, event logs,
audit trails, and sync protocols (Replicache / Zero-style) — is an
**append-only log with a monotonic version column** beside the entity
tables: a write appends a new row instead of mutating an indexed
parent in place, and readers pull `WHERE version > :cursor`. This
plays directly to DuckDB's strengths (append-heavy writes, fast
monotonic range scans) and routes around the one real weak spot from
§1 — in-place updates to indexed / FK rows, which an append never
performs. The trade is the usual one for log-structured designs: the
log grows and wants periodic compaction (prune history below the
lowest live reader cursor, `CHECKPOINT` to flush), and "current state"
becomes a view or materialization over the log rather than the rows
themselves. When a write-heavy feature can be expressed this way, the
"poor fit" case above (routinely mutating indexed identifiers) often
stops applying — and harbor's single-port `/sql` with NDJSON streaming
is a natural transport for serving the resulting feed.

For a project where you're not sure: prototype with DuckDB, watch
the FK behavior, and switch to PostgreSQL or SQLite if you find
yourself reaching for the escape hatches more than once or twice.

---

## 9. Transactions, sequences, and migration edges

Findings from running the Rip Schema transaction and migration
machinery against live DuckDB (via duckdb-harbor) — each one shapes
runtime or differ behavior:

**FK-referenced tables are frozen for DDL too.** The §1 rule isn't
just about UPDATE/DELETE — most `ALTER TABLE` operations (add column,
drop column, type changes) on a table referenced by another table's FK
fail with `Dependency Error: Cannot alter entry "users" because there
are entries that depend on it`. Changing such a table means recreating
the referencing tables around it. The migration differ classifies
these steps as **`blocked`** in `rip schema status` and refuses to
write them into a migration file — the rebuild is a human decision.
Unreferenced tables alter normally.

**No `SAVEPOINT`.** DuckDB supports flat transactions only. A nested
`schema.transaction!` therefore *joins* the outer transaction rather
than creating an independently-rollbackable unit — one rollback undoes
the whole nest. Don't design flows that need partial rollback.

**Sequences are non-transactional.** `nextval()` consumed inside a
rolled-back transaction is not returned — a failed `create!` leaves a
gap in the `id` sequence. Gaps are normal and harmless; never write
code that assumes ids are contiguous, and never predict "the next id"
from the last one you saw.

**Harbor sessions work in every auth mode.** Transactions ride
duckdb-harbor's session protocol (`POST /sql/sessions/new`, then
per-statement `session_id`). Own-session lifecycle is scoped as
`__HARBOR_SELF__:sessions:create` / `:delete` — allowed by default for
any caller, including unauthenticated local-dev mode
(`harbor_serve(..., token := NULL)`), where sessions are owned by the
synthetic `harbor.local-dev` principal. A 403 from
`schema.transaction!` means a custom `harbor_authorization_function`
explicitly denies the `__HARBOR_SELF__:sessions:` scope — add a branch
matching it. (Earlier harbor versions misfiled session creation as an
admin action; that required `RIP_DB_TOKEN` plus an admin grant and is
the reason older notes here said transactions need a token.)

---

## See also

- [`docs/RIP-SCHEMA.md`](./RIP-SCHEMA.md) — the schema/ORM documentation,
  including the `save()` semantics, dirty tracking, and `markDirty()`
  escape hatch.
- [`packages/db/AGENTS.md`](../packages/db/AGENTS.md) — the
  `@rip-lang/db` FFI client.
- [DuckDB Foreign Key documentation](https://duckdb.org/docs/sql/constraints) — upstream reference for the rule.
