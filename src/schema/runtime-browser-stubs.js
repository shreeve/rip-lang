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
// Browser stubs — replace ORM and DDL methods with throwing stubs.
// Loaded ONLY in browser mode. Each stub throws sync (even for methods
// that are async in the real runtime); test suite pins this behavior.

const __schemaBrowserStub = (api) => function() {
  throw new Error(
    "schema." + api + "() is not available in the browser. " +
    "Import @rip-lang/db on the server."
  );
};

__SchemaDef.prototype.find    = __schemaBrowserStub('find');
__SchemaDef.prototype.where   = __schemaBrowserStub('where');
__SchemaDef.prototype.all     = __schemaBrowserStub('all');
__SchemaDef.prototype.first   = __schemaBrowserStub('first');
__SchemaDef.prototype.count   = __schemaBrowserStub('count');
__SchemaDef.prototype.create  = __schemaBrowserStub('create');
__SchemaDef.prototype.toSQL   = __schemaBrowserStub('toSQL');
