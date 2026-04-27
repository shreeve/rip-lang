// Schema runtime fragment: db-naming (server + migration)
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
const __SCHEMA_UNCOUNTABLE = new Set(['equipment','information','rice','money','species','series','fish','sheep','data']);

const __SCHEMA_IRREGULAR = new Map([['person','people'],['man','men'],['woman','women'],['child','children'],['tooth','teeth'],['foot','feet'],['mouse','mice']]);

function __schemaPluralize(w) {
  const lw = w.toLowerCase();
  if (__SCHEMA_UNCOUNTABLE.has(lw)) return w;
  if (__SCHEMA_IRREGULAR.has(lw)) return __SCHEMA_IRREGULAR.get(lw);
  // Preserve case of the input — pluralizer operates on the trailing form
  // but keeps the rest unchanged, so orderItem becomes orderItems
  // and User becomes Users.
  if (/[^aeiouy]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + 'es';
  return w + 's';
}

function __schemaTableName(model) { return __schemaPluralize(__schemaSnake(model)); }

function __schemaFkName(model) { return __schemaSnake(model) + '_id'; }
