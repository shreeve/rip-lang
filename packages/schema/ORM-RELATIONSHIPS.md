# ORM Relationships — A Constellation

**Status:** Design exploration. A foundation for (potentially) revamping the
relationship DSL in Rip Schema's ORM. Nothing here is committed yet.

**Context:** Rip Schema today uses Rails-style relationship keywords
(`@belongs_to`, `@has_one`, `@has_many`) with a handful of shorthand aliases
(`@one`, `@many`) and one genuinely novel construct (`@link` for temporal,
polymorphic, role-named, any-to-any associations stored in a shared `links`
table). This document enumerates every meaningfully distinct relationship
kind a data-layer DSL can express, brainstorms a constellation of
single-word candidates for each, and then — informed by a sharp peer review
— proposes a small, cleanly factored set of primitives and modifiers for a
potential revamp.

This document has three parts:

1. **The Constellation** — an enumeration of relationship kinds with
   candidate keywords.
2. **A Coherent Core** — a factored proposal of base primitives and
   modifiers (revised after peer critique).
3. **Commentary & Open Questions** — the design tensions and decisions
   that still need to be made.

---

# Part 1 — The Constellation

An ORM relationship is defined by several (mostly) orthogonal axes:

- **Cardinality** — how many records on each side? (one, many)
- **Direction** — which side holds the foreign key? (self, other, both)
- **Lifecycle** — who owns existence? (independent, cascade, embedded)
- **Modality** — how does the relation exist? (structural, polymorphic,
  temporal, computed, soft)
- **Collection semantics** — when there are many, what shape is the
  collection? (ordered list, unordered set, keyed map)

Most current ORMs collapse these axes onto two or three keywords
(`belongs_to`, `has_one`, `has_many`, sometimes `has_and_belongs_to_many`)
and bolt everything else on via options (`polymorphic: true`,
`dependent: :destroy`, `through:`, `as:`). That's expedient but lossy —
the *shape* of a relationship becomes invisible in the declaration.

A richer DSL can name each meaningful combination, while still falling
back to the common cases by default. The sections below enumerate those
combinations.

---

## 1. One-to-One, FK on self ("belongs_to" direction)

This record holds a foreign key pointing to exactly one other record. The
FK column lives on *me*. Required or nullable depending on the schema.
This is the "child" side of a parent-child link.

**Example:** `Post` has a `user_id` column pointing to `User`.

**Candidates:** `@ref` · `@to` · `@parent` · `@of` · `@under` · `@for` ·
`@in` · `@by` · `@fk` · `@points` · `@cites`

**Strongest:** `@ref` (structural/neutral) and **`@to`** (directional,
arrow-like). `@to` pairs beautifully with `@from` in #2, giving Rip a
symmetric directional vocabulary — the FK goes *to* the target on one
side and comes *from* the target on the other:

```coffee
@to    User       # my FK points to User          (belongs_to)
@from  Profile    # a FK comes from Profile       (has_one)
```

Both `@ref` and `@to` beat `@parent`, which is a role word and leaks in
non-hierarchical cases like `Like @parent Post`.

**Primary / alias recommendation:** `@ref` as the primary (structural),
`@to` as a first-class alias (directional). Both always available.

**Current Rip:** `@belongs_to`.

---

## 2. One-to-One, FK on other ("has_one" direction)

Exactly one other record holds a FK back to me. The FK lives on *them*.
I'm the "parent" in a singular parent-child link.

**Example:** `User` has one `Profile`; the `user_id` lives on `Profile`.

**Candidates:** `@one` · `@from` · `@has` · `@owns` · `@holds` · `@child` ·
`@sole` · `@singular`

**Strongest:** `@one` (cardinality) and **`@from`** (directional). `@from`
is the natural inverse of `@to` — "the FK comes *from* them back to me":

```coffee
@to    User       # my FK points to User          (belongs_to)
@from  Profile    # a FK comes from Profile       (has_one)
```

Use `@one` when you want to emphasize *how many* (the cardinality
family: `@one`, `@many`, `@via`). Use `@from` when you want to emphasize
*which direction the reference flows* (the directional family: `@to`,
`@from`). Both read correctly; choose per domain.

**Primary / alias recommendation:** `@one` as the primary (cardinality),
`@from` as a first-class alias (directional). Both always available.

**Current Rip:** `@has_one`, alias `@one`.

---

## 3. One-to-Many ("has_many" direction)

Many other records hold FKs back to me. I'm the parent to a collection.

**Example:** `User` has many `Posts`.

**Candidates:** `@many` · `@has` · `@owns` · `@children` · `@list` · `@set` ·
`@all` · `@collection` · `@fleet`

**Strongest:** `@many`.

**Current Rip:** `@has_many`, alias `@many`.

---

## 4. Many-to-Many via an explicit join entity

Both sides associate with many of the other, via an intermediate join
table/model. Symmetric in structure, often asymmetric in meaning
(Students ↔ Courses via Enrollments).

**Example:** `Student` ↔ `Course` through `Enrollment`.

**Candidates:** `@join` · `@via` · `@through` · `@mesh` · `@link` · `@pair` ·
`@cross`

**Strongest:** `@via` — if narrowed to *"many-to-many via this join
entity"* (see #5 for why narrowing matters).

**Current Rip:** not first-class. Two `@has_many` plus an explicit join
model.

---

## 5. Has-many-through (transitive / read-through)

A traversal across an existing relation. `User @many memberships`, and
then `User @through memberships, organization` — the organizations this
user belongs to, via their memberships. Structurally overlaps with #4,
but has distinct semantics for writes, eager loading, and mutability.

**Candidates:** `@through` · `@via` · `@across` · `@by`

**Strongest:** `@through` — reserve for *traversal across an existing
relation*, keep `@via` for *join-entity many-to-many*. Merging them loses
an important distinction the peer-review flagged (see **Commentary**).

**Key semantic contract:** `@through` is **navigational** and
**structurally invertible** — it always projects across relations that
already exist and is read-symmetric. It is *not* a synonym for
`@derive`: `@derive` is arbitrary read-only computation; `@through` is
a structural shortcut that the ORM can preload, invert, and (in some
cases) write through.

**Current Rip:** not first-class. Navigate manually through the join model.

---

## 6. Polymorphic belongs_to (union FK + type discriminator)

This record points to "one of several possible types." Two columns: a
foreign key and a type discriminator. Could point to a User, a Post, or
a Comment — decided per row.

**Example:** `Like` belongs to a `likeable` which might be a `Post` or a
`Comment`.

**Candidates:** `@any` · `@poly` · `@some` · `@either` · `@union` ·
`@variant` · `@oneof` · `@morph`

**Strongest:** peer review makes a good case for `@union` (type-system
native, precise) over `@any` (catchy but semantically vague). `@poly` is
a reasonable middle ground (ORM-native, precise). We'll revisit this in
Part 2.

**Current Rip:** not first-class per se. Our `@link` is a *superset*
(temporal + polymorphic + roleful) via a shared `links` table but doesn't
produce the two-column (fk, type) pair on the model itself.

---

## 7. Polymorphic has_many (inverse of #6)

"Anything-likeable has_many Likes" — the inverse of #6.

**Candidates:** `@manyof` · `@any` (with cardinality), `@polymany`

**In practice:** most ORMs just write `@many Like as: :likeable` — the
polymorphism lives on the other side. This probably isn't a distinct
primitive; it's an inverse of #6.

---

## 8. Self-referential (trees, DAGs, chains, graphs)

A record points to another record of the *same* type. Not one thing:
- **Adjacency list** — `parent_id` on each row.
- **Materialized path** — string path like `"1/4/17"`.
- **Nested set** — left/right numeric bounds.
- **Closure table** — a separate (ancestor, descendant, depth) edge table.

**Examples:** `Comment.parent_comment_id`; `Employee.manager_id`;
category trees; reply chains; dependency graphs.

**Candidates:** `@self` · `@tree` · `@recurse` · `@parent` · `@ancestor` ·
`@chain` · `@loop` · `@kin` · `@sibling`

**Strongest (peer-review verdict):** not a keyword at all. `self` should
be a *target modifier* (`@ref self as: parent`, `@many self as: children`),
not a top-level keyword. The storage strategy (adjacency/path/closure)
is a separate option.

**Current Rip:** works today as a regular `@belongs_to` to the same model
or via `@link` for temporal/roleful self-reference.

---

## 9. Embedded / composition (value-owned, no separate identity)

The "child" has no independent identity. It exists *inside* the parent,
stored inline (JSON column, embedded doc, composite column). Killing the
parent kills the child automatically. This is the one place `@owns` is
semantically accurate.

**Example:** an `Address` embedded inside a `User` row; a `Money`
composite inside an `Invoice`.

**Candidates:** `@embed` · `@inline` · `@owns` · `@part` · `@has` ·
`@inside` · `@within` · `@composed` · `@flat`

**Strongest:** `@embed`.

**Current Rip:** partial — a field whose type is a `@type` generates an
embedded object in TypeScript and validation, but the SQL storage
strategy is implicit.

---

## 10. Weak entity / existence-dependent (independent row, cascade required)

Child has its own row (with identity), but its existence depends on the
parent. Delete the parent → child is meaningless. Cascade delete is not
optional, it's *required*.

**Example:** `LineItem` exists only as part of `Order`.

**Candidates:** `@owned` · `@weak` · `@dep` · `@bound` · `@captive` ·
`@part`

**Strongest:** `@part` (pairs well with `@embed`), with `@owned` as a
more literal alternative.

**Note:** `@embed` vs `@part` is a semantic cliff that documentation has
to hammer:
- `@embed` = no separate identity, stored inline or in a composite/JSON
  column, parent-owned value.
- `@part` = separate table and primary key, but lifecycle owned by the
  parent (cascade delete is mandatory).

**Current Rip:** expressible as `@belongs_to` with manual `ON DELETE
CASCADE` and is otherwise not first-class.

---

## 11. Temporal / historical (time-bounded)

An association valid only for a range of time. Employment, pricing,
memberships. The relationship itself carries temporal metadata.

This breaks down further:
- **Valid-time** — when the fact was true in the world.
- **Transaction-time** — when the fact was recorded in the DB.
- **Bitemporal** — both simultaneously.

**Example:** `Employment` connects `Person` ↔ `Company` with
`started_at`, `ended_at`.

**Candidates:** `@when` · `@during` · `@past` · `@while` · `@valid` ·
`@period` · `@temporal` · `@history` · `@at`

**Strongest:** `@when` — *if* we commit to defining its temporal
semantics (interval columns, overlap policy, current-row projection,
write semantics). If not, it's a marketing keyword, not a reliable
feature. (This is the single biggest tar-pit risk on the menu.)

**Current Rip:** first-class via `@link`, which stores role + source +
target + `when_from` + `when_till` in a shared `links` table. This is
arguably Rip Schema's most distinctive feature today.

---

## 12. Soft / logical / external (no DB FK)

A relation enforced at the application level, not by a DB foreign key.
The peer review correctly pointed out this is a junk drawer — at least
three distinct things hide under it:

- **(12a) Constraintless local reference** — column exists in our DB,
  but no FK constraint. Maybe the target is in a different schema/DB
  but same server.
- **(12b) Remote/federated reference** — target lives in another
  service (Stripe customer id, GitHub user id). Access is by API, not
  join. *Must be pinned down as read-only federation vs. write-through
  sync at declaration time; don't leave this fuzzy.*
- **(12c) Non-persisted / query relation** — no stored column at all;
  we compute it. Overlaps with #13.

**Candidates per sub-kind:**
- (12a): `@ref Target check: false` or `@ref Target soft:` (a *modifier*
  on `@ref`, not a new keyword).
- (12b): `@remote` · `@extern` · `@external`.
- (12c): falls into `@derive` below.

**Strongest:** split — don't use `@virtual` as an umbrella. The peer
review was emphatic on this point and it's right.

**Current Rip:** not expressible as first-class; you drop to a plain
scalar field.

---

## 13. Computed / derived relation (no persistence, queried on demand)

A relation computed from data, not stored. "Top commenter on this post"
= whichever User authored the most comments here. Not a column; a query.
Distinct from a CQRS/projection read-model, which is also derived but
persisted asynchronously and queryable directly.

**Example:** `Post.top_commenter` = `User` derived by grouping `Comments`.

**Candidates:** `@derive` · `@compute` · `@virtual` · `@query` · `@select`

**Strongest:** `@derive`.

**Current Rip:** available today for computed *fields* (via the
`computed:` option on `schema.model`) but not for computed *relations*.

---

## 14. Ordered (positional list)

A has-many where the children have a meaningful order — playlist tracks,
TODO items, document sections. Adds a position/rank column and semantics
around reordering.

**Candidates:** `@list` · `@ordered` · `@seq` · `@sequence` · `@queue` ·
`@line` · `@rank`

**Strongest:** `@list` — *as a flavor of `@many`*, not a sibling of it
(see Part 2 on orthogonality).

**Current Rip:** not first-class. `@many` + manual `orderBy(position)`.

---

## 15. Keyed / dictionary (mapped)

Many children, accessed by key rather than iterated. Settings-by-name,
translations-by-locale, flags-by-key.

**Example:** `User.preferences['theme']` where `Preference` rows have
`user_id` + `key` + `value`.

**Candidates:** `@map` · `@dict` · `@by` · `@keyed` · `@lookup`

**Strongest:** `@map` — again as a flavor of `@many`.

**Current Rip:** not first-class.

---

## 16. Set / unordered-unique

Many children with uniqueness but no order. Tags, categories, permissions.

**Candidates:** `@set` · `@tags` · `@unique` · `@uniq`

**Strongest:** `@set` — again a flavor of `@many`.

**Current Rip:** `@many` + uniqueness constraint.

---

## 17. Association vs. Aggregation vs. Composition

The UML trichotomy. Worth naming for the record; *not* worth three
separate keywords in the DSL. We already cover the useful distinctions
with `@ref`, `@part`, `@embed`.

| Flavor          | Meaning                                                        | What the DSL uses   |
|-----------------|----------------------------------------------------------------|---------------------|
| Association     | Two entities know each other; neither owns the other           | `@ref`, `@one`, `@many` |
| Aggregation     | Whole-and-parts; parts can outlive the whole (playlist)        | plain `@many`       |
| Composition     | Parts die with the whole                                       | `@embed`, `@part`   |

---

## 18. Bidirectional peer (symmetric association)

Two records in a symmetric relationship — friendship, sibling,
partnership. Either side equally "owns" the relationship.

**Example:** `User` friends-with `User` (mutual).

**Candidates:** `@peer` · `@with` · `@mutual` · `@pair` · `@twin` · `@kin` ·
`@sym`

**Strongest:** `@peer`.

**Current Rip:** fakable via `@link` with a symmetric role and self-target.

---

## Additional kinds the peer review surfaced

These didn't appear in the initial enumeration but deserve at least a
mention, even if we don't name them as first-class keywords:

- **Typed graph edge** — a relation with (edge-type, endpoints, payload,
  direction, symmetry, optional validity). This is what `@link` really
  *is* today. Rather than a new keyword, it argues for keeping and
  refining `@link`.
- **Versioned child rows** — `Document has_many Versions` with ordering
  and "current" semantics. Usually expressible as `@list Version` +
  convention, not a new primitive.
- **Snapshot / state-as-of** relations — pointers to a specific version
  at an event/time. Either `@ref Version` or `@when` + a version target.
- **Audit actor links** — `changed_by`, `approved_by`. These are just
  `@ref User` with a role name; no new primitive needed.
- **Event-stream causality** — `caused_by`, `emits`, `replaces`. Domain-
  specific; outside the scope of a generic ORM.
- **CQRS / read-model projections** — persisted elsewhere, refreshed
  async, read-only. A `@derive` refinement with a persistence option, or
  a new `@projection` keyword if it becomes important.

---

# Part 2 — A Coherent Core (revised)

The most important insight from the peer review: the initial proposal
mixed **base primitives** (relation kinds) with **modifiers** (collection
flavor, nullability, polymorphism, temporality) at the same lexical
level. That's aesthetically tidy but structurally impure. Cleaning it up
gives us a two-tier model.

## Base relation forms

One keyword per *structural* kind of relation. Two of these expose a
parallel alias for the directional family (`@to` / `@from`), giving
authors a choice between *cardinality* and *direction* phrasing:

| Keyword        | Alias     | Meaning                                                    |
|----------------|-----------|------------------------------------------------------------|
| `@ref`         | `@to`     | to-one, FK on self (replaces `@belongs_to`)                |
| `@one`         | `@from`   | to-one, FK on other (has_one)                              |
| `@many`        | —         | to-many, FK on other (has_many)                            |
| `@via`         | —         | many-to-many via an explicit join entity                   |
| `@through`     | —         | traversal across an existing relation (distinct from `@via`) |
| `@embed`       | —         | value-owned, no separate identity, stored inline           |
| `@part`        | —         | existence-dependent child, cascade-delete required         |
| `@peer`        | —         | symmetric association (optional; specialized)              |
| `@link`        | —         | typed edge in a shared `links` table (flagship primitive)  |
| `@derive`      | —         | computed relation, not stored                              |

The `@to` / `@from` pair is the **directional** way to read a
belongs-to / has-one pair: "my FK goes *to* User" vs. "a FK comes *from*
Profile." The `@ref` / `@one` pair is the **structural/cardinality**
way to read the same pair. Both are always valid; use whichever reads
better in context.

## Modifiers

Applied to a base form via suffix, option, or target syntax:

| Modifier                           | Meaning                                               |
|------------------------------------|-------------------------------------------------------|
| `Target?`                          | nullable                                              |
| `TargetA \| TargetB`               | polymorphic                                           |
| `self`                             | self-referential target                               |
| `as: :roleName`                    | role name for inverse / polymorphic-as                |
| `order:` (or `kind: :list`)        | ordered collection                                    |
| `unique:` (or `kind: :set`)        | unique collection                                     |
| `by: :keyField` (or `kind: :map`)  | keyed collection                                      |
| `temporal:` / `when: [:from, :to]` | temporal validity                                     |
| `remote:` / `check: false`         | soft edge / no FK constraint                          |
| `storage: :adjacency \| :closure \| :path` | hierarchy storage strategy (for `self`)      |

## Collection-flavor keywords as sugar

`@list`, `@set`, `@map` can exist as *sugar* over `@many`:

| Sugar                                        | Desugars to                                   |
|----------------------------------------------|-----------------------------------------------|
| `@list Track`                                | `@many Track order:`                          |
| `@set Tag`                                   | `@many Tag unique:`                           |
| `@map Preference by: :key`                   | `@many Preference key: :key`                  |

That keeps the surface short (great for common cases) and the algebra
clean (one primitive underneath).

## Example in its cleaned-up form

```coffee
# --- Core four (cardinality/structural style) ---
@ref     User                     # belongs_to, required
@ref     Category?                # belongs_to, nullable
@one     Profile                  # has_one
@many    Post                     # has_many

# --- Same four, directional style (always available) ---
@to      User                     # belongs_to  (my FK points to User)
@to      Category?                # belongs_to, nullable
@from    Profile                  # has_one     (FK comes from Profile)
@many    Post                     # has_many    (no directional alias)

# --- Many-to-many: join entity vs. traversal ---
@via     Enrollment, Course       # students ↔ courses via Enrollment
@through memberships, organization # transitive read across memberships

# --- Polymorphism is a modifier, not a primitive ---
@ref     Post | Comment as: :likeable   # polymorphic belongs_to
@many    Like as: :likeable             # inverse

# --- Self-reference via target syntax ---
@ref     self as: parent
@many    self as: children storage: :adjacency

# --- Lifecycle forms ---
@embed   Address                  # inline/composite, owned
@part    LineItem                 # cascade-delete, separate identity

# --- Collection flavors as sugar over @many ---
@list    Track                    # ordered
@set     Tag                      # unique unordered
@map     Preference by: :key      # keyed

# --- Soft edges (split, not a junk drawer) ---
@ref     Customer check: false    # no DB FK but local column
@remote  StripeCustomer           # external service
@derive  topCommenter from: ...   # computed

# --- Flagship: edge/graph primitive ---
@link    "admin",  Organization   # temporal, polymorphic, roleful edge
@link    "mentor", User           # self-referential role edge

# --- Peer (if adopted) ---
@peer    User as: :friend         # symmetric edge
```

## The `@ref` vs. `@parent` question, decided

`@ref` wins. Decisively.

- `@ref` is role-neutral and reads correctly in every belongs-to case
  (`Post @ref Author`, `Payment @ref Invoice`, `Like @ref Post`).
- `@parent` is a *role* word that leaks the moment a non-hierarchical
  belongs-to appears (`Like @parent Post` is wrong;
  `Assignment @parent Reviewer` is absurd).
- `@ref` joins the family of *structural* words (`@one`, `@many`, `@via`)
  that already anchor the DSL.

`@parent` earns its keep not as a primitive but as a **role alias**:

```coffee
@ref self as: parent
```

That's the right place for it.

The directional alias **`@to`** is kept first-class alongside `@ref`,
paired with **`@from`** on the has-one side. This gives authors two
reading styles for the same structural relationship:

```coffee
# structural / cardinality phrasing
@ref    User
@one    Profile

# directional phrasing (same meaning)
@to     User
@from   Profile
```

Both are valid entries in the revamped DSL. The directional pair is
particularly natural in domains where the FK-flow metaphor reads better
than cardinality (API clients, document references, pointer-heavy
domains).

## The `@link` question, decided

**Keep it.** Do not decompose it into `@when` + `@any` + `@peer`.

The peer review put this forcefully: `@link` is not merely syntax sugar.
It's a *typed edge relation substrate* that bundles:

- polymorphic endpoints
- role-named edges
- time-bounded validity
- shared edge table (localized complexity)
- graph-style API (`link!`, `unlink!`, `links!`, `linked!`)

Decomposing it loses:

- the shared-table abstraction (each new kind would need its own storage),
- standardized edge-payload columns,
- the "all edges touching this node" graph API,
- conceptual uniqueness (no other ORM has this primitive cleanly).

A `@link` with a narrowed, declarative charter is both Rip's most
distinctive idea and the cleanest answer to several problems on this
list at once. The proposal is therefore: **keep `@link`, formalize its
charter, and let `@when`, `@ref … | …`, and `@peer` exist as simpler
primitives alongside it for the 90% case**.

Proposed declarative `@link` charter (block form, matching the rest of
the indentation-sensitive DSL):

```coffee
@link Employment
  to:        Company
  role:      :employee
  temporal:  true

@link Follow
  to:        User
  symmetric: false

@link Tagging
  to:          Tag
  polymorphic: true
```

Block form (over a dense one-line form) because `@link` is no longer a
tiny macro — it's a mini edge-schema that will accumulate fields
(`symmetric`, `inverse`, `payload`, `valid_from`, `valid_to`, `unique`,
`indexed`, etc.). The current single-line form can remain as sugar for
the simplest case.

We **keep the name `@link`** rather than renaming to `@edge`: `@link` is
already shipped, reads well in application/domain language, and
naturally covers typed associations, temporal joins, and role-based
connections without locking into graph-theory-coded vocabulary. `@edge`
(and a lower-level graph API, if we add one) can live underneath `@link`
later.

---

# Part 3 — Commentary & Open Questions

## What the peer review changed

The document's first draft claimed the core was orthogonal. It wasn't.
Several places double-dipped or operated at mismatched levels:

- `@list` / `@set` / `@map` are **collection flavors**, not independent
  relation kinds. They belong as sugar over `@many`, not peers.
- `@any` (polymorphism) is a **modifier** on a base shape, not a shape
  itself. `@ref Post | Comment` reads fine; `@any` as a top-level
  primitive pretends polymorphism is its own axis.
- `@when` (temporality) operates at the edge/association level; it's
  not parallel to `@ref Target`. Example: `@when Employment` points to
  an association entity, not a target model. That's a different
  abstraction level.
- `@virtual` was a semantic junk drawer covering at least three distinct
  things (no FK, remote, computed). Split into `check: false`, `@remote`,
  `@derive`.
- `@tree` / `@self` as top-level keywords was wrong. `self` is a
  *target modifier*.

The revised Part 2 factors these cleanly: a small set of **base forms**
plus **modifiers**.

## Naming pushback worth highlighting

- **`@any` → reconsider.** Peer review prefers `@union` (type-system
  native, precise) or `@poly` (ORM-native, precise) over `@any`
  (catchy, semantically mushy). In the revised proposal polymorphism is
  expressed as a *modifier* on base forms (`@ref Post | Comment`), so
  the keyword question may be moot — but if it remains, `@union` is
  stronger than `@any`.
- **`@via` vs. `@through`.** Narrow `@via` to *"many-to-many via this
  join entity"* and `@through` to *"traversal across an existing
  relation"*. Conflating them blurs write semantics and eager-loading
  rules that users will notice.
- **`@virtual`.** Don't make this one word do four jobs. See above.
- **`@peer`.** Good name, but expensive to implement correctly
  (symmetry canonicalization, inverse loading, self-peer edge cases).
  Treat as optional, specialized.

## What will be expensive to implement

Ordered from cheap to dangerous:

| Kind                            | Cost      | Notes                                                   |
|---------------------------------|-----------|---------------------------------------------------------|
| `@ref`, `@one`, `@many`         | cheap     | renames of existing                                     |
| `Target?`, `self`, sugar forms  | cheap     | parser-level                                            |
| `@embed` (with one storage pick)| cheap     | if we commit to inline-or-JSON, not both                |
| `@via` / `@through`             | moderate  | joins, preload, write-through rules, inverse discovery  |
| `@part`                         | moderate  | cascade, orphan prevention, unique-ownership constraints|
| `@any` / polymorphic modifier   | expensive | no real FK, painful migrations, awkward preload         |
| `@remote` / external            | expensive | runtime adapter matrix                                  |
| `@derive`                       | moderate  | read-only, explicit — fine if bounded                   |
| `@when` / temporal              | expensive | overlap policy, current-row, bitemporal, migrations     |
| `@peer`                         | moderate+ | symmetry canonicalization, inverse, self-peer           |
| `@link` (flagship)              | expensive | but already built — and the reason Rip is distinctive   |

The takeaway: *new primitives introduce engine work, not just grammar
work.* The renames can land first; the new kinds ship as capability
lands.

## Inverse semantics (under-discussed in the first draft)

At the 1000-model scale, a relation DSL lives or dies on:

- inverse detection (auto-pairing `@ref User` with `@many Post`)
- naming conventions (when target and role name disagree)
- alias stability across refactors
- generated accessor methods
- preload path naming

The revamp needs explicit answers for:

- How does `@ref User as: author` pair with `@many Post as: authoredPosts`?
- Can inverses be inferred across `@via`, `@through`, polymorphic,
  `@peer`, and `@link`?
- How are conflicting inverses resolved? (Fail loudly at schema-load
  time, not at query time.)

This probably deserves its own follow-up doc.

## Open questions

1. **`@via` form.** Positional (`@via Enrollment, Course`) or
   option-style (`@many Course via: Enrollment`)? The first reads as
   English; the second is more explicit.
2. **Polymorphism syntax.** `Post | Comment` (union) vs.
   `[Post, Comment]` (list)? The union form is prettier; the list form
   matches how arrays are spelled elsewhere in the grammar.
3. **Temporal semantics for `@when`.** If we adopt it, we must commit to
   specific column names, overlap policy, current-row semantics, and
   write rules. Otherwise don't ship it.
4. **`@link` charter.** Adopt the **block-form declarative** edge-schema
   (as shown above) as the canonical form at 1000-model scale, with the
   current single-line call-site form (`@link "admin", Organization`)
   retained as sugar for the simplest case. Keep the name `@link`
   rather than renaming to `@edge`.
5. **Hierarchy storage modifier.** For self-reference, do we model
   `storage: :adjacency | :path | :closure` as a first-class option, or
   leave it to the emitter? (First-class makes `@many self as: children`
   actually useful for deep trees.)
6. **`@embed` storage.** Composite columns vs. JSON column vs. separate
   table with `ON DELETE CASCADE` — is this a schema-level option, an
   emitter-level option, or fixed per-database?
7. **Migration path.** Three options:
   - *Additive only.* `@ref` is an alias for `@belongs_to`, new words
     slot in, nothing breaks.
   - *New primary, old aliases.* Docs and examples lead with new names;
     old keywords still work.
   - *Clean break.* Replace `@belongs_to`/`@has_one`/`@has_many`
     outright. Viable only before substantial production adoption.

---

# Part 4 — Comparison with Today's Rip Schema

| #   | Category                     | Today                      | Proposed                          |
|-----|------------------------------|----------------------------|-----------------------------------|
| 1   | FK on self                   | `@belongs_to`              | `@ref` (alias `@to`)              |
| 2   | Has one                      | `@has_one` / `@one`        | `@one` (alias `@from`)            |
| 3   | Has many                     | `@has_many` / `@many`      | `@many`                           |
| 4   | Many-to-many (join entity)   | two `@has_many` + join     | `@via`                            |
| 5   | Has-many-through (traversal) | manual                     | `@through`                        |
| 6   | Polymorphic belongs_to       | covered by `@link`         | `@ref A \| B as: :role`           |
| 7   | Polymorphic has_many         | covered by `@link`         | `@many X as: :role`               |
| 8   | Self-reference               | `@belongs_to` same model   | `@ref self as: …` (+ `storage:`)  |
| 9   | Embedded / composition       | via `@type` field          | `@embed`                          |
| 10  | Weak entity / cascade        | manual `ON DELETE`         | `@part`                           |
| 11  | Temporal                     | `@link` (signature feature)| `@when` or keep within `@link`    |
| 12a | Constraintless local ref     | plain field                | `@ref Target check: false`        |
| 12b | Remote / federated           | plain field                | `@remote`                         |
| 13  | Computed relation            | computed *fields* only     | `@derive`                         |
| 14  | Ordered                      | `@many` + orderBy          | `@list` (sugar over `@many`)      |
| 15  | Keyed / dictionary           | manual                     | `@map` (sugar over `@many`)       |
| 16  | Unordered-unique set         | `@many` + unique           | `@set` (sugar over `@many`)       |
| 18  | Peer (symmetric)             | via `@link`                | `@peer`                           |
| —   | Typed graph edge (flagship)  | `@link`                    | **keep `@link`**, formalize it    |

---

# References

- `packages/schema/SCHEMA.md` — current full spec, including relationship
  syntax as shipped.
- `packages/schema/README.md` — the user-facing overview of models,
  relations, and `@link`.
- `packages/schema/grammar.rip` — the Solar grammar; where any
  relationship-vocabulary change ultimately lands.
- `packages/schema/orm.js` — the runtime side: where new relation kinds
  would become accessor methods on instances.
- **Peer review** — this document was reviewed by GPT-5.4 via the
  `user-ai` MCP; the critique is folded into Parts 2 and 3. Highlights:
  split `@via`/`@through`; treat `@list`/`@set`/`@map` as sugar;
  decompose `@virtual`; keep `@link` as flagship; the core is not
  orthogonal until primitives and modifiers are separated.
