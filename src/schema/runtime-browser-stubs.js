// Schema runtime fragment: browser-stubs (browser only)
//
// This file is the source of truth for one slice of the schema runtime.
// Edit here, then run `bun scripts/build-schema-runtime.js` to regenerate
// `src/schema/runtime.generated.js`. Tests pin the public surface via
// test/schema-errors.test.js, test/schema-modes.test.js, and the source
// schema test suite.
//
// Fragments are concatenated INSIDE one shared IIFE wrapper at build time.
// They share scope; references like `__SchemaRegistry` resolve to bindings
// defined in earlier-included fragments. Editor tooling (LSP / lint) may
// not recognize cross-fragment references — that is expected; behavior is
// pinned by the test suite.

/* eslint-disable no-undef, no-unused-vars */
// Browser stubs — throwing replacements for every ORM / DDL helper that
// the validate fragment references but doesn't implement. Loaded ONLY
// in browser mode.
//
// The validate fragment's `_makeClass`, `_normalize`, and
// `__schemaNormalizeDirectiveRelation` reference helpers that live in
// db-naming, orm, and ddl fragments at runtime. Browser mode doesn't
// include those fragments, so we provide thin throwing stubs here so
// browser-side schema declarations parse and validate cleanly while
// any attempt to use server-only behavior fails with a helpful message.

const __schemaBrowserStub = (api) => function() {
  throw new Error(
    "schema." + api + "() is not available in the browser. " +
    "Import @rip-lang/db on the server."
  );
};

// Static / class-level methods on __SchemaDef
__SchemaDef.prototype.find    = __schemaBrowserStub('find');
__SchemaDef.prototype.where   = __schemaBrowserStub('where');
__SchemaDef.prototype.all     = __schemaBrowserStub('all');
__SchemaDef.prototype.first   = __schemaBrowserStub('first');
__SchemaDef.prototype.count   = __schemaBrowserStub('count');
__SchemaDef.prototype.create  = __schemaBrowserStub('create');
__SchemaDef.prototype.toSQL   = __schemaBrowserStub('toSQL');

// Helpers referenced by the validate fragment that are otherwise
// defined in db-naming / orm fragments. Kept inert (return safe
// defaults or throw on use) so validate's _makeClass / _normalize
// can run end-to-end in browser context.
function __schemaSave()       { throw new Error("schema instance.save() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaDestroy()    { throw new Error("schema instance.destroy() is not available in the browser. Import @rip-lang/db on the server."); }
function __schemaTableName(m) { return null; } // returned only for :model normalize; never used downstream in browser
function __schemaPluralize(w) { return w; }    // identity — relations work for type-resolution but never query
function __schemaFkName(m)    { return ''; }   // ditto
