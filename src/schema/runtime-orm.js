// Schema runtime fragment: orm (server + migration)
//
// This file is the source of truth for one slice of the schema runtime.
// Edit here, then run `bun run build:schema-runtime` to regenerate
// `src/schema/runtime.generated.js`. Tests pin the public surface via
// test/schema/errors.test.js, test/schema/modes.test.js, and the source
// schema test suite.
//
// Fragments are concatenated INSIDE one shared IIFE wrapper at build time.
// They share scope; references like `__SchemaRegistry` resolve to bindings
// defined in earlier-included fragments. Editor tooling (LSP / lint) may
// not recognize cross-fragment references — that is expected; behavior is
// pinned by the test suite.

/* eslint-disable no-undef, no-unused-vars */
// ---- Adapter (Contract v2) -------------------------------------------------
//
// `query(sql, params) → {columns, data, rowCount}` is the only REQUIRED
// method. v2 adds optional capabilities that the runtime feature-detects:
//
//   begin(options?) → TxHandle        transactions (schema.transaction!)
//     TxHandle: { query(sql, params), commit(), rollback() }
//   capabilities: { tx: true, ... }   truthful self-report (informational)
//
// Calling a feature whose method is absent throws a clear error — never
// a silent fallback.
//
// The default adapter talks to a duckdb-harbor server (or any
// /sql-compatible server). Configuration via env:
//
//   RIP_DB_URL    base URL (default http://127.0.0.1:9494; legacy DB_URL
//                 honored as a fallback)
//   RIP_DB_TOKEN  bearer token, required when harbor runs authenticated
//
// Transactions use harbor's session protocol: POST /sql/sessions/new
// pins a DB session (connection) so BEGIN/COMMIT survive across
// requests; statements carry the sessionId; the session is destroyed
// after COMMIT/ROLLBACK. Harbor enforces an idle TTL, so an abandoned
// transaction auto-rolls-back server-side.
function __schemaDefaultAdapter() {
  const env = (typeof process !== 'undefined' && process.env) || {};
  const base = () => String(env.RIP_DB_URL || env.DB_URL || 'http://127.0.0.1:9494').replace(/\/+$/, '');
  const headers = () => {
    const h = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (env.RIP_DB_TOKEN) h['Authorization'] = 'Bearer ' + env.RIP_DB_TOKEN;
    return h;
  };
  async function post(path, body) {
    const res = await fetch(base() + path, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok || data.ok === false || data.error) {
      const err = new Error(data.error || ('db request failed: ' + res.status + ' ' + (res.statusText || '')));
      if (data.errorCode) err.code = data.errorCode;
      if (data.errorDetails) err.details = data.errorDetails;
      err.httpStatus = res.status;
      throw err;
    }
    return data;
  }
  return {
    async query(sql, params) {
      return post('/sql', params && params.length ? { sql, params } : { sql });
    },
    async begin(options) {
      let session;
      try {
        session = await post('/sql/sessions/new', {});
      } catch (e) {
        if (e && e.httpStatus === 403) {
          e.message = 'transactions need a harbor DB session, and harbor denied session creation ' +
            '(authz policy __HARBOR_ADMIN__:sessions:create). Allow it in your harbor_authorization_function ' +
            'or set harbor_allow_admin_without_authz = true on a trusted deployment. Original error: ' + e.message;
        }
        throw e;
      }
      const sessionId = session.sessionId;
      const run = (sql, params) =>
        post('/sql', params && params.length ? { sql, params, sessionId } : { sql, sessionId });
      const drop = async () => {
        // Best-effort: harbor's idle TTL reaps abandoned sessions, so a
        // failed DELETE only delays cleanup, never leaks a transaction.
        try {
          await fetch(base() + '/sql/sessions/' + sessionId, { method: 'DELETE', headers: headers() });
        } catch {}
      };
      await run('BEGIN');
      return {
        query: run,
        async commit() { await run('COMMIT'); await drop(); },
        async rollback() {
          try { await run('ROLLBACK'); } finally { await drop(); }
        },
      };
    },
    capabilities: { tx: true },
  };
}

let __schemaAdapter = __schemaDefaultAdapter();

function __schemaSetAdapter(a) { __schemaAdapter = a; }

// ---- Transactions ----------------------------------------------------------
//
// schema.transaction! ->                  propagates ambiently: every ORM
//   user = User.create! ...               call inside the block routes
//   Order.create! userId: user.id, ...    through the transaction's handle
//   user                                  via AsyncLocalStorage. Model code
//                                         is unchanged inside the block.
//
// Block throws   → ROLLBACK, exception propagates, afterRollback hooks fire.
// Block returns  → COMMIT, value returned, afterCommit hooks fire.
// Nested call    → joins the ambient transaction (Active Record's default;
//                  DuckDB has no SAVEPOINT, so nested-as-independent-unit
//                  cannot be honored on the primary backend).
//
// The ALS instance is created lazily on first use — `node:async_hooks`
// exists in Bun and Node, and the import never runs in browser bundles
// (this fragment is server/migration-only).
let __schemaTxALS = null;

// Ambient transaction store for the CURRENT adapter, or null. A store
// created against a different adapter (multi-DB future) is ignored —
// cross-adapter atomicity is impossible and the runtime never pretends
// otherwise.
function __schemaTxStore() {
  if (!__schemaTxALS) return null;
  const store = __schemaTxALS.getStore();
  return store && store.adapter === __schemaAdapter ? store : null;
}

// The single SQL funnel. Every ORM-issued statement flows through here:
// it routes to the ambient transaction handle when one exists, and
// translates DB constraint violations into structured SchemaErrors.
async function __schemaRunSQL(def, sql, params) {
  const tx = __schemaTxStore();
  try {
    return await (tx ? tx.handle.query(sql, params) : __schemaAdapter.query(sql, params));
  } catch (e) {
    throw __schemaTranslateDBError(e, def);
  }
}

async function __schemaTransaction(optsOrFn, maybeFn) {
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn;
  const opts = typeof optsOrFn === 'function' ? {} : (optsOrFn || {});
  if (typeof fn !== 'function') {
    throw new Error('schema.transaction(fn): expected a function (got ' + typeof fn + ')');
  }
  const adapter = __schemaAdapter;

  // Nested transaction joins the ambient one — the inner block's writes
  // commit or roll back with the outer transaction.
  const ambient = __schemaTxALS ? __schemaTxALS.getStore() : null;
  if (ambient && ambient.adapter === adapter) return fn();

  if (typeof adapter.begin !== 'function') {
    throw new Error(
      'schema.transaction(): the configured adapter does not support transactions ' +
      '(no begin() method; see Adapter Contract v2). Install an adapter with begin() ' +
      'or use the default @rip-lang/db adapter against duckdb-harbor.');
  }
  if (!__schemaTxALS) {
    const { AsyncLocalStorage } = await import('node:async_hooks');
    __schemaTxALS = new AsyncLocalStorage();
  }

  const handle = await adapter.begin(opts);
  // `after` collects {def, inst} for every save/destroy that completed
  // inside the transaction on a model declaring afterCommit/afterRollback.
  const store = { adapter, handle, after: [] };
  let result;
  try {
    result = await __schemaTxALS.run(store, fn);
  } catch (err) {
    try { await handle.rollback(); } catch {}
    await __schemaFlushTxHooks(store, 'afterRollback');
    throw err;
  }
  await handle.commit();
  // afterCommit runs OUTSIDE the transaction — this is where emails,
  // webhooks, and cache invalidation belong (they must never observe
  // uncommitted state). Exceptions here propagate to the caller but
  // cannot roll anything back: the COMMIT already happened.
  await __schemaFlushTxHooks(store, 'afterCommit');
  return result;
}

async function __schemaFlushTxHooks(store, hookName) {
  // Dedupe by instance: a row saved twice in one transaction gets one
  // callback, matching Active Record's after_commit semantics.
  const seen = new Set();
  for (const entry of store.after) {
    if (seen.has(entry.inst)) continue;
    seen.add(entry.inst);
    await __schemaRunHook(entry.def, entry.inst, hookName);
  }
}

// Queue an instance's commit-time hooks on the ambient transaction.
// Returns true when queued; false means "no ambient tx — fire now".
function __schemaEnqueueTxHook(def, inst) {
  const tx = __schemaTxStore();
  if (!tx) return false;
  tx.after.push({ def, inst });
  return true;
}

// ---- Constraint-violation translation --------------------------------------
//
// The ORM wraps every adapter call (via __schemaRunSQL). Errors that are
// recognizably DB constraint violations are translated into SchemaError
// so a `save!` that trips a UNIQUE index fails the same way a `save!`
// that trips a validator does: structured {field, error, message} issues.
// Unrecognized errors propagate untouched. The original error is kept
// as `.cause` for debugging.
//
// Recognition is message-pattern based (DuckDB first). Deliberately NOT
// added: `validates_uniqueness_of`-style pre-checks — they race. The DB
// constraint is the check; translation makes it ergonomic.
function __schemaTranslateDBError(e, def) {
  const msg = (e && e.message) || '';
  const issue = __schemaConstraintIssue(msg);
  if (!issue) return e;
  const err = new SchemaError([issue], def ? def.name : null, def ? def.kind : null);
  err.cause = e;
  return err;
}

function __schemaConstraintIssue(msg) {
  let m;
  // DuckDB: Constraint Error: Duplicate key "email: a@b.c" violates unique constraint ...
  //         (also "violates primary key constraint")
  m = msg.match(/[Dd]uplicate key "([A-Za-z0-9_]+):[^"]*" violates (?:unique|primary key) constraint/);
  if (m || /violates unique constraint/i.test(msg)) {
    const field = m ? __schemaCamel(m[1]) : '';
    return { field, error: 'unique', message: (field || 'value') + ' already taken' };
  }
  // DuckDB: Constraint Error: NOT NULL constraint failed: users.name
  m = msg.match(/NOT NULL constraint failed:\s*(?:[A-Za-z0-9_]+\.)?([A-Za-z0-9_]+)/i);
  if (m) {
    const field = __schemaCamel(m[1]);
    return { field, error: 'required', message: field + ' is required' };
  }
  // DuckDB: Constraint Error: Violates foreign key constraint because ... "user_id: 99" ...
  if (/[Vv]iolates foreign key constraint/.test(msg)) {
    m = msg.match(/"([A-Za-z0-9_]+):[^"]*"/);
    const field = m ? __schemaCamel(m[1]) : '';
    return { field, error: 'reference', message: (field || 'reference') + ' refers to a missing or still-referenced record' };
  }
  // DuckDB: Constraint Error: CHECK constraint failed: <table>
  if (/CHECK constraint failed/i.test(msg)) {
    return { field: '', error: 'check', message: msg };
  }
  return null;
}

// ---- Query builder ----------------------------------------------------------

class __SchemaQuery {
  constructor(def, opts = {}) {
    this._def = def;
    this._clauses = [];
    this._params = [];
    this._limit = null;
    this._offset = null;
    this._order = null;
    this._includes = [];
    // Soft-delete filter mode: 'live' (default), 'all' (.withDeleted),
    // 'deleted' (.onlyDeleted). Pre-v2 `includeDeleted` option maps to 'all'.
    this._deleted = opts.includeDeleted === true ? 'all' : 'live';
  }
  where(cond, ...params) {
    if (typeof cond === 'string') {
      this._clauses.push(cond);
      this._params.push(...params);
    } else if (cond && typeof cond === 'object') {
      for (const [k, v] of Object.entries(cond)) {
        const col = __schemaSnake(k);
        if (v === null || v === undefined) {
          this._clauses.push('"' + col + '" IS NULL');
        } else if (Array.isArray(v)) {
          this._clauses.push('"' + col + '" IN (' + v.map(() => '?').join(', ') + ')');
          this._params.push(...v);
        } else {
          this._clauses.push('"' + col + '" = ?');
          this._params.push(v);
        }
      }
    }
    return this;
  }
  limit(n) { this._limit = n; return this; }
  offset(n) { this._offset = n; return this; }
  order(spec) { this._order = spec; return this; }
  orderBy(spec) { return this.order(spec); }
  includes(...specs) {
    this._includes.push(...__schemaNormalizeIncludes(specs));
    return this;
  }
  withDeleted() { this._deleted = 'all'; return this; }
  onlyDeleted() { this._deleted = 'deleted'; return this; }
  _whereParts(norm) {
    const where = [...this._clauses];
    if (norm.softDelete) {
      if (this._deleted === 'live') where.push('"deleted_at" IS NULL');
      else if (this._deleted === 'deleted') where.push('"deleted_at" IS NOT NULL');
    }
    return where;
  }
  _buildSQL() {
    const n = this._def._normalize();
    const parts = ['SELECT * FROM "' + n.tableName + '"'];
    const where = this._whereParts(n);
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    if (this._order) parts.push('ORDER BY ' + this._order);
    if (this._limit != null) parts.push('LIMIT ' + this._limit);
    if (this._offset != null) parts.push('OFFSET ' + this._offset);
    return parts.join(' ');
  }
  async all() {
    const sql = this._buildSQL();
    const res = await __schemaRunSQL(this._def, sql, this._params);
    const instances = (res.data || []).map(row => this._def._hydrate(res.columns, row));
    // Eager loading: batched second queries (WHERE fk IN (...)) that
    // fill the relation memos. Never changes the root result set.
    if (this._includes.length && instances.length) {
      await __schemaPreload(this._def, instances, this._includes);
    }
    return instances;
  }
  async first() {
    this._limit = 1;
    const arr = await this.all();
    return arr[0] || null;
  }
  async count() {
    const n = this._def._normalize();
    const parts = ['SELECT COUNT(*) FROM "' + n.tableName + '"'];
    const where = this._whereParts(n);
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    const res = await __schemaRunSQL(this._def, parts.join(' '), this._params);
    return res.data?.[0]?.[0] || 0;
  }
  // One UPDATE statement for every matching row. Bypasses validation
  // and per-instance hooks — the name says "all", the docs say "raw".
  // Returns the adapter's reported row count when available.
  async updateAll(values) {
    const n = this._def._normalize();
    const keys = values && typeof values === 'object' ? Object.keys(values) : [];
    if (!keys.length) throw new Error('updateAll: requires at least one column to set');
    const sets = [];
    const params = [];
    for (const k of keys) {
      const name = __schemaCamel(k);
      const field = n.fields.get(name);
      sets.push('"' + __schemaSnake(k) + '" = ?');
      params.push(__schemaSerialize(values[k], field));
    }
    if (n.timestamps) {
      sets.push('"updated_at" = ?');
      params.push(new Date().toISOString());
    }
    const where = this._whereParts(n);
    let sql = 'UPDATE "' + n.tableName + '" SET ' + sets.join(', ');
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const res = await __schemaRunSQL(this._def, sql, [...params, ...this._params]);
    return res.rowCount ?? res.rows ?? null;
  }
  // One statement for every matching row. Soft-delete aware: on a
  // @softDelete model this is an UPDATE setting deleted_at; on a hard
  // model it's a real DELETE. Bypasses per-instance hooks (bulk path).
  async deleteAll() {
    const n = this._def._normalize();
    const where = this._whereParts(n);
    let sql, params;
    if (n.softDelete && this._deleted === 'live') {
      sql = 'UPDATE "' + n.tableName + '" SET "deleted_at" = ?';
      params = [new Date().toISOString(), ...this._params];
    } else {
      sql = 'DELETE FROM "' + n.tableName + '"';
      params = this._params;
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    const res = await __schemaRunSQL(this._def, sql, params);
    return res.rowCount ?? res.rows ?? null;
  }
}

// ---- Eager loading ----------------------------------------------------------

// Normalize .includes arguments into [{name, children}] trees. Accepts
// :symbols, strings, arrays, and nested maps to any depth:
//   .includes(:orders)
//   .includes(:author, comments: :author)
function __schemaNormalizeIncludes(specs) {
  const out = [];
  for (const s of specs) {
    if (s == null) continue;
    if (typeof s === 'symbol') out.push({ name: Symbol.keyFor(s) || s.description, children: [] });
    else if (typeof s === 'string') out.push({ name: s, children: [] });
    else if (Array.isArray(s)) out.push(...__schemaNormalizeIncludes(s));
    else if (typeof s === 'object') {
      for (const [k, v] of Object.entries(s)) {
        out.push({ name: k, children: __schemaNormalizeIncludes([v]) });
      }
    }
  }
  return out;
}

// Batched preload: one query per relation per nesting level
// (`WHERE fk IN (?, …)`), never JOINs — no row duplication, uniform
// across belongs_to / has_one / has_many. Results land in the relation
// memo, so `user.orders!` resolves from cache with no query. Invisible
// to call sites: preloading is purely a performance fact.
async function __schemaPreload(def, instances, specs) {
  if (!instances.length || !specs.length) return;
  const norm = def._normalize();
  for (const spec of specs) {
    const rel = norm.relations.get(spec.name);
    if (!rel) {
      throw new Error(
        "schema: includes('" + spec.name + "') — no such relation on " + (def.name || 'model') +
        '. Declared relations: ' + ([...norm.relations.keys()].join(', ') || '(none)'));
    }
    const target = __SchemaRegistry.get(rel.target);
    if (!target) throw new Error('schema: unknown relation target "' + rel.target + '" from ' + (def.name || 'anon'));
    const children = [];
    if (rel.kind === 'belongsTo') {
      const fkCamel = __schemaCamel(rel.foreignKey);
      const ids = [...new Set(instances.map(i => i[fkCamel]).filter(v => v != null))];
      const rows = ids.length ? await target.findMany(ids) : [];
      const pk = target._normalize().primaryKey;
      const byId = new Map(rows.map(r => [r[pk], r]));
      for (const inst of instances) {
        const v = inst[fkCamel] != null ? (byId.get(inst[fkCamel]) ?? null) : null;
        __schemaRelMemoSet(inst, spec.name, v);
        if (v && !children.includes(v)) children.push(v);
      }
    } else {
      const pk = norm.primaryKey;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const ids = [...new Set(instances.map(i => i[pk]).filter(v => v != null))];
      let rows = [];
      if (ids.length) {
        rows = await new __SchemaQuery(target)
          .where('"' + rel.foreignKey + '" IN (' + ids.map(() => '?').join(', ') + ')', ...ids)
          .all();
      }
      const groups = new Map();
      for (const r of rows) {
        const k = r[fkCamel];
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
        children.push(r);
      }
      for (const inst of instances) {
        const g = groups.get(inst[pk]) || [];
        __schemaRelMemoSet(inst, spec.name, rel.kind === 'hasOne' ? (g[0] ?? null) : g);
      }
    }
    if (spec.children.length) await __schemaPreload(target, children, spec.children);
  }
}

async function __schemaResolveRelation(def, inst, rel) {
  const target = __SchemaRegistry.get(rel.target);
  if (!target) throw new Error('schema: unknown relation target "' + rel.target + '" from ' + (def.name || 'anon'));
  const pk = def._normalize().primaryKey;
  if (rel.kind === 'belongsTo') {
    const fk = inst[__schemaCamel(rel.foreignKey)];
    return fk != null ? await target.find(fk) : null;
  }
  if (rel.kind === 'hasOne') {
    return await target.where({ [rel.foreignKey]: inst[pk] }).first();
  }
  if (rel.kind === 'hasMany') {
    return await target.where({ [rel.foreignKey]: inst[pk] }).all();
  }
  return null;
}

// ---- Save / destroy ----------------------------------------------------------

async function __schemaRunHook(def, inst, name) {
  const fn = def._normalize().hooks.get(name);
  if (fn) await fn.call(inst);
}

// After a successful save/destroy: queue afterCommit/afterRollback on
// the ambient transaction, or fire afterCommit immediately when no
// transaction is open (AR semantics: outside a tx, "commit" is the
// statement itself). Only models that declare one of the two hooks pay
// any cost here.
async function __schemaSettleTxHooks(def, inst) {
  const hooks = def._normalize().hooks;
  if (!hooks.has('afterCommit') && !hooks.has('afterRollback')) return;
  if (!__schemaEnqueueTxHook(def, inst)) {
    await __schemaRunHook(def, inst, 'afterCommit');
  }
}

async function __schemaSave(def, inst) {
  // Re-entry guard. Same-instance re-entry into save() — typically a
  // hook on this very instance calling .save() on `this` — would race
  // the snapshot / savedChanges machinery and almost certainly loop
  // forever. Throw a clear error instead. The flag is per-instance, so
  // independent instances saving in parallel are unaffected; sequential
  // saves on the same instance work fine because `finally` clears it.
  if (inst._saving) {
    throw new Error(
      "schema: save() re-entered on the same " + (def.name || 'instance') +
      "; a hook on this instance called save() while a save was already in flight."
    );
  }
  inst._saving = true;
  try {

  const norm = def._normalize();
  const isNew = !inst._persisted;

  await __schemaRunHook(def, inst, 'beforeValidation');
  const errs = def._validateFields(inst, true);
  if (errs.length) throw new SchemaError(errs, def.name, def.kind);
  await __schemaRunHook(def, inst, 'afterValidation');

  await __schemaRunHook(def, inst, 'beforeSave');
  if (isNew) await __schemaRunHook(def, inst, 'beforeCreate');
  else       await __schemaRunHook(def, inst, 'beforeUpdate');

  // Reset `savedChanges` at the start of every save so it always
  // reflects the most recent write, never accumulates. Hooks running
  // from this point until end-of-save read this Map; afterCreate /
  // afterUpdate / afterSave see the just-completed write's diff.
  inst.savedChanges = new Map();

  if (isNew) {
    const cols = [], placeholders = [], values = [];
    // Track which persisted columns actually got written so savedChanges
    // can record [null, newValue] entries below. Both declared fields
    // and belongsTo FK columns count.
    const writtenColumns = [];
    for (const [n, f] of norm.fields) {
      const v = inst[n];
      if (v == null) continue;
      cols.push('"' + __schemaSnake(n) + '"');
      placeholders.push('?');
      values.push(__schemaSerialize(v, f));
      writtenColumns.push([n, v]);
    }
    // Include relation FKs. belongsTo FKs are camelCase properties on
    // the instance (e.g. organizationId for organization_id).
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const v = inst[fkCamel];
      if (v != null) {
        cols.push('"' + rel.foreignKey + '"');
        placeholders.push('?');
        values.push(v);
        writtenColumns.push([fkCamel, v]);
      }
    }
    const sql = 'INSERT INTO "' + norm.tableName + '" (' + cols.join(', ') + ') VALUES (' + placeholders.join(', ') + ') RETURNING *';
    const res = await __schemaRunSQL(def, sql, values);
    if (res.data?.[0] && res.columns) {
      __schemaAbsorbRow(inst, res.columns, res.data[0]);
    }
    // Now that the RETURNING columns (id, @timestamps, FKs) are on the
    // instance, !> eager-derived fields can see them. Mirrors the hydrate
    // path, which runs _applyEagerDerived once all declared fields are
    // populated. Per-docs semantics ("materialize once, not reactive")
    // still hold — we're firing once, at end of construction, not on
    // subsequent mutations.
    //
    // Order matters here: snapshot the declared-field state BEFORE
    // flipping `_persisted`, so a later save() can never see the
    // combination "_persisted = true, _snapshot = null" (which would
    // fall through to a full-row UPDATE and reintroduce the FK bug).
    def._applyEagerDerived(inst);
    inst._snapshot = __schemaSnapshot(norm, inst);
    inst._persisted = true;
    // Populate savedChanges with [null, newValue] per persisted column
    // that was written (declared fields + belongsTo FKs). Mirrors
    // Active Record: on a fresh INSERT every attribute "changed from
    // nil to its new value". @timestamps columns get the same
    // [null, newValue] treatment using the values RETURNING gave us
    // — they were assigned on this INSERT, so they belong in the diff.
    for (const [n, v] of writtenColumns) inst.savedChanges.set(n, [null, v]);
    if (norm.timestamps) {
      if (inst.createdAt != null) inst.savedChanges.set('createdAt', [null, inst.createdAt]);
      if (inst.updatedAt != null) inst.savedChanges.set('updatedAt', [null, inst.updatedAt]);
    }
  } else {
    // Column-targeted UPDATE: only write fields that actually changed
    // since hydrate / last save (snapshot comparison) or that the caller
    // explicitly marked dirty via .markDirty(name) — escape hatch for
    // in-place mutations of object-valued fields where === can't detect
    // change. Two reasons this matters:
    //   1. Skip a wasted DB round-trip when nothing changed.
    //   2. DuckDB's foreign-key implementation rejects UPDATE statements
    //      that touch indexed columns (PK / UNIQUE) on a row that is
    //      referenced by another table's FK — even when the SET is a
    //      no-op like "mrn = mrn". A full-row UPDATE on a parent table
    //      with any child rows is therefore a hard error in DuckDB.
    //      Writing only changed columns keeps no-op saves entirely off
    //      the index path.
    //
    // We build `nextSnap` from the values we are about to write — BEFORE
    // the await — and only install it on success. Doing this after the
    // await would be unsafe under concurrent mutation: a write to the
    // instance during the in-flight query would be captured into the
    // post-await snapshot, mark itself "clean", and never be persisted.
    //
    // `nextSnap` is allocated lazily on the first changed field; the
    // common no-op-save path keeps zero allocations.
    const sets = [], values = [];
    const snap = inst._snapshot;
    const dirty = inst._dirty;
    const changes = inst.savedChanges;
    let nextSnap = null;
    // Declared fields.
    for (const [n, f] of norm.fields) {
      const cur = inst[n];
      const isDirty = dirty && dirty.has(n);
      const changed = !snap || !Object.prototype.hasOwnProperty.call(snap, n) || !__schemaSameValue(snap[n], cur);
      if (!isDirty && !changed) continue;
      if (!nextSnap) nextSnap = Object.assign(Object.create(null), snap || {});
      sets.push('"' + __schemaSnake(n) + '" = ?');
      values.push(__schemaSerialize(cur, f));
      nextSnap[n] = cur;
      // Record [oldValue, newValue] for hook consumers / audit. Old
      // value comes from the snapshot; if no snapshot existed (first
      // save after a manually-constructed persisted instance) we
      // record null as the old value, which is the best information
      // we have.
      const old = snap && Object.prototype.hasOwnProperty.call(snap, n) ? snap[n] : null;
      changes.set(n, [old, cur]);
    }
    // belongsTo FK columns. Same dirty / snapshot / savedChanges
    // machinery as declared fields, but the SQL column name is
    // already snake_case (rel.foreignKey) and the value isn't passed
    // through __schemaSerialize since FKs are scalar IDs.
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      const fkCamel = __schemaCamel(rel.foreignKey);
      const cur = inst[fkCamel];
      const isDirty = dirty && dirty.has(fkCamel);
      const changed = !snap || !Object.prototype.hasOwnProperty.call(snap, fkCamel) || !__schemaSameValue(snap[fkCamel], cur);
      if (!isDirty && !changed) continue;
      if (!nextSnap) nextSnap = Object.assign(Object.create(null), snap || {});
      sets.push('"' + rel.foreignKey + '" = ?');
      values.push(cur);
      nextSnap[fkCamel] = cur;
      const old = snap && Object.prototype.hasOwnProperty.call(snap, fkCamel) ? snap[fkCamel] : null;
      changes.set(fkCamel, [old, cur]);
    }
    // @timestamps: bump updated_at iff this UPDATE will actually emit
    // SQL. The check sits between the diff loops and the write, so we
    // only touch the column when sets has something else in it —
    // never on a no-op save (which would defeat the column-targeted
    // UPDATE optimization and reintroduce a wasted DB round-trip).
    // The column itself isn't in `_snapshot` (we always overwrite it
    // explicitly on every real write, never compare it for diffs),
    // so we mirror the new value onto the instance and record it in
    // savedChanges to mirror Active Record's saved_changes shape.
    //
    // `oldTs` is the in-memory value at this moment, which after
    // hydrate is the DB-loaded timestamp and after a prior save in
    // this session is the value we set then. If user code reassigns
    // `inst.updatedAt` between saves, the recorded "old" reflects
    // that reassignment, not what's actually in the DB. The implicit
    // column isn't in the snapshot for the same reason it isn't in
    // the diff loop: we always overwrite it on real writes.
    //
    // Declaring `updatedAt` as a regular field is rejected at schema
    // definition (__SCHEMA_RESERVED_IMPLICIT) so we can't end up with
    // duplicate "updated_at = ?" entries in `sets`.
    if (norm.timestamps && sets.length > 0) {
      const newTs = new Date().toISOString();
      const oldTs = inst.updatedAt != null ? inst.updatedAt : null;
      sets.push('"updated_at" = ?');
      values.push(newTs);
      inst.updatedAt = newTs;
      changes.set('updatedAt', [oldTs, newTs]);
    }
    if (sets.length) {
      // WHERE uses the *original* PK from the snapshot, not the live
      // `inst[pk]` value. If user code reassigns the in-memory PK
      // between hydrate and save, the UPDATE still targets the row
      // that was actually loaded — mirrors Active Record, which
      // ignores in-memory PK mutation when building the UPDATE.
      // Falls back to `inst[pk]` only when no snapshot exists (e.g.
      // a manually-constructed persisted instance), where there's
      // no better information available. We log a warning in non-prod
      // when the fallback fires, since "persisted instance with no
      // snapshot" is almost always an accidental misuse pattern.
      const pk = norm.primaryKey;
      let wherePk;
      if (snap && snap[pk] != null) {
        wherePk = snap[pk];
      } else {
        wherePk = inst[pk];
        if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
          console.warn(
            "[schema] " + (def.name || 'save()') + ": no _snapshot, falling back to inst." + pk +
            " for the UPDATE WHERE clause. This usually means the instance was constructed " +
            "with _persisted = true without going through hydrate(); the WHERE will target " +
            "whatever inst." + pk + " happens to be at save time."
          );
        }
      }
      values.push(wherePk);
      const sql = 'UPDATE "' + norm.tableName + '" SET ' + sets.join(', ') + ' WHERE "' + pk + '" = ?';
      await __schemaRunSQL(def, sql, values);
      inst._snapshot = nextSnap;
    }
  }
  inst._dirty.clear();

  if (isNew) await __schemaRunHook(def, inst, 'afterCreate');
  else       await __schemaRunHook(def, inst, 'afterUpdate');
  await __schemaRunHook(def, inst, 'afterSave');
  await __schemaSettleTxHooks(def, inst);
  return inst;

  } finally {
    inst._saving = false;
  }
}

// Absorb a RETURNING row onto an instance: camelCase canonical own
// properties plus non-enumerable snake_case aliases. Shared by the
// INSERT path, upsert, and restore.
function __schemaAbsorbRow(inst, columns, row) {
  for (let i = 0; i < columns.length; i++) {
    const snake = columns[i].name;
    const key = __schemaCamel(snake);
    if (!(key in inst)) {
      Object.defineProperty(inst, key, { value: row[i], enumerable: true, writable: true, configurable: true });
    } else {
      inst[key] = row[i];
    }
    if (snake !== key && !(snake in inst)) {
      Object.defineProperty(inst, snake, {
        enumerable: false, configurable: true,
        get() { return this[key]; },
        set(v) { this[key] = v; },
      });
    }
  }
}

async function __schemaDestroy(def, inst, opts) {
  if (!inst._persisted) return inst;
  const norm = def._normalize();
  const hard = opts && opts.hard === true;
  await __schemaRunHook(def, inst, 'beforeDestroy');
  if (norm.softDelete && !hard) {
    const now = new Date().toISOString();
    await __schemaRunSQL(def, 'UPDATE "' + norm.tableName + '" SET "deleted_at" = ? WHERE "' + norm.primaryKey + '" = ?', [now, inst[norm.primaryKey]]);
    inst.deletedAt = now;
  } else {
    await __schemaRunSQL(def, 'DELETE FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
    inst._persisted = false;
  }
  await __schemaRunHook(def, inst, 'afterDestroy');
  await __schemaSettleTxHooks(def, inst);
  return inst;
}

// Soft-delete recovery: UPDATE ... SET deleted_at = NULL. Fires the
// update lifecycle (beforeUpdate/afterUpdate) like Active Record's
// touch-style writes. Only meaningful on @softDelete models.
async function __schemaRestore(def, inst) {
  const norm = def._normalize();
  if (!norm.softDelete) {
    throw new Error('schema: restore() requires @softDelete on ' + (def.name || 'model'));
  }
  if (!inst._persisted) return inst;
  await __schemaRunHook(def, inst, 'beforeUpdate');
  await __schemaRunSQL(def, 'UPDATE "' + norm.tableName + '" SET "deleted_at" = NULL WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
  inst.deletedAt = null;
  await __schemaRunHook(def, inst, 'afterUpdate');
  return inst;
}

function __schemaSerialize(v, field) {
  if (field && field.typeName === 'json' && v != null && typeof v === 'object') {
    return JSON.stringify(v);
  }
  return v;
}

// ---- ORM prototype augmentations — added to __SchemaDef ----------------------

__SchemaDef.prototype.find = async function (id) {
  this._assertModel('find');
  const norm = this._normalize();
  const soft = norm.softDelete ? ' AND "deleted_at" IS NULL' : '';
  const sql = 'SELECT * FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?' + soft + ' LIMIT 1';
  const res = await __schemaRunSQL(this, sql, [id]);
  // Harbor returns rowCount (not the legacy `rows` alias). Treat both
  // as authoritative so the runtime works against any /sql adapter
  // that has a row-count field, regardless of which name it uses.
  const n = res.rowCount ?? res.rows;
  if (!n || !res.data?.[0]) return null;
  return this._hydrate(res.columns, res.data[0]);
};

__SchemaDef.prototype.findMany = async function (ids) {
  this._assertModel('findMany');
  if (!Array.isArray(ids)) throw new Error('schema: findMany(ids) expects an array');
  if (!ids.length) return [];
  const norm = this._normalize();
  return new __SchemaQuery(this)
    .where('"' + norm.primaryKey + '" IN (' + ids.map(() => '?').join(', ') + ')', ...ids)
    .all();
};

__SchemaDef.prototype.where = function (cond, ...params) {
  this._assertModel('where');
  return new __SchemaQuery(this).where(cond, ...params);
};

__SchemaDef.prototype.includes = function (...specs) {
  this._assertModel('includes');
  return new __SchemaQuery(this).includes(...specs);
};

__SchemaDef.prototype.withDeleted = function () {
  this._assertModel('withDeleted');
  return new __SchemaQuery(this).withDeleted();
};

__SchemaDef.prototype.onlyDeleted = function () {
  this._assertModel('onlyDeleted');
  return new __SchemaQuery(this).onlyDeleted();
};

__SchemaDef.prototype.all = function () {
  this._assertModel('all');
  return new __SchemaQuery(this).all();
};

__SchemaDef.prototype.first = function () {
  this._assertModel('first');
  return new __SchemaQuery(this).first();
};

__SchemaDef.prototype.count = function () {
  this._assertModel('count');
  return new __SchemaQuery(this).count();
};

__SchemaDef.prototype.create = async function (data) {
  this._assertModel('create');
  // Input keys may be snake_case or camelCase; the runtime
  // canonicalizes to camelCase so instance properties line up with
  // declared field names.
  const klass = this._getClass();
  const canonical = {};
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
  }
  const inst = new klass(this._applyDefaults(canonical), false);
  // FK columns like user_id canonicalize to userId and need to
  // round-trip through the INSERT path, so attach them as own
  // properties even though they aren't declared fields.
  for (const [k, v] of Object.entries(canonical)) {
    if (!(k in inst)) {
      Object.defineProperty(inst, k, { value: v, enumerable: true, writable: true, configurable: true });
    }
  }
  await __schemaSave(this, inst);
  return inst;
};

// INSERT ... ON CONFLICT (target) DO UPDATE SET ... RETURNING *.
//
//   User.upsert! {email: "a@b.c", name: "Alice"}, on: :email
//
// Validates the row and fires beforeValidation / beforeSave / afterSave.
// beforeCreate/beforeUpdate do NOT fire — the runtime cannot know which
// branch the database took. The conflict target accepts a :symbol,
// string, or array of either (composite targets).
__SchemaDef.prototype.upsert = async function (data, opts) {
  this._assertModel('upsert');
  const norm = this._normalize();
  const on = opts && (opts.on ?? opts.conflict);
  if (on == null) throw new Error("schema: upsert(data, on: :column) requires a conflict target");
  const targets = (Array.isArray(on) ? on : [on]).map(t =>
    __schemaSnake(typeof t === 'symbol' ? (Symbol.keyFor(t) || t.description) : String(t)));

  const klass = this._getClass();
  const canonical = {};
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
  }
  const inst = new klass(this._applyDefaults(canonical), false);
  for (const [k, v] of Object.entries(canonical)) {
    if (!(k in inst)) {
      Object.defineProperty(inst, k, { value: v, enumerable: true, writable: true, configurable: true });
    }
  }

  await __schemaRunHook(this, inst, 'beforeValidation');
  const errs = this._validateFields(inst, true);
  if (errs.length) throw new SchemaError(errs, this.name, this.kind);
  await __schemaRunHook(this, inst, 'afterValidation');
  await __schemaRunHook(this, inst, 'beforeSave');

  const cols = [], placeholders = [], values = [];
  for (const [n, f] of norm.fields) {
    const v = inst[n];
    if (v == null) continue;
    cols.push(__schemaSnake(n));
    placeholders.push('?');
    values.push(__schemaSerialize(v, f));
  }
  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    const v = inst[__schemaCamel(rel.foreignKey)];
    if (v != null) {
      cols.push(rel.foreignKey);
      placeholders.push('?');
      values.push(v);
    }
  }
  if (!cols.length) throw new Error('schema: upsert() requires at least one column');
  const updateCols = cols.filter(c => !targets.includes(c));
  let conflict = ' ON CONFLICT (' + targets.map(t => '"' + t + '"').join(', ') + ')';
  if (updateCols.length) {
    const sets = updateCols.map(c => '"' + c + '" = EXCLUDED."' + c + '"');
    if (norm.timestamps) sets.push('"updated_at" = CURRENT_TIMESTAMP');
    conflict += ' DO UPDATE SET ' + sets.join(', ');
  } else {
    conflict += ' DO NOTHING';
  }
  const sql = 'INSERT INTO "' + norm.tableName + '" (' + cols.map(c => '"' + c + '"').join(', ') + ')' +
    ' VALUES (' + placeholders.join(', ') + ')' + conflict + ' RETURNING *';
  const res = await __schemaRunSQL(this, sql, values);
  if (res.data?.[0] && res.columns) __schemaAbsorbRow(inst, res.columns, res.data[0]);
  this._applyEagerDerived(inst);
  inst._snapshot = __schemaSnapshot(norm, inst);
  inst._persisted = true;
  await __schemaRunHook(this, inst, 'afterSave');
  await __schemaSettleTxHooks(this, inst);
  return inst;
};

// Bulk insert: validates EVERY row first (collecting all failures into
// one SchemaError, issues prefixed `[i].field`, before any SQL), then
// issues one multi-VALUES INSERT ... RETURNING *. Per-instance hooks
// are deliberately skipped — this is the bulk path; use create! in a
// loop when hooks matter. Returns hydrated instances.
__SchemaDef.prototype.insertMany = async function (rows) {
  this._assertModel('insertMany');
  if (!Array.isArray(rows)) throw new Error('schema: insertMany(rows) expects an array');
  if (!rows.length) return [];
  const norm = this._normalize();

  const canonicalRows = [];
  const allErrs = [];
  for (let i = 0; i < rows.length; i++) {
    const canonical = {};
    const data = rows[i];
    if (data && typeof data === 'object') {
      for (const k of Object.keys(data)) canonical[__schemaCamel(k)] = data[k];
    }
    this._applyDefaults(canonical);
    for (const e of this._validateFields(canonical, true)) {
      allErrs.push({
        field: '[' + i + ']' + (e.field ? '.' + e.field : ''),
        error: e.error,
        message: '[' + i + '] ' + e.message,
      });
    }
    canonicalRows.push(canonical);
  }
  if (allErrs.length) throw new SchemaError(allErrs, this.name, this.kind);

  // Column set = union of written columns across rows (missing values
  // insert as NULL / column default).
  const colSet = new Set();
  for (const row of canonicalRows) {
    for (const [n] of norm.fields) if (row[n] != null) colSet.add(n);
    for (const [, rel] of norm.relations) {
      if (rel.kind !== 'belongsTo') continue;
      if (row[__schemaCamel(rel.foreignKey)] != null) colSet.add(__schemaCamel(rel.foreignKey));
    }
  }
  const colNames = [...colSet];
  if (!colNames.length) throw new Error('schema: insertMany() requires at least one column');
  const values = [];
  const tuples = [];
  for (const row of canonicalRows) {
    const slots = [];
    for (const n of colNames) {
      slots.push('?');
      values.push(__schemaSerialize(row[n] ?? null, norm.fields.get(n)));
    }
    tuples.push('(' + slots.join(', ') + ')');
  }
  const sql = 'INSERT INTO "' + norm.tableName + '" (' +
    colNames.map(n => '"' + __schemaSnake(n) + '"').join(', ') + ') VALUES ' +
    tuples.join(', ') + ' RETURNING *';
  const res = await __schemaRunSQL(this, sql, values);
  return (res.data || []).map(row => this._hydrate(res.columns, row));
};

__SchemaDef.prototype._assertModel = function (api) {
  if (this.kind !== 'model') {
    throw new Error('schema: .' + api + '() is :model-only (got :' + this.kind + ')');
  }
}

// ---- Schema algebra (Phase 6) --------------------------------------------
// Invariant: every algebra operation returns a :shape. Model algebra
// strips ORM; :shape algebra drops behavior. Derived shapes preserve
// field metadata (constraints, defaults, modifiers) from the source
// normalized descriptor.
