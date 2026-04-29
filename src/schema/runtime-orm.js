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
function __schemaDefaultAdapter() {
  const url = (typeof process !== 'undefined' && process.env?.DB_URL) || 'http://localhost:4213';
  return {
    async query(sql, params) {
      const body = params && params.length ? { sql, params } : { sql };
      const res = await fetch(url + '/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    }
  };
}

let __schemaAdapter = __schemaDefaultAdapter();

function __schemaSetAdapter(a) { __schemaAdapter = a; }

class __SchemaQuery {
  constructor(def, opts = {}) {
    this._def = def;
    this._clauses = [];
    this._params = [];
    this._limit = null;
    this._offset = null;
    this._order = null;
    this._includeDeleted = opts.includeDeleted === true;
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
  _buildSQL() {
    const n = this._def._normalize();
    const table = n.tableName;
    const parts = ['SELECT * FROM "' + table + '"'];
    const where = [...this._clauses];
    if (!this._includeDeleted && n.softDelete) where.push('"deleted_at" IS NULL');
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    if (this._order) parts.push('ORDER BY ' + this._order);
    if (this._limit != null) parts.push('LIMIT ' + this._limit);
    if (this._offset != null) parts.push('OFFSET ' + this._offset);
    return parts.join(' ');
  }
  async all() {
    const sql = this._buildSQL();
    const res = await __schemaAdapter.query(sql, this._params);
    return (res.data || []).map(row => this._def._hydrate(res.columns, row));
  }
  async first() {
    this._limit = 1;
    const arr = await this.all();
    return arr[0] || null;
  }
  async count() {
    const n = this._def._normalize();
    const parts = ['SELECT COUNT(*) FROM "' + n.tableName + '"'];
    const where = [...this._clauses];
    if (!this._includeDeleted && n.softDelete) where.push('"deleted_at" IS NULL');
    if (where.length) parts.push('WHERE ' + where.join(' AND '));
    const res = await __schemaAdapter.query(parts.join(' '), this._params);
    return res.data?.[0]?.[0] || 0;
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

async function __schemaRunHook(def, inst, name) {
  const fn = def._normalize().hooks.get(name);
  if (fn) await fn.call(inst);
}

async function __schemaSave(def, inst) {
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
    const res = await __schemaAdapter.query(sql, values);
    if (res.data?.[0] && res.columns) {
      for (let i = 0; i < res.columns.length; i++) {
        const snake = res.columns[i].name;
        const key = __schemaCamel(snake);
        if (!(key in inst)) {
          Object.defineProperty(inst, key, { value: res.data[0][i], enumerable: true, writable: true, configurable: true });
        } else {
          inst[key] = res.data[0][i];
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
      // no better information available.
      const pk = norm.primaryKey;
      const wherePk = snap && snap[pk] != null ? snap[pk] : inst[pk];
      values.push(wherePk);
      const sql = 'UPDATE "' + norm.tableName + '" SET ' + sets.join(', ') + ' WHERE "' + pk + '" = ?';
      await __schemaAdapter.query(sql, values);
      inst._snapshot = nextSnap;
    }
  }
  inst._dirty.clear();

  if (isNew) await __schemaRunHook(def, inst, 'afterCreate');
  else       await __schemaRunHook(def, inst, 'afterUpdate');
  await __schemaRunHook(def, inst, 'afterSave');
  return inst;
}

async function __schemaDestroy(def, inst) {
  if (!inst._persisted) return inst;
  const norm = def._normalize();
  await __schemaRunHook(def, inst, 'beforeDestroy');
  if (norm.softDelete) {
    const now = new Date().toISOString();
    await __schemaAdapter.query('UPDATE "' + norm.tableName + '" SET "deleted_at" = ? WHERE "' + norm.primaryKey + '" = ?', [now, inst[norm.primaryKey]]);
    inst.deletedAt = now;
  } else {
    await __schemaAdapter.query('DELETE FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?', [inst[norm.primaryKey]]);
    inst._persisted = false;
  }
  await __schemaRunHook(def, inst, 'afterDestroy');
  return inst;
}

function __schemaSerialize(v, field) {
  if (field && field.typeName === 'json' && v != null && typeof v === 'object') {
    return JSON.stringify(v);
  }
  return v;
}

// ORM prototype augmentations — added to __SchemaDef

__SchemaDef.prototype.find = async function (id) {
  this._assertModel('find');
  const norm = this._normalize();
  const soft = norm.softDelete ? ' AND "deleted_at" IS NULL' : '';
  const sql = 'SELECT * FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?' + soft + ' LIMIT 1';
  const res = await __schemaAdapter.query(sql, [id]);
  if (!res.rows) return null;
  return this._hydrate(res.columns, res.data[0]);
};

__SchemaDef.prototype.where = function (cond, ...params) {
  this._assertModel('where');
  return new __SchemaQuery(this).where(cond, ...params);
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
