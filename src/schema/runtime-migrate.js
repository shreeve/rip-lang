// Schema runtime fragment: migrate (migration only)
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
// ---- Schema evolution: introspect → diff → status / make / migrate ----------
//
// `toSQL()` solves greenfield CREATE; this fragment solves evolution:
// diff the declared models against the deployed database and emit ALTER
// migrations, with history, checksums, and destructive-change gates.
//
//   schema.plan()                 → classified diff steps (pure, no files)
//   schema.status(opts)           → { steps, applied, pending, mismatched }
//   schema.make(name, opts)       → write migrations/NNNN_name.sql from the diff
//   schema.migrate(opts)          → apply pending migration files in order
//   schema.introspect()           → DeployedSchema (canonical table specs)
//
// Migration FILES are plain SQL — numbered, hand-editable, checked into
// git. The generator writes them; humans may amend them; migrate()
// applies them and records (version, name, checksum, applied_at) in the
// `_rip_migrations` table. A checksum mismatch on an applied file aborts
// (someone edited history) unless {repair: true} re-records checksums.

const __SCHEMA_MIGRATIONS_TABLE = '_rip_migrations';

// ---- Row materializer ---------------------------------------------------------

function __schemaMigrateRows(res) {
  const cols = (res.columns || []).map(c => c.name);
  return (res.data || []).map(row => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
    return obj;
  });
}

// ---- Introspection ------------------------------------------------------------

// Build the DeployedSchema — an array of canonical table specs in the
// same shape `_tableSpec()` produces — from the live database. Uses the
// adapter's `introspect()` capability when present (Contract v2);
// otherwise falls back to DuckDB catalog queries through `query()`.
async function __schemaIntrospect() {
  if (typeof __schemaAdapter.introspect === 'function') {
    return await __schemaAdapter.introspect();
  }
  const q = (sql) => __schemaRunSQL(null, sql, []);
  const [tablesRes, columnsRes, constraintsRes, indexesRes, sequencesRes] = [
    await q("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'"),
    await q("SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'main' ORDER BY table_name, ordinal_position"),
    await q("SELECT table_name, constraint_type, constraint_column_names, constraint_text FROM duckdb_constraints() WHERE schema_name = 'main'"),
    await q("SELECT table_name, index_name, is_unique, expressions FROM duckdb_indexes() WHERE schema_name = 'main'"),
    await q("SELECT sequence_name, start_value FROM duckdb_sequences() WHERE schema_name = 'main'"),
  ];

  const tables = new Map();
  for (const r of __schemaMigrateRows(tablesRes)) {
    if (r.table_name === __SCHEMA_MIGRATIONS_TABLE) continue;
    tables.set(r.table_name, {
      name: r.table_name,
      sequence: null,
      primaryKey: null,
      columns: [],
      indexes: [],
      foreignKeys: [],
      tableWas: null,
    });
  }

  for (const r of __schemaMigrateRows(columnsRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    t.columns.push({
      name: r.column_name,
      type: r.data_type,
      notNull: r.is_nullable === 'NO',
      unique: false,
      default: r.column_default != null && r.column_default !== '' ? r.column_default : null,
      was: null,
    });
  }

  // constraint_column_names arrives as a JSON array over harbor, or as a
  // "[a, b]" string from other transports. Normalize to string[].
  const listOf = (v) => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') {
      const inner = v.replace(/^\[/, '').replace(/\]$/, '').trim();
      return inner ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : [];
    }
    return [];
  };

  for (const r of __schemaMigrateRows(constraintsRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    const cols = listOf(r.constraint_column_names);
    if (r.constraint_type === 'PRIMARY KEY' && cols.length === 1) {
      t.primaryKey = cols[0];
      const col = t.columns.find(c => c.name === cols[0]);
      if (col) col.primary = true;
    } else if (r.constraint_type === 'UNIQUE' && cols.length === 1) {
      const col = t.columns.find(c => c.name === cols[0]);
      if (col) col.unique = true;
    } else if (r.constraint_type === 'FOREIGN KEY') {
      const m = String(r.constraint_text || '').match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\S+?)\s*\(([^)]+)\)/i);
      if (m) {
        t.foreignKeys.push({ column: m[1].trim(), refTable: m[2].trim(), refColumn: m[3].trim() });
      } else if (cols.length === 1) {
        t.foreignKeys.push({ column: cols[0], refTable: null, refColumn: null });
      }
    }
  }

  for (const r of __schemaMigrateRows(indexesRes)) {
    const t = tables.get(r.table_name);
    if (!t) continue;
    t.indexes.push({
      name: r.index_name,
      columns: listOf(r.expressions),
      unique: r.is_unique === true || r.is_unique === 'true',
    });
  }

  for (const r of __schemaMigrateRows(sequencesRes)) {
    // Attach by the `<table>_seq` naming convention the DDL emitter uses.
    const tableName = String(r.sequence_name).replace(/_seq$/, '');
    const t = tables.get(tableName);
    if (t && String(r.sequence_name).endsWith('_seq')) {
      t.sequence = { name: r.sequence_name, start: Number(r.start_value) };
    }
  }

  return { tables: [...tables.values()] };
}

// Canonical declared schema: one table spec per registered :model.
function __schemaCanonicalDeclared() {
  const tables = [];
  for (const [, entry] of __SchemaRegistry._entries) {
    if (entry.kind !== 'model') continue;
    tables.push(entry.def._tableSpec());
  }
  return { tables };
}

// ---- Comparison normalizers ----------------------------------------------------

// DuckDB does not persist VARCHAR length hints, and reports several type
// aliases under canonical names. Compare under those equivalences.
const __SCHEMA_TYPE_ALIASES = {
  'TEXT': 'VARCHAR', 'CHARACTER VARYING': 'VARCHAR', 'CHAR': 'VARCHAR', 'BPCHAR': 'VARCHAR', 'STRING': 'VARCHAR',
  'INT': 'INTEGER', 'INT4': 'INTEGER', 'SIGNED': 'INTEGER',
  'INT8': 'BIGINT', 'LONG': 'BIGINT',
  'FLOAT8': 'DOUBLE', 'DOUBLE PRECISION': 'DOUBLE',
  'BOOL': 'BOOLEAN', 'LOGICAL': 'BOOLEAN',
  'DATETIME': 'TIMESTAMP', 'TIMESTAMP WITHOUT TIME ZONE': 'TIMESTAMP',
};

function __schemaTypeKey(t) {
  let k = String(t || '').toUpperCase().replace(/\(.*\)\s*$/, '').trim();
  return __SCHEMA_TYPE_ALIASES[k] || k;
}

// Tolerant default comparison: deployed defaults round-trip through the
// catalog with cosmetic differences (CAST wrappers, now() for
// CURRENT_TIMESTAMP, case). Don't emit ALTERs for representation noise.
function __schemaDefaultKey(d) {
  if (d == null) return '';
  let s = String(d).trim();
  const cast = s.match(/^CAST\s*\(\s*(.*?)\s+AS\s+[A-Za-z0-9_ ()]+\)$/i);
  if (cast) s = cast[1].trim();
  s = s.toLowerCase();
  if (s === 'now()' || s === 'current_timestamp()' || s === 'get_current_timestamp()') s = 'current_timestamp';
  return s;
}

// Fold the `#`-modifier pattern: a UNIQUE column plus its auto-named
// single-column unique index (`idx_<table>_<col>`) count as ONE fact —
// the column's unique flag. Applies to both sides so the differ never
// sees the pair as two separate diffs.
function __schemaFoldSpec(spec) {
  const columnsByName = new Map(spec.columns.map(c => [c.name, c]));
  const indexes = [];
  for (const ix of spec.indexes) {
    const autoName = ix.columns.length === 1 && ix.name === 'idx_' + spec.name + '_' + ix.columns[0];
    if (ix.unique && autoName) {
      const col = columnsByName.get(ix.columns[0]);
      if (col) { col.unique = true; continue; }
    }
    indexes.push(ix);
  }
  return { ...spec, indexes };
}

// ---- The differ -----------------------------------------------------------------
//
// Returns classified steps:
//
//   { table, kind, class: 'safe' | 'lossy' | 'destructive' | 'blocked',
//     sql: [statements/comments], notes: [strings] }
//
// Classes gate generation (`make` refuses lossy/destructive without the
// matching allow flag, and refuses `blocked` outright); the printed plan
// always shows everything.
//
// DuckDB ALTER constraints shape several decisions:
//   - ADD COLUMN cannot carry NOT NULL / UNIQUE / REFERENCES → required
//     adds become add + (backfill) + SET NOT NULL; unique adds get a
//     separate CREATE UNIQUE INDEX; FK constraints cannot be added to an
//     existing table at all (note emitted).
//   - A table referenced by another table's FOREIGN KEY is frozen for
//     everything except ADD COLUMN and index DDL ("Dependency Error:
//     cannot alter entry") — even DROP TABLE … CASCADE is refused.
//     Steps that hit this wall classify as `blocked`: the change
//     requires dropping/rebuilding the referencing tables around it.
//   - No SAVEPOINT / ALTER SEQUENCE RESTART → sequence-start drift is a
//     note, not a step.

// Step kinds DuckDB executes even when the table is FK-referenced.
const __SCHEMA_UNBLOCKED_KINDS = new Set([
  'create-table', 'add-column', 'create-index', 'drop-index', 'note-fk',
]);

// Mark steps that DuckDB will refuse because the target table is
// referenced by other tables' FOREIGN KEYs.
function __schemaApplyFkBlocks(steps, deployed) {
  const referencedBy = new Map(); // table → [child.fkColumn, ...]
  for (const t of deployed.tables) {
    for (const fk of t.foreignKeys) {
      if (!fk.refTable) continue;
      if (!referencedBy.has(fk.refTable)) referencedBy.set(fk.refTable, []);
      referencedBy.get(fk.refTable).push(t.name + '.' + fk.column);
    }
  }
  for (const s of steps) {
    if (__SCHEMA_UNBLOCKED_KINDS.has(s.kind)) continue;
    const refs = referencedBy.get(s.table) ||
      (s.kind === 'rename-table' && s.sql[0] ? referencedBy.get((s.sql[0].match(/^ALTER TABLE (\S+) RENAME TO/) || [])[1]) : null);
    if (!refs || !refs.length) continue;
    s.class = 'blocked';
    s.notes.push(
      'DuckDB refuses this ALTER while ' + refs.join(', ') + ' reference(s) this table ' +
      '("Dependency Error"). Rebuild the referencing table(s) around this change, or ' +
      'apply it manually with the referencing tables dropped and recreated.');
  }
  return steps;
}

function __schemaDiff(declared, deployed) {
  const steps = [];
  const dTables = new Map(declared.tables.map(t => [t.name, __schemaFoldSpec(t)]));
  const pTables = new Map(deployed.tables.map(t => [t.name, __schemaFoldSpec(t)]));

  // Table renames first: declared table missing from deployed, with a
  // @tableWas pointing at a deployed table that no declared model claims.
  for (const [name, d] of dTables) {
    if (pTables.has(name) || !d.tableWas) continue;
    const old = pTables.get(d.tableWas);
    if (old && !dTables.has(d.tableWas)) {
      steps.push({
        table: name, kind: 'rename-table', class: 'safe',
        sql: ['ALTER TABLE ' + d.tableWas + ' RENAME TO ' + name + ';'],
        notes: ["@tableWas " + d.tableWas + " can be removed once this migration lands"],
      });
      pTables.delete(d.tableWas);
      pTables.set(name, { ...old, name });
    }
  }

  // Matched tables next: column / index / FK diffs. Alters run BEFORE
  // create-table steps on purpose — a new child table's FOREIGN KEY
  // freezes its parent the moment it exists, so a migration that both
  // alters `orders` and creates `invoices REFERENCES orders` must alter
  // first.
  for (const [name, d] of dTables) {
    const p = pTables.get(name);
    if (!p) continue;
    __schemaDiffTable(d, p, steps);
  }

  // New tables.
  for (const [name, d] of dTables) {
    if (pTables.has(name)) continue;
    steps.push({
      table: name, kind: 'create-table', class: 'safe',
      sql: __schemaRenderCreate(d),
      notes: [],
    });
  }

  // Dropped tables (deployed but not declared) — the "someone ran manual
  // SQL" detector doubles as the model-deletion path. Destructive.
  for (const [name, p] of pTables) {
    if (dTables.has(name)) continue;
    const sql = ['DROP TABLE ' + name + ';'];
    if (p.sequence) sql.push('DROP SEQUENCE ' + p.sequence.name + ';');
    steps.push({ table: name, kind: 'drop-table', class: 'destructive', sql, notes: [] });
  }

  return __schemaApplyFkBlocks(steps, deployed);
}

function __schemaDiffTable(d, p, steps) {
  const t = d.name;
  const dCols = new Map(d.columns.map(c => [c.name, c]));
  const pCols = new Map(p.columns.map(c => [c.name, c]));

  // Column renames: declared column missing from deployed whose `was`
  // names a deployed column that no declared column claims.
  for (const [name, col] of dCols) {
    if (pCols.has(name) || !col.was) continue;
    const old = pCols.get(col.was);
    if (old && !dCols.has(col.was)) {
      steps.push({
        table: t, kind: 'rename-column', class: 'safe',
        sql: ['ALTER TABLE ' + t + ' RENAME COLUMN ' + col.was + ' TO ' + name + ';'],
        notes: ['{was: "' + col.was + '"} on ' + name + ' can be removed once this migration lands'],
      });
      pCols.delete(col.was);
      pCols.set(name, { ...old, name });
    }
  }

  // Added columns.
  for (const [name, col] of dCols) {
    if (pCols.has(name)) continue;
    const sql = [];
    const notes = [];
    let cls = 'safe';
    // DuckDB: ADD COLUMN cannot carry constraints. DEFAULT is allowed
    // (and backfills existing rows), so add with the default when one
    // is declared, then tighten with SET NOT NULL.
    let add = 'ALTER TABLE ' + t + ' ADD COLUMN ' + name + ' ' + col.type;
    if (col.default != null) add += ' DEFAULT ' + col.default;
    sql.push(add + ';');
    if (col.notNull) {
      if (col.default == null) {
        sql.push("-- TODO: backfill " + t + "." + name + " before SET NOT NULL (required column, no default)");
      }
      sql.push('ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET NOT NULL;');
    }
    if (col.unique) {
      sql.push('CREATE UNIQUE INDEX idx_' + t + '_' + name + ' ON ' + t + ' ("' + name + '");');
    }
    const fk = d.foreignKeys.find(f => f.column === name);
    if (fk) {
      notes.push('DuckDB cannot add FOREIGN KEY constraints to an existing table; ' +
        name + ' -> ' + fk.refTable + '(' + fk.refColumn + ') is unenforced until the table is recreated');
    }
    steps.push({ table: t, kind: 'add-column', class: cls, sql, notes });
  }

  // Dropped columns.
  for (const [name] of pCols) {
    if (dCols.has(name)) continue;
    steps.push({
      table: t, kind: 'drop-column', class: 'destructive',
      sql: ['ALTER TABLE ' + t + ' DROP COLUMN ' + name + ';'],
      notes: [],
    });
  }

  // Altered columns.
  for (const [name, dc] of dCols) {
    const pc = pCols.get(name);
    if (!pc) continue;
    if (dc.primary || pc.primary) continue; // pk shape is fixed (INTEGER + nextval)
    if (__schemaTypeKey(dc.type) !== __schemaTypeKey(pc.type)) {
      steps.push({
        table: t, kind: 'alter-type', class: 'lossy',
        sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' TYPE ' + dc.type + ';'],
        notes: [pc.type + ' -> ' + dc.type + ' casts existing values; rows that cannot cast will fail the migration'],
      });
    }
    if (dc.notNull !== pc.notNull) {
      if (dc.notNull) {
        steps.push({
          table: t, kind: 'set-not-null', class: 'lossy',
          sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET NOT NULL;'],
          notes: ['fails if existing rows hold NULLs — backfill first'],
        });
      } else {
        steps.push({
          table: t, kind: 'drop-not-null', class: 'safe',
          sql: ['ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' DROP NOT NULL;'],
          notes: [],
        });
      }
    }
    if (__schemaDefaultKey(dc.default) !== __schemaDefaultKey(pc.default)) {
      steps.push({
        table: t, kind: 'alter-default', class: 'safe',
        sql: [dc.default != null
          ? 'ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' SET DEFAULT ' + dc.default + ';'
          : 'ALTER TABLE ' + t + ' ALTER COLUMN ' + name + ' DROP DEFAULT;'],
        notes: [],
      });
    }
    if (dc.unique !== pc.unique) {
      if (dc.unique) {
        steps.push({
          table: t, kind: 'add-unique', class: 'lossy',
          sql: ['CREATE UNIQUE INDEX idx_' + t + '_' + name + ' ON ' + t + ' ("' + name + '");'],
          notes: ['fails if existing rows hold duplicates'],
        });
      } else {
        steps.push({
          table: t, kind: 'drop-unique', class: 'safe',
          sql: ['DROP INDEX IF EXISTS idx_' + t + '_' + name + ';'],
          notes: ['a UNIQUE declared inline in CREATE TABLE cannot be dropped by index name; recreate the table if this fails'],
        });
      }
    }
  }

  // Index diffs (auto-unique indexes already folded into column flags).
  const dIdx = new Map(d.indexes.map(i => [i.name, i]));
  const pIdx = new Map(p.indexes.map(i => [i.name, i]));
  for (const [name, ix] of dIdx) {
    const ex = pIdx.get(name);
    if (ex && ex.unique === ix.unique &&
        ex.columns.join(',') === ix.columns.join(',')) continue;
    const sql = [];
    if (ex) sql.push('DROP INDEX ' + name + ';');
    sql.push(__schemaRenderIndex(d, ix));
    steps.push({
      table: t, kind: 'create-index', class: ix.unique ? 'lossy' : 'safe',
      sql,
      notes: ix.unique ? ['unique index creation fails if existing rows hold duplicates'] : [],
    });
  }
  for (const [name] of pIdx) {
    if (dIdx.has(name)) continue;
    steps.push({
      table: t, kind: 'drop-index', class: 'safe',
      sql: ['DROP INDEX ' + name + ';'],
      notes: [],
    });
  }

  // FK diffs are notes only — DuckDB has no ALTER TABLE ADD/DROP CONSTRAINT.
  const pFks = new Set(p.foreignKeys.map(f => f.column));
  for (const fk of d.foreignKeys) {
    if (pFks.has(fk.column) || !pCols.has(fk.column)) continue;
    steps.push({
      table: t, kind: 'note-fk', class: 'safe',
      sql: ['-- NOTE: ' + t + '.' + fk.column + ' should reference ' + fk.refTable + '(' + fk.refColumn + ') ' +
           'but DuckDB cannot add FK constraints to an existing table'],
      notes: [],
    });
  }
}

// ---- Plan rendering --------------------------------------------------------------

function __schemaRenderPlan(steps) {
  const lines = [];
  for (const s of steps) {
    lines.push('-- [' + s.class + '] ' + s.kind + ' ' + s.table);
    for (const n of s.notes) lines.push('--   ' + n);
    lines.push(...s.sql);
    lines.push('');
  }
  return lines.join('\n');
}

// ---- Migration files & history ------------------------------------------------------

const __SCHEMA_MIGRATION_FILE_RE = /^(\d{4,})_(.+)\.sql$/;

async function __schemaMigrationFiles(dir) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    const m = f.match(__SCHEMA_MIGRATION_FILE_RE);
    if (!m) continue;
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    out.push({
      version: m[1],
      name: m[2],
      file: path.join(dir, f),
      checksum: crypto.createHash('sha256').update(content).digest('hex'),
      content,
    });
  }
  return out;
}

async function __schemaAppliedMigrations() {
  try {
    const res = await __schemaRunSQL(null,
      'SELECT version, name, checksum, applied_at FROM ' + __SCHEMA_MIGRATIONS_TABLE + ' ORDER BY version', []);
    return __schemaMigrateRows(res);
  } catch (e) {
    // History table doesn't exist yet — nothing applied. Anything else
    // (connection refused, auth) should propagate.
    if (/does not exist|Catalog Error/i.test(e?.message || '')) return [];
    throw e;
  }
}

async function __schemaEnsureMigrationsTable() {
  await __schemaRunSQL(null,
    'CREATE TABLE IF NOT EXISTS ' + __SCHEMA_MIGRATIONS_TABLE +
    ' (version VARCHAR PRIMARY KEY, name VARCHAR, checksum VARCHAR, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)', []);
}

// Split a migration file into statements: ';' terminates, except inside
// single-quoted strings; `--` line comments pass through attached to the
// following statement (so a leading TODO comment is visible in errors but
// never executed alone). Pure-comment / empty fragments are dropped.
function __schemaSplitStatements(sql) {
  const out = [];
  let cur = '';
  let inString = false;
  let inComment = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inComment) {
      cur += ch;
      if (ch === '\n') inComment = false;
      continue;
    }
    if (inString) {
      cur += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") { cur += "'"; i++; }
        else inString = false;
      }
      continue;
    }
    if (ch === "'") { inString = true; cur += ch; continue; }
    if (ch === '-' && sql[i + 1] === '-') { inComment = true; cur += ch; continue; }
    if (ch === ';') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  // Strip comment-only / empty fragments; keep executable text intact.
  return out
    .map(s => s.trim())
    .filter(s => s && s.split('\n').some(line => {
      const l = line.trim();
      return l && !l.startsWith('--');
    }));
}

// ---- Public functions ----------------------------------------------------------------

async function __schemaPlan() {
  const declared = __schemaCanonicalDeclared();
  if (!declared.tables.length) {
    throw new Error('schema.plan(): no :model schemas are registered — import your model files first');
  }
  const deployed = await __schemaIntrospect();
  return __schemaDiff(declared, deployed);
}

async function __schemaStatus(opts = {}) {
  const dir = opts.dir || 'migrations';
  const steps = await __schemaPlan();
  const files = await __schemaMigrationFiles(dir);
  const applied = await __schemaAppliedMigrations();
  const appliedByVersion = new Map(applied.map(a => [a.version, a]));
  const pending = files.filter(f => !appliedByVersion.has(f.version));
  const mismatched = files.filter(f => {
    const a = appliedByVersion.get(f.version);
    return a && a.checksum !== f.checksum;
  }).map(f => f.version + '_' + f.name);
  return { steps, files, applied, pending, mismatched };
}

async function __schemaMake(name, opts = {}) {
  if (!name || typeof name !== 'string') {
    throw new Error("schema.make(name): a migration name is required, e.g. schema.make('add_orders')");
  }
  const dir = opts.dir || 'migrations';
  const steps = await __schemaPlan();
  if (!steps.length) return null;

  const blocked = steps.filter(s => s.class === 'blocked');
  if (blocked.length) {
    const list = blocked.map(s => '  [blocked] ' + s.kind + ' ' + s.table + '\n    ' + s.notes.join('\n    ')).join('\n');
    throw new Error(
      'schema.make: the plan contains steps DuckDB cannot execute while foreign keys reference the table:\n' +
      list + '\nThese need a manual rebuild of the referencing tables; no flag overrides this.');
  }
  const gated = [];
  for (const s of steps) {
    if (s.class === 'lossy' && !opts.allowLossy) gated.push(s);
    if (s.class === 'destructive' && !opts.allowDestructive) gated.push(s);
  }
  if (gated.length) {
    const list = gated.map(s => '  [' + s.class + '] ' + s.kind + ' ' + s.table).join('\n');
    throw new Error(
      'schema.make: the plan contains gated steps:\n' + list +
      '\nPass {allowLossy: true} / {allowDestructive: true} (CLI: --allow-lossy / --allow-destructive) to include them.');
  }

  const fs = await import('node:fs');
  const path = await import('node:path');
  const files = await __schemaMigrationFiles(dir);
  const next = files.length ? Math.max(...files.map(f => parseInt(f.version, 10))) + 1 : 1;
  const version = String(next).padStart(4, '0');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'migration';
  const file = path.join(dir, version + '_' + slug + '.sql');

  const body =
    '-- ' + version + '_' + slug + '.sql\n' +
    '-- Generated by `rip schema make` — review (and edit) before applying.\n' +
    '-- Apply with `rip schema migrate`.\n\n' +
    __schemaRenderPlan(steps);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, body);
  return { file, version, steps };
}

async function __schemaMigrate(opts = {}) {
  const dir = opts.dir || 'migrations';
  const files = await __schemaMigrationFiles(dir);
  await __schemaEnsureMigrationsTable();
  const applied = await __schemaAppliedMigrations();
  const appliedByVersion = new Map(applied.map(a => [a.version, a]));

  // History integrity: an applied file whose content changed is an
  // edited-history error — abort unless {repair: true} re-records.
  for (const f of files) {
    const a = appliedByVersion.get(f.version);
    if (!a || a.checksum === f.checksum) continue;
    if (opts.repair) {
      await __schemaRunSQL(null,
        'UPDATE ' + __SCHEMA_MIGRATIONS_TABLE + ' SET checksum = ? WHERE version = ?',
        [f.checksum, f.version]);
    } else {
      throw new Error(
        'schema.migrate: checksum mismatch on applied migration ' + f.version + '_' + f.name +
        ' — the file changed after it was applied. Restore the original file, or re-record with {repair: true} (CLI: --repair).');
    }
  }

  const pending = files.filter(f => !appliedByVersion.has(f.version));
  const ran = [];
  for (const f of pending) {
    const statements = __schemaSplitStatements(f.content);
    const apply = async () => {
      for (const stmt of statements) {
        await __schemaRunSQL(null, stmt, []);
      }
      await __schemaRunSQL(null,
        'INSERT INTO ' + __SCHEMA_MIGRATIONS_TABLE + ' (version, name, checksum) VALUES (?, ?, ?)',
        [f.version, f.name, f.checksum]);
    };
    // Transactional apply when the adapter supports it — a failed
    // statement leaves neither earlier statements nor the history row.
    if (typeof __schemaAdapter.begin === 'function') {
      await __schemaTransaction(apply);
    } else {
      await apply();
    }
    ran.push(f.version + '_' + f.name);
  }
  return { ran, pending: [] };
}
