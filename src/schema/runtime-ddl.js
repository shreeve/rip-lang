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

function __schemaToSQL(def, options) {
  const opts = options || {};
  const { dropFirst = false, header } = opts;
  const norm = def._normalize();
  const blocks = [];
  if (header) blocks.push(header);

  const table = norm.tableName;
  const seq = table + '_seq';
  if (dropFirst) {
    blocks.push('DROP TABLE IF EXISTS ' + table + ' CASCADE;\nDROP SEQUENCE IF EXISTS ' + seq + ';');
  }

  // Sequence seed: explicit option wins over @idStart directive wins over 1.
  // DuckDB 1.5.2 does not implement ALTER SEQUENCE ... RESTART WITH N, so the
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
  const indexes = [];
  columns.push('  ' + norm.primaryKey + " INTEGER PRIMARY KEY DEFAULT nextval('" + seq + "')");

  for (const [n, f] of norm.fields) {
    columns.push(__schemaColumnDDL(n, f));
    if (f.unique) {
      indexes.push('CREATE UNIQUE INDEX idx_' + table + '_' + __schemaSnake(n) + ' ON ' + table + ' ("' + __schemaSnake(n) + '");');
    }
  }

  for (const [, rel] of norm.relations) {
    if (rel.kind !== 'belongsTo') continue;
    const refTable = __schemaTableName(rel.target);
    const notNull = rel.optional ? '' : ' NOT NULL';
    columns.push('  ' + rel.foreignKey + ' INTEGER' + notNull + ' REFERENCES ' + refTable + '(id)');
  }

  if (norm.timestamps) {
    columns.push('  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    columns.push('  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  }
  if (norm.softDelete) {
    columns.push('  deleted_at TIMESTAMP');
  }

  // @index directives
  for (const d of norm.directives) {
    if (d.name !== 'index') continue;
    const ixArgs = d.args?.[0] || {};
    const fields = (ixArgs.fields || []).map(__schemaSnake);
    if (!fields.length) continue;
    const u = ixArgs.unique ? 'UNIQUE ' : '';
    indexes.push('CREATE ' + u + 'INDEX idx_' + table + '_' + fields.join('_') + ' ON ' + table + ' (' + fields.map(f => '"' + f + '"').join(', ') + ');');
  }

  blocks.push('CREATE SEQUENCE ' + seq + ' START ' + idStart + ';');
  blocks.push('CREATE TABLE ' + table + ' (\n' + columns.join(',\n') + '\n);');
  if (indexes.length) blocks.push(indexes.join('\n'));

  return blocks.join('\n\n') + '\n';
}

function __schemaColumnDDL(name, field) {
  let base = __SCHEMA_SQL_TYPES[field.typeName] || 'VARCHAR';
  if (field.array) base = 'JSON';
  if (base === 'VARCHAR' && field.constraints?.max != null) {
    base = 'VARCHAR(' + field.constraints.max + ')';
  }
  const parts = ['  ' + __schemaSnake(name) + ' ' + base];
  if (field.required) parts.push('NOT NULL');
  if (field.unique) parts.push('UNIQUE');
  if (field.constraints?.default !== undefined) {
    parts.push('DEFAULT ' + __schemaSQLDefault(field.constraints.default));
  }
  return parts.join(' ');
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
