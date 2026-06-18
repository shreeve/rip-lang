// Schema runtime fragment: ddl (migration only)
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
const __SCHEMA_SQL_TYPES = {
  string: 'VARCHAR', text: 'TEXT', integer: 'INTEGER', number: 'DOUBLE',
  boolean: 'BOOLEAN', date: 'DATE', datetime: 'TIMESTAMP', email: 'VARCHAR',
  url: 'VARCHAR', uuid: 'UUID', phone: 'VARCHAR', zip: 'VARCHAR', json: 'JSON', any: 'JSON',
};

// ---- Canonical table spec ----------------------------------------------------
//
// The DDL emitter's internal model, exposed (roadmap §2.2). One structure
// serves both directions: `_tableSpec()` builds it from Layer 2 metadata,
// `__schemaIntrospect()` (migrate fragment) builds the same shape from the
// deployed database, and the differ operates on two values of the same type.
//
//   {
//     name,                                    // table name
//     sequence: { name, start } | null,        // auto-id sequence
//     primaryKey,                              // pk column name
//     columns: [{ name, type, notNull, unique, default, primary?, was? }],
//     indexes: [{ name, columns: [..], unique }],
//     foreignKeys: [{ column, refTable, refColumn }],
//     tableWas,                                // rename annotation or null
//   }
//
// `type` is the RENDER type (VARCHAR(100) keeps its length hint); the
// differ compares via __schemaTypeKey, which normalizes away parts DuckDB
// doesn't persist. `default` is the rendered SQL default string or null.

function __schemaColumnSpec(name, field) {
  let base = __SCHEMA_SQL_TYPES[field.typeName] || 'VARCHAR';
  if (field.array) base = 'JSON';
  if (base === 'VARCHAR' && field.constraints?.max != null) {
    base = 'VARCHAR(' + field.constraints.max + ')';
  }
  return {
    name: __schemaSnake(name),
    type: base,
    notNull: field.required === true,
    unique: field.unique === true,
    default: field.constraints?.default !== undefined
      ? __schemaSQLDefault(field.constraints.default) : null,
    was: field.attrs?.was || null,
  };
}

__SchemaDef.prototype._tableSpec = function (options) {
  this._assertModel('_tableSpec');
  const opts = options || {};
  const norm = this._normalize();
  const table = norm.tableName;
  const seq = table + '_seq';

  // Sequence seed: explicit option wins over @idStart directive wins over 1.
  // DuckDB 1.5.x does not implement ALTER SEQUENCE ... RESTART WITH N, so the
  // baseline has to be set at creation — hence the knob lives here, not in a
  // post-create migration.
  let idStart = 1;
  for (const d of norm.directives) {
    if (d.name === 'idStart' && d.args?.[0] && Number.isInteger(d.args[0].value)) {
      idStart = d.args[0].value;
    }
  }
  if (opts.idStart !== undefined) {
    if (!Number.isInteger(opts.idStart)) {
      throw new Error('schema.toSQL(): idStart must be an integer; got ' + String(opts.idStart));
    }
    idStart = opts.idStart;
  }

  const columns = [];
  columns.push({
    name: norm.primaryKey, type: 'INTEGER',
    notNull: true, unique: false, primary: true,
    default: "nextval('" + seq + "')", was: null,
  });
  for (const [n, f] of norm.fields) {
    columns.push(__schemaColumnSpec(n, f));
  }

  const foreignKeys = [];
  const notes = [];
  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    columns.push({
      name: rel.foreignKey, type: 'INTEGER',
      notNull: !rel.optional, unique: false, default: null, was: null,
    });
    // A relation whose target lives on a DIFFERENT adapter cannot carry
    // a database FK constraint — the referenced table is in another
    // database. The accessor still works (it's just a second query);
    // the DDL suppresses the constraint with a note.
    const targetDef = __SchemaRegistry.get(rel.target);
    const crossAdapter = targetDef &&
      (targetDef._adapter || null) !== (this._adapter || null);
    if (crossAdapter) {
      notes.push('-- NOTE: ' + rel.foreignKey + ' references ' + __schemaTableName(rel.target) +
        '(id) on a different adapter; FK constraint suppressed (cross-database constraints are impossible)');
      continue;
    }
    foreignKeys.push({
      column: rel.foreignKey,
      refTable: __schemaTableName(rel.target),
      refColumn: 'id',
    });
  }

  if (norm.timestamps) {
    columns.push({ name: 'created_at', type: 'TIMESTAMP', notNull: false, unique: false, default: 'CURRENT_TIMESTAMP', was: null });
    columns.push({ name: 'updated_at', type: 'TIMESTAMP', notNull: false, unique: false, default: 'CURRENT_TIMESTAMP', was: null });
  }
  if (norm.softDelete) {
    columns.push({ name: 'deleted_at', type: 'TIMESTAMP', notNull: false, unique: false, default: null, was: null });
  }

  const indexes = [];
  for (const [n, f] of norm.fields) {
    if (!f.unique) continue;
    const col = __schemaSnake(n);
    indexes.push({ name: 'idx_' + table + '_' + col, columns: [col], unique: true });
  }
  for (const d of norm.directives) {
    if (d.name !== 'index' && d.name !== 'unique') continue;
    const ixArgs = d.args?.[0] || {};
    const cols = (ixArgs.fields || []).map(__schemaSnake);
    if (!cols.length) continue;
    indexes.push({ name: 'idx_' + table + '_' + cols.join('_'), columns: cols, unique: d.name === 'unique' });
  }

  return {
    name: table,
    sequence: { name: seq, start: idStart },
    primaryKey: norm.primaryKey,
    columns, indexes, foreignKeys, notes,
    tableWas: norm.tableWas || null,
  };
};

// ---- DDL rendering ------------------------------------------------------------

// Render one column line for CREATE TABLE — also used by the differ's
// ADD COLUMN steps (minus the parts DuckDB can't ALTER in).
function __schemaRenderColumn(spec, col, fkByColumn) {
  const parts = ['  ' + col.name + ' ' + col.type];
  if (col.primary) {
    parts[0] = '  ' + col.name + ' ' + col.type + ' PRIMARY KEY';
  } else {
    if (col.notNull) parts.push('NOT NULL');
    // Uniqueness is emitted as a single named index (`idx_<table>_<col>`),
    // never as an inline column `UNIQUE`. Inline UNIQUE created a second,
    // auto-named index the migrate differ's fold (__schemaFoldSpec) can't
    // normalize; the named index is what ADD COLUMN and introspection
    // already round-trip through. `col.unique` stays the canonical spec
    // flag — it drives the index below and the differ — it just no longer
    // renders here.
  }
  const fk = fkByColumn ? fkByColumn.get(col.name) : null;
  if (fk) parts.push('REFERENCES ' + fk.refTable + '(' + fk.refColumn + ')');
  if (col.default != null) parts.push('DEFAULT ' + col.default);
  return parts.join(' ');
}

function __schemaRenderIndex(spec, ix) {
  const u = ix.unique ? 'UNIQUE ' : '';
  return 'CREATE ' + u + 'INDEX ' + ix.name + ' ON ' + spec.name +
    ' (' + ix.columns.map(c => '"' + c + '"').join(', ') + ');';
}

// Render the CREATE SEQUENCE / CREATE TABLE / CREATE INDEX blocks for a
// table spec. toSQL() joins these; the differ's ADD TABLE step reuses them.
function __schemaRenderCreate(spec) {
  const blocks = [];
  const fkByColumn = new Map(spec.foreignKeys.map(fk => [fk.column, fk]));
  if (spec.sequence) {
    blocks.push('CREATE SEQUENCE ' + spec.sequence.name + ' START ' + spec.sequence.start + ';');
  }
  const lines = spec.columns.map(c => __schemaRenderColumn(spec, c, fkByColumn));
  blocks.push('CREATE TABLE ' + spec.name + ' (\n' + lines.join(',\n') + '\n);');
  const ix = spec.indexes.map(i => __schemaRenderIndex(spec, i));
  if (ix.length) blocks.push(ix.join('\n'));
  if (spec.notes && spec.notes.length) blocks.push(spec.notes.join('\n'));
  return blocks;
}

function __schemaToSQL(def, options) {
  const opts = options || {};
  const { dropFirst = false, header } = opts;
  const spec = def._tableSpec(opts);
  const blocks = [];
  if (header) blocks.push(header);
  if (dropFirst) {
    blocks.push('DROP TABLE IF EXISTS ' + spec.name + ' CASCADE;\nDROP SEQUENCE IF EXISTS ' + spec.sequence.name + ';');
  }
  blocks.push(...__schemaRenderCreate(spec));
  return blocks.join('\n\n') + '\n';
}

function __schemaSQLDefault(v) {
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return "'" + v.replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

// DDL prototype augmentation — added to __SchemaDef

__SchemaDef.prototype.toSQL = function (options) {
  this._assertModel('toSQL');
  return __schemaToSQL(this, options);
};
