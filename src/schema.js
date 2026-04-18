import { parser } from './parser.js';

// Schema System — inline `schema` declarations compile to runtime validator
// and ORM plans.
//
// Architecture (parallels types.js and components.js sidecars):
//
//   installSchemaSupport(Lexer, CodeEmitter)
//     Adds rewriteSchema() to Lexer.prototype and emitSchema() to
//     CodeEmitter.prototype.
//
//   rewriteSchema()
//     Token-stream pass. Recognizes `schema [:kind] INDENT ... OUTDENT`
//     blocks at expression-start positions, parses the body with a
//     schema-specific sub-parser, and collapses the whole region into
//     `SCHEMA SCHEMA_BODY` where SCHEMA_BODY carries a structured
//     descriptor on its .data. The main Rip grammar only sees two
//     tiny productions. Schema body syntax never reaches the main
//     parser.
//
//   emitSchema(head, rest, context)
//     CodeEmitter dispatch. Reads the structured descriptor off the
//     SCHEMA_BODY node's metadata and emits a `__schema({...})` runtime
//     call. For Phase 1 the emission is a self-describing object; the
//     runtime (__schema) lands in Phase 3.
//
//   hasSchemas(source)
//     Cheap regex probe for the presence of a schema declaration.
//     Parallels hasTypeAnnotations. Used by typecheck.js and the LSP to
//     skip work on files without schemas.
//
// Two body sub-modes:
//
//   fielded — kinds :input, :shape, :model, :mixin. Permitted line forms:
//     field      IDENTIFIER[!|?|#]* TYPE [, constraints] [, attrs]
//     directive  @NAME [args]
//     callable   NAME: (-> | ~>) body
//
//   enum — kind :enum. Permitted line forms:
//     bare       IDENTIFIER
//     valued     IDENTIFIER : Literal
//
// Anything else at schema top level is a schema-mode-aware compile error
// with a helpful message.

const VALID_KINDS = new Set(['input', 'shape', 'model', 'mixin', 'enum']);
const KIND_DEFAULT = 'input';

const HOOK_NAMES = new Set([
  'beforeValidation', 'afterValidation',
  'beforeSave', 'afterSave',
  'beforeCreate', 'afterCreate',
  'beforeUpdate', 'afterUpdate',
  'beforeDestroy', 'afterDestroy',
]);

// Positions where `schema` can legitimately start an expression.
// If the prev token is one of these tags, the identifier `schema` is a
// candidate for retagging to SCHEMA.
const EXPR_START_PREV = new Set([
  'TERMINATOR', 'INDENT', 'OUTDENT',
  '=', '+=', '-=', '*=', '/=', '%=', '**=', '//=', '%%=',
  '?=', '??=', '&&=', '||=', '&=', '|=', '^=', '<<=', '>>=', '>>>=',
  'READONLY_ASSIGN', 'REACTIVE_ASSIGN', 'COMPUTED_ASSIGN',
  'RETURN', 'THROW', 'YIELD', 'AWAIT', 'EXPORT',
  ',', '(', '[', '{', 'CALL_START', 'PARAM_START', 'INDEX_START',
  '->', '=>', ':', 'WHEN', 'THEN', 'IF', 'UNLESS',
  'UNARY', '!', 'NOT',
]);

// ============================================================================
// hasSchemas — fast probe
// ============================================================================

// True when source looks like it contains a schema declaration. We look
// for `schema` followed by either a `:kind` symbol or by a newline +
// deeper indent. Conservative: a false positive just means typecheck
// pays a bit more work, never wrong behavior.
export function hasSchemas(source) {
  if (typeof source !== 'string') return false;
  if (!/\bschema\b/.test(source)) return false;
  return /(?:^|[\s=,(\[{:])schema(?:\s*:[A-Za-z_$][\w$]*|\s*\n[ \t]+\S)/m.test(source);
}

// ============================================================================
// installSchemaSupport — prototype installation
// ============================================================================

export function installSchemaSupport(Lexer, CodeEmitter) {
  if (Lexer) {
    Lexer.prototype.rewriteSchema = function() {
      rewriteSchema(this);
    };
    // Captured body tokens need the tail rewriter passes before parsing.
    // parseBodyTokens runs those passes on a fresh Lexer instance.
    parseBodyTokens._LexerCtor = Lexer;
  }
  if (CodeEmitter) {
    CodeEmitter.prototype.emitSchema = function(head, rest, context) {
      return emitSchemaNode(this, head, rest, context);
    };
    CodeEmitter.prototype.getSchemaRuntime = function() {
      return getSchemaRuntime();
    };
  }
}

// ============================================================================
// Lexer pass: rewriteSchema
// ============================================================================

function rewriteSchema(lexer) {
  let tokens = lexer.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (!isSchemaStart(tokens, i)) continue;
    collapseSchemaAt(lexer, tokens, i);
  }
}

function isSchemaStart(tokens, i) {
  let t = tokens[i];
  if (!t || t[0] !== 'IDENTIFIER' || t[1] !== 'schema') return false;
  // Skip property access — `x.schema` is lexed as PROPERTY, not IDENTIFIER.
  // Still guard against generated IDENTIFIER tokens in odd positions.
  let prev = tokens[i - 1];
  if (prev) {
    let ptag = prev[0];
    if (ptag === '.' || ptag === '?.') return false;
    if (prev[0] === 'IDENTIFIER' || prev[0] === 'PROPERTY' ||
        prev[0] === ')' || prev[0] === ']' || prev[0] === '}' ||
        prev[0] === 'STRING' || prev[0] === 'NUMBER') {
      // `x schema` is an implicit call of x on schema — not a decl.
      if (!EXPR_START_PREV.has(ptag)) return false;
    }
  }
  // What follows: optional SYMBOL (kind), optional TERMINATOR, then INDENT.
  let j = i + 1;
  if (tokens[j]?.[0] === 'SYMBOL') j++;
  if (tokens[j]?.[0] === 'TERMINATOR') j++;
  return tokens[j]?.[0] === 'INDENT';
}

// Collapse `IDENTIFIER 'schema' [SYMBOL kind] [TERMINATOR] INDENT ... OUTDENT`
// at position i into `SCHEMA SCHEMA_BODY`. SCHEMA_BODY carries a structured
// descriptor on .data.
function collapseSchemaAt(lexer, tokens, i) {
  let schemaTok = tokens[i];
  let kindToken = null;
  let kind = KIND_DEFAULT;
  let j = i + 1;

  if (tokens[j]?.[0] === 'SYMBOL') {
    kindToken = tokens[j];
    let k = kindToken[1];
    if (!VALID_KINDS.has(k)) {
      throw schemaError(kindToken,
        `Unknown schema kind :${k}. Expected one of :input, :shape, :model, :mixin, :enum.`);
    }
    kind = k;
    j++;
  }
  if (tokens[j]?.[0] === 'TERMINATOR') j++;

  if (tokens[j]?.[0] !== 'INDENT') {
    throw schemaError(schemaTok,
      `Expected indented schema body after 'schema${kindToken ? ' :' + kind : ''}'.`);
  }
  let indentIdx = j;

  let outdentIdx = findMatchingOutdent(tokens, indentIdx);
  if (outdentIdx < 0) {
    throw schemaError(tokens[indentIdx], 'Unterminated schema body.');
  }

  let bodyTokens = tokens.slice(indentIdx + 1, outdentIdx);
  let descriptor = parseSchemaBody(kind, bodyTokens, {
    schemaLoc: schemaTok.loc,
    kindLoc: kindToken?.loc ?? null,
    kind,
  });

  // Replace range `[i, outdentIdx]` with `SCHEMA SCHEMA_BODY`.
  let schemaNewTok = mkToken('SCHEMA', 'schema', schemaTok);
  let bodyNewTok = mkToken('SCHEMA_BODY', kind, schemaTok);
  bodyNewTok.data = { descriptor };
  tokens.splice(i, outdentIdx - i + 1, schemaNewTok, bodyNewTok);
}

// ============================================================================
// Sub-parser — fielded and enum modes
// ============================================================================

function parseSchemaBody(kind, bodyTokens, ctx) {
  let entries = [];
  let lines = splitBodyLines(bodyTokens);

  // Kind inference: a body whose first non-empty line begins with a
  // SYMBOL token is unambiguously an enum. Promote the default :input
  // kind to :enum so `schema\n  :draft\n  :active` needs no marker.
  // Explicit `:input` or any other kind stays as written.
  if (kind === KIND_DEFAULT && !ctx.kindLoc && lines.length > 0 &&
      lines[0][0]?.[0] === 'SYMBOL') {
    kind = 'enum';
    ctx.kind = 'enum';
  }

  if (kind === 'enum') {
    for (let line of lines) {
      parseEnumLine(line, entries);
    }
  } else {
    for (let line of lines) {
      parseFieldedLine(kind, line, entries);
    }
    // Capability-matrix enforcement by kind. `@mixin` is allowed as a
    // field-inclusion directive on every fielded kind because it adds
    // fields (not behavior). Other directives are restricted per the
    // matrix in the language reference.
    if (kind === 'mixin') {
      for (let e of entries) {
        if (e.tag === 'method' || e.tag === 'computed' || e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:mixin schemas are fields-only. '${e.name}' is a ${e.tag}; move it to a :shape or :model.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:mixin schemas only accept '@mixin Name' directives. '@${e.name}' is not allowed.`);
        }
      }
    } else if (kind === 'input') {
      for (let e of entries) {
        if (e.tag === 'method' || e.tag === 'computed' || e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:input schemas are fields-only. '${e.name}' is a ${e.tag}; use :shape or :model if you need behavior.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:input schemas only accept '@mixin Name' directives. '@${e.name}' is not allowed.`);
        }
      }
    } else if (kind === 'shape') {
      // :shape accepts fields, methods, computed, and @mixin. Hooks
      // and ORM-bound directives (timestamps, softDelete, index,
      // belongs_to, has_many, has_one, link) are :model-only.
      for (let e of entries) {
        if (e.tag === 'hook') {
          throw schemaError({ loc: e.headerLoc || e.loc },
            `:shape schemas don't have lifecycle hooks. '${e.name}' runs only on :model; move it or remove it.`);
        }
        if (e.tag === 'directive' && e.name !== 'mixin') {
          throw schemaError({ loc: e.loc },
            `:shape schemas only accept '@mixin Name'. '@${e.name}' is :model-only.`);
        }
      }
    }
  }

  return {
    kind,
    loc: ctx.schemaLoc,
    kindLoc: ctx.kindLoc,
    entries,
  };
}

// Split top-level lines inside a schema body. Nested INDENT/OUTDENT stays
// inside its owning line (belongs to a callable body, multi-line
// constraints, etc.). Each returned line is the raw sub-stream of tokens
// for that line (no outer TERMINATORs).
function splitBodyLines(tokens) {
  let lines = [];
  let cur = [];
  let depth = 0;
  for (let t of tokens) {
    let tag = t[0];
    if (tag === 'INDENT') depth++;
    if (tag === 'OUTDENT') depth--;
    if (tag === 'TERMINATOR' && depth === 0) {
      if (cur.length) { lines.push(cur); cur = []; }
      continue;
    }
    cur.push(t);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

// Fielded body: field, directive, or callable.
function parseFieldedLine(kind, line, entries) {
  let first = line[0];
  if (!first) return;

  // Directive: @NAME [args]
  if (first[0] === '@') {
    let nameTok = line[1];
    if (!nameTok || (nameTok[0] !== 'IDENTIFIER' && nameTok[0] !== 'PROPERTY')) {
      throw schemaError(first, "Expected directive name after '@'.");
    }
    let argTokens = line.slice(2);
    // Pre-parse structured args so shadow-TS and runtime-codegen share
    // the same descriptor shape. Relation and mixin directives get a
    // `[{target, optional?}]` array; other directives leave `args` unset.
    let args = null;
    let dname = nameTok[1];
    if (dname === 'belongs_to' || dname === 'has_many' || dname === 'has_one' ||
        dname === 'one' || dname === 'many' || dname === 'mixin') {
      let t0 = argTokens[0];
      if (t0 && (t0[0] === 'IDENTIFIER' || t0[0] === 'PROPERTY')) {
        let optional = t0.data?.predicate === true;
        if (!optional && argTokens[1]?.[0] === '?') optional = true;
        args = [{ target: t0[1], optional }];
      }
    }
    entries.push({
      tag: 'directive',
      name: dname,
      args,
      argTokens,
      loc: first.loc,
    });
    return;
  }

  // The identifier regex absorbs a trailing `:` by retagging the ident as
  // PROPERTY and emitting a separate `:` token. So a line starting with
  // PROPERTY is always a callable (`name: -> body` or `name: ~> body`);
  // a line starting with IDENTIFIER is always a field.
  if (first[0] === 'PROPERTY') {
    parseCallableLine(kind, first, line, entries);
    return;
  }
  if (first[0] !== 'IDENTIFIER') {
    throw schemaError(first,
      `Unexpected ${first[0]} at schema top level. Allowed: fields ('name! type'), directives ('@name'), methods ('name: -> body'), or computed getters ('name: ~> body').`);
  }

  let name = first[1];

  // Guard: `name:` without the colon absorbed — shouldn't happen but
  // produces a friendly error if it does.
  if (line[1]?.[0] === ':') {
    throw schemaError(line[1],
      `Schema fields use 'name type' (space, no colon). For methods or computed use 'name: -> body' or 'name: ~> body'.`);
  }

  // Field: IDENTIFIER [modifiers] TYPE [, constraints] [, attrs]
  let modifiers = collectModifiers(first);
  let pos = 1;

  // Adjacent `!`, `#`, `?` modifier tokens. `!` and `?` are absorbed into
  // the IDENTIFIER's data by the main lexer. `#` arrives as a standalone
  // token because the schema commentToken exception kicks in when `#` is
  // adjacent to an identifier. A modifier must be unspaced from the
  // token it follows, so we check the preceding token's `.spaced` flag
  // (which the whitespace pass sets to true when whitespace follows).
  while (pos < line.length) {
    let tk = line[pos];
    let adjacent = line[pos - 1] && !line[pos - 1].spaced;
    if (!adjacent) break;
    if (tk[0] === '#' || tk[0] === '?' || tk[0] === '!') {
      modifiers.push(tk[0]);
      pos++;
      continue;
    }
    break;
  }

  // Reject a stray colon here — gives a clear diagnostic for the common
  // mistake `name: type` instead of `name type`.
  let typeFirst = line[pos];
  if (!typeFirst) {
    throw schemaError(first, `Schema field '${name}' is missing a type.`);
  }
  if (typeFirst[0] === ':') {
    throw schemaError(typeFirst,
      `Schema fields use 'name type' (space, no colon). Got 'name:'. For methods/computed use 'name: -> body' or 'name: ~> body'.`);
  }

  // Type: IDENTIFIER, optionally followed by `[]` for array.
  if (typeFirst[0] !== 'IDENTIFIER') {
    throw schemaError(typeFirst,
      `Expected type name for schema field '${name}'. Got ${typeFirst[0]}.`);
  }
  let typeName = typeFirst[1];
  pos++;
  let array = false;
  // `string[]` tokenizes as IDENTIFIER INDEX_START INDEX_END (or `[` `]`
  // depending on context; closeOpenIndexes retags the empty bracket pair
  // as INDEX_START/INDEX_END when it follows an indexable token).
  let openTag = line[pos]?.[0];
  let closeTag = line[pos + 1]?.[0];
  if ((openTag === '[' || openTag === 'INDEX_START') &&
      (closeTag === ']' || closeTag === 'INDEX_END')) {
    array = true;
    pos += 2;
  }

  // Remaining tokens on the line are `[, constraints] [, attrs]`.
  // For Phase 1 we capture raw token slices and defer semantic parsing.
  let rest = line.slice(pos);
  let constraintTokens = null;
  let attrsTokens = null;

  if (rest.length > 0) {
    if (rest[0]?.[0] !== ',') {
      throw schemaError(rest[0],
        `Expected ',' between type and constraints for field '${name}'.`);
    }
    // Split top-level by commas. Multi-line trailers (`name! type,\n
    // [8, 100]`) introduce surrounding INDENT/OUTDENT tokens that
    // don't affect semantics — strip them from each part so the head
    // is the literal `[` or `{`.
    let parts = splitTopLevelByComma(rest.slice(1));
    for (let part of parts) {
      while (part.length && (part[0][0] === 'INDENT' || part[0][0] === 'TERMINATOR')) {
        part = part.slice(1);
      }
      while (part.length && (part[part.length - 1][0] === 'OUTDENT' || part[part.length - 1][0] === 'TERMINATOR')) {
        part = part.slice(0, -1);
      }
      if (!part.length) continue;
      let head = part[0];
      if (head[0] === '[' || head[0] === 'INDEX_START') {
        constraintTokens = part;
      } else if (head[0] === '{') {
        attrsTokens = part;
      } else {
        throw schemaError(head,
          `Unexpected trailer for field '${name}'. Expected '[...]' constraints or '{...}' attrs.`);
      }
    }
  }

  entries.push({
    tag: 'field',
    name,
    modifiers,
    typeName,
    array,
    constraintTokens,
    attrsTokens,
    loc: first.loc,
  });
}

function parseCallableLine(kind, headerTok, line, entries) {
  let name = headerTok[1];
  let colonTok = line[1];
  if (!colonTok || colonTok[0] !== ':') {
    throw schemaError(headerTok,
      `Expected ':' after '${name}' before arrow.`);
  }
  let arrowTok = line[2];
  if (!arrowTok || (arrowTok[0] !== '->' && arrowTok[0] !== 'EFFECT')) {
    throw schemaError(colonTok,
      `Schema top-level '${name}:' must be followed by '->' (method/hook) or '~>' (computed getter).`);
  }
  let arrow = arrowTok[0] === 'EFFECT' ? '~>' : '->';
  let bodyTokens = line.slice(3);
  let isHook = HOOK_NAMES.has(name);
  let entryTag;
  if (arrow === '~>') {
    entryTag = 'computed';
  } else if (kind === 'model' && isHook) {
    entryTag = 'hook';
  } else {
    entryTag = 'method';
  }
  entries.push({
    tag: entryTag,
    name,
    arrow,
    paramTokens: [],
    bodyTokens,
    headerLoc: headerTok.loc,
    arrowLoc: arrowTok.loc,
  });
}

function parseEnumLine(line, entries) {
  let first = line[0];
  if (!first) return;
  // Enum member forms:
  //   :admin          bare symbol    → maps to name string "admin"
  //   :pending 0      valued symbol  → maps "pending" (and 0) to 0
  //
  // Values are any literal (number, string, boolean, null, regex).
  // Mixing bare and valued members in one enum is permitted but
  // unusual: the Map is heterogeneous when you do it — bare entries
  // hold name strings, valued entries hold their literal. Keep the
  // members uniform if that matters for downstream consumers.
  if (first[0] !== 'SYMBOL') {
    throw schemaError(first,
      `Enum member must be a :symbol. Use ':${first[1] ?? 'name'}' for a bare member or ':${first[1] ?? 'name'} value' for a valued one.`);
  }
  let name = first[1];
  let second = line[1];
  if (!second) {
    entries.push({ tag: 'enum-member', name, value: undefined, loc: first.loc });
    return;
  }
  if (second[0] === ':') {
    throw schemaError(second,
      `Enum member ':${name}' — drop the ':' before the value. Use ':${name} value'.`);
  }
  if (line.length > 2) {
    throw schemaError(line[2],
      `Extra tokens after enum member ':${name}' value.`);
  }
  entries.push({
    tag: 'enum-member',
    name,
    value: literalOf(second),
    loc: first.loc,
  });
}

// ============================================================================
// Codegen — emitSchema
// ============================================================================

function emitSchemaNode(emitter, head, rest, context) {
  // rest[0] is the SCHEMA_BODY node. The parser metadata bridge wraps the
  // token value in `new String()` and copies token.data fields onto it, so
  // the descriptor surfaces as `node.descriptor` here.
  let node = rest[0];
  let descriptor = readDescriptor(node);
  if (!descriptor) {
    throw new Error('schema: missing descriptor on SCHEMA_BODY token');
  }
  emitter.usesSchemas = true;

  // The binding name is threaded through `_schemaName` by emitAssignment
  // (parallels `_componentName`). When present, we embed it so SchemaError,
  // generated class name, and debug output all have a stable identity.
  let schemaName = emitter._schemaName || null;

  let parts = [`kind: ${JSON.stringify(descriptor.kind)}`];
  if (schemaName) parts.push(`name: ${JSON.stringify(schemaName)}`);
  parts.push(`entries: [${descriptor.entries.map(e => entryLiteral(emitter, e)).join(', ')}]`);
  return `__schema({${parts.join(', ')}})`;
}

function readDescriptor(node) {
  if (node && typeof node === 'object') {
    if (node.descriptor) return node.descriptor;
    if (node.data?.descriptor) return node.data.descriptor;
  }
  return null;
}

function entryLiteral(emitter, e) {
  switch (e.tag) {
    case 'field': {
      let obj = [
        `tag: "field"`,
        `name: ${JSON.stringify(e.name)}`,
        `modifiers: ${JSON.stringify(e.modifiers)}`,
        `typeName: ${JSON.stringify(e.typeName)}`,
        `array: ${e.array ? 'true' : 'false'}`,
      ];
      if (e.constraintTokens) {
        let c = compileConstraintsLiteral(e.constraintTokens, e);
        if (c) obj.push(`constraints: ${c}`);
      }
      return `{${obj.join(', ')}}`;
    }
    case 'directive': {
      let obj = [`tag: "directive"`, `name: ${JSON.stringify(e.name)}`];
      let args = compileDirectiveArgsLiteral(e.name, e.argTokens || []);
      if (args) obj.push(`args: ${args}`);
      return `{${obj.join(', ')}}`;
    }
    case 'computed':
    case 'method':
    case 'hook': {
      let fnCode = compileCallableFn(emitter, e);
      let obj = [
        `tag: ${JSON.stringify(e.tag)}`,
        `name: ${JSON.stringify(e.name)}`,
        `fn: ${fnCode}`,
      ];
      return `{${obj.join(', ')}}`;
    }
    case 'enum-member': {
      let obj = [`tag: "enum-member"`, `name: ${JSON.stringify(e.name)}`];
      if (e.value !== undefined) obj.push(`value: ${JSON.stringify(e.value)}`);
      return `{${obj.join(', ')}}`;
    }
    default:
      return `{tag: "unknown"}`;
  }
}

// Compile a callable body (`-> body` or `~> body`) to a JS `function(...)`
// expression with dynamic `this`. Both computed getters and methods are
// emitted using the Rip thin-arrow codegen, which naturally produces a
// `function() { ... }` (Rip `->` is NOT a JS arrow). This gives us the
// right `this` semantics for instance-attached methods and proto getters.
function compileCallableFn(emitter, entry) {
  let bodySexpr = parseBodyTokens(entry.bodyTokens);
  if (!bodySexpr) {
    // Empty body — emit a no-op.
    return `(function() {})`;
  }
  // Wrap as a thin-arrow with no params. `emit` in value context produces
  // a parenthesized function expression.
  let arrowSexpr = ['->', [], bodySexpr];
  return emitter.emit(arrowSexpr, 'value');
}

// ----------------------------------------------------------------------------
// Compile-time constraint + directive argument evaluation
// ----------------------------------------------------------------------------
//
// Constraints are captured as raw token slices in Phase 1. Here we evaluate
// them at compile time into a normalized `{min?, max?, default?, regex?}`
// shape that serves both validation (runtime) and DDL emission. Only
// literal-deterministic values are allowed — identifiers, calls, and
// expressions are rejected with a clear error.
//
// `[a]`       → {default: a}
// `[a, b]`    → {min: a, max: b}     (number or length depending on type)
// `[a, b, c]` → {min: a, max: b, default: c}
// `[/regex/]` → {regex: /regex/}     (regex-only default form)
// `[/re/, def]` is rejected as ambiguous; users write `[/re/]` + attrs for
// other constraints.

function compileConstraintsLiteral(tokens, fieldEntry) {
  // tokens start with INDEX_START / `[` and end with the matching closer
  let inner = tokens.slice(1, -1);
  let items = splitTopLevelByComma(inner);
  if (!items.length) return null;

  // Evaluate each item as a literal.
  let values = items.map(part => evalLiteralTokens(part, fieldEntry));

  // Interpret array form.
  let c = {};
  if (values.length === 1) {
    let v = values[0];
    if (v instanceof RegExp) c.regex = v;
    else c.default = v;
  } else if (values.length === 2) {
    if (values[0] instanceof RegExp || values[1] instanceof RegExp) {
      throw schemaError(tokens[0],
        `Regex constraints must be written as [/re/] on their own line; got mixed form.`);
    }
    c.min = values[0];
    c.max = values[1];
  } else if (values.length >= 3) {
    c.min = values[0];
    c.max = values[1];
    c.default = values[2];
  }
  return constraintLiteral(c);
}

function constraintLiteral(c) {
  let parts = [];
  if (c.min !== undefined) parts.push(`min: ${serializeLiteral(c.min)}`);
  if (c.max !== undefined) parts.push(`max: ${serializeLiteral(c.max)}`);
  if (c.default !== undefined) parts.push(`default: ${serializeLiteral(c.default)}`);
  if (c.regex !== undefined) parts.push(`regex: ${c.regex.toString()}`);
  return parts.length ? `{${parts.join(', ')}}` : null;
}

function serializeLiteral(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof RegExp) return v.toString();
  return JSON.stringify(v);
}

// Compile directive args to a JS literal list or null. Each directive has
// its own arg shape — we centralize the parsing here so Layer 2 can rely
// on normalized structures.
function compileDirectiveArgsLiteral(name, tokens) {
  if (!tokens.length) return null;

  // Relation directives: `@belongs_to Org`, `@belongs_to Org?`,
  // `@has_many Order`, `@has_one Profile`, `@one X`, `@many X`.
  if (name === 'belongs_to' || name === 'has_many' || name === 'has_one' ||
      name === 'one' || name === 'many' || name === 'mixin') {
    let t0 = tokens[0];
    if (!t0 || (t0[0] !== 'IDENTIFIER' && t0[0] !== 'PROPERTY')) {
      throw schemaError(t0 || tokens[tokens.length - 1],
        `@${name} requires a target name.`);
    }
    let target = t0[1];
    // `@belongs_to User?` tokenizes as IDENTIFIER "User" with
    // data.predicate=true. A trailing `?` in a later token position is
    // also accepted for robustness.
    let optional = t0.data?.predicate === true;
    let pos = 1;
    if (!optional && tokens[pos]?.[0] === '?') { optional = true; pos++; }
    let parts = [`target: ${JSON.stringify(target)}`];
    if (optional) parts.push('optional: true');
    return `[{${parts.join(', ')}}]`;
  }

  // `@index field` or `@index [a, b]` or `@index [a, b] #` for unique.
  if (name === 'index') {
    let fields = [];
    let unique = false;
    let pos = 0;
    if (tokens[pos]?.[0] === 'IDENTIFIER' || tokens[pos]?.[0] === 'PROPERTY') {
      fields.push(tokens[pos][1]);
      pos++;
    } else if (tokens[pos]?.[0] === '[' || tokens[pos]?.[0] === 'INDEX_START') {
      let inner = [];
      let depth = 1;
      pos++;
      while (pos < tokens.length && depth > 0) {
        let t = tokens[pos];
        if (t[0] === '[' || t[0] === 'INDEX_START') depth++;
        if (t[0] === ']' || t[0] === 'INDEX_END') {
          depth--;
          if (depth === 0) { pos++; break; }
        }
        inner.push(t);
        pos++;
      }
      for (let part of splitTopLevelByComma(inner)) {
        if (part[0] && (part[0][0] === 'IDENTIFIER' || part[0][0] === 'PROPERTY')) {
          fields.push(part[0][1]);
        }
      }
    }
    if (tokens[pos]?.[0] === '#') unique = true;
    let parts = [`fields: ${JSON.stringify(fields)}`];
    if (unique) parts.push('unique: true');
    return `[{${parts.join(', ')}}]`;
  }

  // Bare flag-like directives (@timestamps, @softDelete) don't take args.
  // Anything else — capture as raw literal tokens conservatively.
  return null;
}

// Evaluate a small expression as a literal. Accepts NUMBER, STRING, BOOL,
// NULL, UNDEFINED, REGEX, SYMBOL (returns its name string — for enum-member
// defaults like `[:draft]`), and unary minus on NUMBER. Anything else throws.
function evalLiteralTokens(tokens, fieldEntry) {
  if (!tokens.length) {
    throw schemaError(null, 'Empty constraint value.');
  }
  let first = tokens[0];
  let tag = first[0];
  if (tokens.length === 1) {
    if (tag === 'NUMBER') return Number(first[1]);
    if (tag === 'STRING') return JSON.parse(first[1]);
    if (tag === 'BOOL') return first[1] === 'true';
    if (tag === 'NULL') return null;
    if (tag === 'UNDEFINED') return undefined;
    if (tag === 'REGEX') return parseRegexLiteral(first[1]);
    if (tag === 'SYMBOL') return first[1];
  }
  if (tokens.length === 2 && tag === '-' && tokens[1][0] === 'NUMBER') {
    return -Number(tokens[1][1]);
  }
  // Deterministic but not literal — IDENTIFIER references aren't supported.
  throw schemaError(first,
    `Constraint values must be literals (number, string, boolean, null, regex, :symbol). Got ${tag}.`);
}

function parseRegexLiteral(val) {
  let s = typeof val === 'string' ? val : String(val);
  let m = s.match(/^\/(.*)\/([gimsuy]*)$/s);
  return m ? new RegExp(m[1], m[2]) : new RegExp(s);
}

// Run the tail rewriter passes on a captured body token slice, then feed
// the result through parser.parse() via a temporary lex adapter. The
// returned s-expression is the parsed body — either a single statement or
// a block of statements — ready to wrap in `['->', [], body]`.
function parseBodyTokens(bodyTokens) {
  if (!bodyTokens || !bodyTokens.length) return null;

  // The body tokens were captured by rewriteSchema BEFORE rewriteTypes,
  // tagPostfixConditionals, rewriteTaggedTemplates, addImplicitBracesAndParens,
  // and addImplicitCallCommas ran. Run those tail passes on a sub-lexer
  // whose `this.tokens` is the body slice.
  let LexerCtor = parseBodyTokens._LexerCtor;
  if (!LexerCtor) {
    throw new Error('schema: parseBodyTokens called before Lexer was wired');
  }
  let sub = Object.create(LexerCtor.prototype);
  let toks = bodyTokens.slice();
  // Multi-line callable bodies open with a matched INDENT ... OUTDENT pair
  // wrapping the statements. parser.parse() expects a Body (list of Lines),
  // not a leading INDENT, so strip the outer pair when the first INDENT's
  // matching OUTDENT is the last token.
  if (toks.length >= 2 && toks[0]?.[0] === 'INDENT') {
    let depth = 0;
    let lastOutdent = -1;
    for (let k = 0; k < toks.length; k++) {
      if (toks[k][0] === 'INDENT') depth++;
      else if (toks[k][0] === 'OUTDENT') {
        depth--;
        if (depth === 0) { lastOutdent = k; break; }
      }
    }
    if (lastOutdent === toks.length - 1) {
      toks = toks.slice(1, -1);
    }
  }
  sub.tokens = toks;
  sub.seenFor = sub.seenImport = sub.seenExport = false;
  sub.ends = [];
  sub.indent = 0;
  sub.outdebt = 0;
  sub.indents = [];
  // Ensure a terminating TERMINATOR so parser.parse() sees a clean EOF.
  let lastTag = sub.tokens[sub.tokens.length - 1]?.[0];
  if (lastTag !== 'TERMINATOR') {
    sub.tokens.push(mkToken('TERMINATOR', '\n', bodyTokens[bodyTokens.length - 1]));
  }
  try {
    sub.rewriteTypes?.();
    sub.tagPostfixConditionals?.();
    sub.rewriteTaggedTemplates?.();
    sub.addImplicitBracesAndParens?.();
    sub.addImplicitCallCommas?.();
  } catch (e) {
    // If a tail pass throws, surface a clean schema error.
    throw schemaError(bodyTokens[0], `schema: failed to compile body: ${e.message}`);
  }
  let tokens = sub.tokens.filter(t => t[0] !== 'TYPE_DECL');

  // Swap parser.lexer, parse, restore.
  let savedLexer = parser.lexer;
  parser.lexer = {
    tokens, pos: 0,
    setInput() {},
    lex() {
      if (this.pos >= this.tokens.length) return 1;
      let token = this.tokens[this.pos++];
      let val = token[1];
      if (token.data) {
        val = new String(val);
        Object.assign(val, token.data);
      }
      this.text = val;
      this.loc = token.loc;
      this.line = token.loc?.r;
      return token[0];
    },
  };
  let sexpr;
  try {
    sexpr = parser.parse('');
  } finally {
    parser.lexer = savedLexer;
  }

  // sexpr is `['program', ...statements]`. Unwrap to a body we can feed
  // a thin-arrow AST. One statement → the statement itself. Multiple →
  // ['block', ...].
  if (!Array.isArray(sexpr) || sexpr[0] !== 'program') return null;
  let stmts = sexpr.slice(1);
  if (stmts.length === 0) return null;
  if (stmts.length === 1) return stmts[0];
  return ['block', ...stmts];
}

// ============================================================================
// Helpers
// ============================================================================

function collectModifiers(identToken) {
  let mods = [];
  let d = identToken.data;
  if (d?.await === true) mods.push('!');
  if (d?.predicate === true) mods.push('?');
  return mods;
}

function findMatchingOutdent(tokens, indentIdx) {
  let depth = 0;
  for (let j = indentIdx; j < tokens.length; j++) {
    if (tokens[j][0] === 'INDENT') depth++;
    else if (tokens[j][0] === 'OUTDENT') {
      depth--;
      if (depth === 0) return j;
    }
  }
  return -1;
}

function splitTopLevelByComma(tokens) {
  let parts = [];
  let cur = [];
  let depth = 0;
  for (let t of tokens) {
    let tag = t[0];
    if (tag === '(' || tag === '[' || tag === '{' ||
        tag === 'CALL_START' || tag === 'INDEX_START' ||
        tag === 'PARAM_START' || tag === 'INDENT') depth++;
    if (tag === ')' || tag === ']' || tag === '}' ||
        tag === 'CALL_END' || tag === 'INDEX_END' ||
        tag === 'PARAM_END' || tag === 'OUTDENT') depth--;
    if (tag === ',' && depth === 0) {
      if (cur.length) parts.push(cur);
      cur = [];
      continue;
    }
    cur.push(t);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

function literalOf(tok) {
  let tag = tok[0], val = tok[1];
  if (tag === 'NUMBER') return Number(val);
  if (tag === 'STRING') return JSON.parse(val);
  if (tag === 'BOOL') return val === 'true';
  if (tag === 'NULL') return null;
  if (tag === 'UNDEFINED') return undefined;
  return val;
}

function mkToken(tag, value, origin) {
  let t = [tag, value];
  t.pre = 0;
  t.data = null;
  t.loc = origin?.loc ?? { r: 0, c: 0, n: 0 };
  t.spaced = false;
  t.newLine = false;
  t.generated = true;
  if (origin) t.origin = origin;
  return t;
}

function schemaError(tok, message) {
  let loc = tok?.loc || { r: 0, c: 0 };
  let err = new Error(message);
  err.name = 'SchemaSyntaxError';
  err.loc = loc;
  err.line = loc.r;
  err.column = loc.c;
  err.phase = 'schema';
  err.code = 'E_SCHEMA';
  return err;
}

// ============================================================================
// Runtime — injected into compiled output when the source uses `schema`
// ============================================================================
//
// Four-layer architecture (D22):
//   Layer 1 — Descriptor: the object passed to `__schema({...})`. Raw
//             metadata from compiler, plus real functions for callables.
//   Layer 2 — Normalized: fields map / methods map / computed map / hooks
//             map / directives / enum members. Built lazily on first
//             downstream need. Collision and kind-legality checks live
//             here (Phase 4 tightens them).
//   Layer 3 — Validator plan: compiled validator tree. Built on first
//             `.parse` / `.safe` / `.ok`.
//   Layer 4 — ORM plan (Phase 4) and DDL plan (Phase 4) — not in Phase 3.
//
// Public API per kind (v1):
//   .parse(data)  throws SchemaError on failure, returns value
//   .safe(data)   {ok: true, value, errors: null} | {ok: false, value: null, errors: [...]}
//   .ok(data)     boolean, fast path (no allocation)
//
// Result `value` shape:
//   :shape   — generated class instance (fields enumerable own props,
//              methods non-enumerable prototype fns, computed non-enumerable
//              prototype getters)
//   :input   — plain object (same class-instance plumbing; Phase 3 treats
//              :input like :shape sans methods for consistency)
//   :enum    — the member value (or name when the enum is bare)
//   :mixin   — non-instantiable; raises `Cannot parse :mixin`
//   :model   — Phase 4 (the class additionally wires ORM methods)

const SCHEMA_RUNTIME = `
// ---- Rip Schema Runtime ----------------------------------------------------
// Four layers, lazy compilation:
//   1 (descriptor)   object passed to __schema({...}). Raw metadata.
//   2 (normalized)   fields/methods/computed/hooks/relations/constraints.
//                    Collision checks. Table name derivation. Built once.
//   3 (validator)    compiled validator plan. Built on first .parse.
//   4a (ORM plan)    built on first .find/.create/.save.
//   4b (DDL plan)    built on first .toSQL(). Independent of 4a.

class SchemaError extends Error {
  constructor(issues, schemaName, schemaKind) {
    super(__schemaFormatIssues(issues, schemaName));
    this.name = 'SchemaError';
    this.issues = issues;
    this.schemaName = schemaName || null;
    this.schemaKind = schemaKind || null;
  }
}

function __schemaFormatIssues(issues, name) {
  if (!issues || !issues.length) return 'SchemaError';
  const head = name ? name + ': ' : '';
  return head + issues.map(i => i.message || i.error || 'invalid').join('; ');
}

const __schemaTypes = {
  string:   v => typeof v === 'string',
  number:   v => typeof v === 'number' && !Number.isNaN(v),
  integer:  v => Number.isInteger(v),
  boolean:  v => typeof v === 'boolean',
  date:     v => v instanceof Date && !Number.isNaN(v.getTime()),
  datetime: v => v instanceof Date && !Number.isNaN(v.getTime()),
  email:    v => typeof v === 'string' && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v),
  url:      v => typeof v === 'string' && /^https?:\\/\\/.+/.test(v),
  uuid:     v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  phone:    v => typeof v === 'string' && /^[\\d\\s\\-+()]+$/.test(v),
  text:     v => typeof v === 'string',
  json:     v => v !== undefined,
  any:      ()  => true,
};

function __schemaCheckValue(v, typeName) {
  const check = __schemaTypes[typeName];
  return check ? check(v) : true;
}

// Naming utilities (snake_case column/table names, irregular plurals).
function __schemaSnake(s) { return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); }
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

// ---- Registry ---------------------------------------------------------------
// Process-global, resettable, with placeholder state for forward/circular
// references. Duplicate registration of the same model name is a hard error.

const __SchemaRegistry = {
  _entries: new Map(),
  register(def) {
    // Named schemas of any kind land here. Relations look up :model,
    // @mixin Name looks up :mixin. Algebra (.extend etc.) accepts :shape
    // and derived shapes. Kind is checked at lookup time.
    if (!def.name) return;
    // Most recent registration wins. Recompilation produces a fresh
    // __SchemaDef with the same name; the registry rebinds. Cross-
    // module name collisions should be avoided — schema names are
    // app-global identifiers for relation resolution.
    this._entries.set(def.name, { def, kind: def.kind });
  },
  get(name) {
    const entry = this._entries.get(name);
    return entry ? entry.def : null;
  },
  getKind(name, kind) {
    const entry = this._entries.get(name);
    return entry && entry.kind === kind ? entry.def : null;
  },
  has(name) { return this._entries.has(name); },
  reset() { this._entries.clear(); },
};

// ---- DB adapter seam --------------------------------------------------------
// Default adapter uses fetch to rip-db /sql. Tests can swap with
// __schemaSetAdapter(...) before running queries.

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

// ---- Query builder ----------------------------------------------------------

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

// ---- __SchemaDef ------------------------------------------------------------

class __SchemaDef {
  constructor(desc) {
    this._desc = desc;
    this.kind = desc.kind;
    this.name = desc.name || null;
    this._norm = null;
    this._klass = null;
    this._sourceModel = null;
    if (this.name && (this.kind === 'model' || this.kind === 'mixin')) {
      __SchemaRegistry.register(this);
    }
  }

  _normalize() {
    if (this._norm) return this._norm;

    const fields = new Map();
    const methods = new Map();
    const computed = new Map();
    const hooks = new Map();
    const directives = [];
    const enumMembers = new Map();
    const relations = new Map();
    let timestamps = false;
    let softDelete = false;

    // Reserved names by kind. ORM/instance names cannot appear as fields
    // or methods on a :model because they conflict with generated methods.
    const reservedStatic = new Set(['parse','safe','ok','find','findMany','where','all','first','count','create','toSQL']);
    const reservedInstance = new Set(['save','destroy','reload','ok','errors','toJSON']);
    const reserved = new Set([...reservedStatic, ...reservedInstance]);

    const collision = (n, where) => {
      throw new SchemaError(
        [{field: n, error: 'collision', message: n + ' collides with ' + where}],
        this.name, this.kind);
    };
    const noteCollision = (n) => {
      if (fields.has(n)) collision(n, 'field');
      if (methods.has(n)) collision(n, 'method');
      if (computed.has(n)) collision(n, 'computed');
      if (hooks.has(n)) collision(n, 'hook');
      if (relations.has(n)) collision(n, 'relation');
      if (this.kind === 'model' && reserved.has(n)) collision(n, 'reserved ORM name');
    };

    for (const e of this._desc.entries) {
      switch (e.tag) {
        case 'field':
          noteCollision(e.name);
          fields.set(e.name, {
            name: e.name,
            required: e.modifiers.includes('!'),
            unique: e.modifiers.includes('#'),
            optional: e.modifiers.includes('?'),
            typeName: e.typeName,
            array: e.array === true,
            constraints: e.constraints || null,
          });
          break;
        case 'method':
          noteCollision(e.name);
          methods.set(e.name, e.fn);
          break;
        case 'computed':
          noteCollision(e.name);
          computed.set(e.name, e.fn);
          break;
        case 'hook':
          if (hooks.has(e.name)) collision(e.name, 'duplicate hook');
          hooks.set(e.name, e.fn);
          break;
        case 'directive': {
          if (e.name === 'mixin') {
            // Deferred to the post-pass so we can dedupe diamond includes
            // and detect cycles with a full expansion stack.
            directives.push({ name: e.name, args: e.args || [] });
            break;
          }
          directives.push({ name: e.name, args: e.args || [] });
          if (e.name === 'timestamps') timestamps = true;
          if (e.name === 'softDelete') softDelete = true;
          const rel = __schemaNormalizeDirectiveRelation(e, this.name);
          if (rel) {
            noteCollision(rel.accessor);
            relations.set(rel.accessor, rel);
          }
          break;
        }
        case 'enum-member':
          enumMembers.set(e.name, e.value !== undefined ? e.value : e.name);
          break;
      }
    }

    // @mixin expansion (Phase 5). Depth-first, dedupes diamond includes
    // in the same host expansion, detects cycles with full chain.
    if (this.kind === 'model' || this.kind === 'shape' || this.kind === 'input' ||
        this.kind === 'mixin') {
      __schemaExpandMixins(this, fields, directives, {
        stack: [this.name || '<anon>'],
        seen: new Set([this.name || '<anon>']),
        onCollision: (name, src) => collision(name, 'mixin-included field from ' + src),
      });
    }

    // Add implicit primary key for :model unless a field already marked primary.
    const primaryKey = 'id';
    const tableName = this.kind === 'model' ? __schemaTableName(this.name) : null;

    this._norm = {
      fields, methods, computed, hooks, directives, enumMembers, relations,
      timestamps, softDelete, primaryKey, tableName,
    };
    return this._norm;
  }

  _getClass() {
    if (this._klass) return this._klass;
    const norm = this._normalize();
    const name = this.name || 'Schema';
    const def = this;

    const fieldNames = [...norm.fields.keys()];
    const klass = ({[name]: class {
      constructor(data, persisted = false) {
        // Internal state is non-enumerable so Object.keys(inst) lists
        // only declared fields that received a value.
        Object.defineProperty(this, '_dirty', { value: new Set(), enumerable: false, writable: false, configurable: true });
        Object.defineProperty(this, '_persisted', { value: persisted === true, enumerable: false, writable: true, configurable: true });
        Object.defineProperty(this, '_snapshot', { value: null, enumerable: false, writable: true, configurable: true });
        if (data && typeof data === 'object') {
          for (const k of fieldNames) {
            if (k in data && data[k] !== undefined) this[k] = data[k];
          }
        }
      }
    }})[name];

    for (const [n, fn] of norm.methods) {
      Object.defineProperty(klass.prototype, n, {
        value: fn, writable: true, enumerable: false, configurable: true,
      });
    }
    for (const [n, fn] of norm.computed) {
      Object.defineProperty(klass.prototype, n, {
        get: fn, enumerable: false, configurable: true,
      });
    }

    // Relation methods: user.organization(). Accepts no args; returns
    // a promise to a target-model instance (or array for has_many).
    for (const [acc, rel] of norm.relations) {
      Object.defineProperty(klass.prototype, acc, {
        enumerable: false, configurable: true,
        value: async function() { return __schemaResolveRelation(def, this, rel); },
      });
    }

    // Instance ORM methods — only for :model kind.
    if (this.kind === 'model') {
      Object.defineProperty(klass.prototype, 'save', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaSave(def, this); },
      });
      Object.defineProperty(klass.prototype, 'destroy', {
        enumerable: false, configurable: true, writable: true,
        value: async function() { return __schemaDestroy(def, this); },
      });
      Object.defineProperty(klass.prototype, 'ok', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, false); },
      });
      Object.defineProperty(klass.prototype, 'errors', {
        enumerable: false, configurable: true, writable: true,
        value: function() { return def._validateFields(this, true); },
      });
      Object.defineProperty(klass.prototype, 'toJSON', {
        enumerable: false, configurable: true, writable: true,
        value: function() {
          const out = {};
          for (const k of norm.fields.keys()) out[k] = this[k];
          return out;
        },
      });
    }

    this._klass = klass;
    return klass;
  }

  _hydrate(columns, row) {
    // DB rows are trusted: hydrate into a class instance without
    // revalidating. Column names arrive snake_case; declared fields live
    // under their camelCase names, and implicit columns (id, created_at,
    // updated_at, relation FKs) surface under their camelCase equivalents.
    // Each snake_case column name also aliases the camelCase property via
    // a non-enumerable accessor so order.user_id and order.userId read
    // the same slot — useful when DB column names leak into user code
    // via raw SQL helpers.
    const data = {};
    for (let i = 0; i < columns.length; i++) {
      data[__schemaCamel(columns[i].name)] = row[i];
    }
    const k = this._getClass();
    const inst = new k(data, true);
    for (const key of Object.keys(data)) {
      if (!(key in inst)) {
        Object.defineProperty(inst, key, {
          value: data[key], enumerable: true, writable: true, configurable: true,
        });
      }
    }
    for (let i = 0; i < columns.length; i++) {
      const snake = columns[i].name;
      const camel = __schemaCamel(snake);
      if (snake !== camel && !(snake in inst)) {
        Object.defineProperty(inst, snake, {
          enumerable: false, configurable: true,
          get() { return this[camel]; },
          set(v) { this[camel] = v; },
        });
      }
    }
    return inst;
  }

  _validateFields(data, collect) {
    const norm = this._normalize();
    const errors = collect ? [] : null;
    for (const [n, f] of norm.fields) {
      const v = data == null ? undefined : data[n];
      if (v === undefined || v === null) {
        if (f.required) {
          if (!collect) return false;
          errors.push({field: n, error: 'required', message: n + ' is required'});
        }
        continue;
      }
      if (f.array) {
        if (!Array.isArray(v)) {
          if (!collect) return false;
          errors.push({field: n, error: 'type', message: n + ' must be an array'});
          continue;
        }
        let bad = false;
        for (let i = 0; i < v.length; i++) {
          if (!__schemaCheckValue(v[i], f.typeName)) {
            if (!collect) return false;
            errors.push({field: n, error: 'type', message: n + '[' + i + '] must be ' + f.typeName});
            bad = true;
          }
        }
        if (bad) continue;
      } else if (!__schemaCheckValue(v, f.typeName)) {
        if (!collect) return false;
        errors.push({field: n, error: 'type', message: n + ' must be ' + f.typeName});
        continue;
      }
      // Apply constraint checks.
      const c = f.constraints;
      if (c) {
        if (typeof v === 'string') {
          if (c.min != null && v.length < c.min) { if (!collect) return false; errors.push({field: n, error: 'min', message: n + ' must be at least ' + c.min + ' chars'}); }
          if (c.max != null && v.length > c.max) { if (!collect) return false; errors.push({field: n, error: 'max', message: n + ' must be at most ' + c.max + ' chars'}); }
          if (c.regex && !c.regex.test(v)) { if (!collect) return false; errors.push({field: n, error: 'pattern', message: n + ' is invalid'}); }
        } else if (typeof v === 'number') {
          if (c.min != null && v < c.min) { if (!collect) return false; errors.push({field: n, error: 'min', message: n + ' must be >= ' + c.min}); }
          if (c.max != null && v > c.max) { if (!collect) return false; errors.push({field: n, error: 'max', message: n + ' must be <= ' + c.max}); }
        }
      }
    }
    return collect ? errors : true;
  }

  _applyDefaults(data) {
    const norm = this._normalize();
    for (const [n, f] of norm.fields) {
      if ((data[n] === undefined || data[n] === null) && f.constraints?.default !== undefined) {
        const d = f.constraints.default;
        data[n] = (typeof d === 'object' && d !== null && !(d instanceof RegExp))
          ? structuredClone(d) : d;
      }
    }
    return data;
  }

  _validateEnum(data, collect) {
    const norm = this._normalize();
    for (const [n, v] of norm.enumMembers) {
      if (data === n || data === v) return collect ? [] : true;
    }
    if (!collect) return false;
    const members = [...norm.enumMembers.keys()].join(', ');
    return [{field: '', error: 'enum', message: (this.name || 'enum') + ' expected one of: ' + members}];
  }

  _materializeEnum(data) {
    const norm = this._normalize();
    for (const [n, v] of norm.enumMembers) {
      if (data === n || data === v) return v;
    }
    return data;
  }

  parse(data) {
    if (this.kind === 'mixin') {
      throw new Error(":mixin schema '" + (this.name || 'anon') + "' is not instantiable");
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) throw new SchemaError(errs, this.name, this.kind);
      return this._materializeEnum(data);
    }
    const working = this._applyDefaults({ ...(data || {}) });
    const errs = this._validateFields(working, true);
    if (errs.length) throw new SchemaError(errs, this.name, this.kind);
    const klass = this._getClass();
    return new klass(working, false);
  }

  safe(data) {
    if (this.kind === 'mixin') {
      return {ok: false, value: null, errors: [{field: '', error: 'mixin', message: 'not instantiable'}]};
    }
    if (this.kind === 'enum') {
      const errs = this._validateEnum(data, true);
      if (errs.length) return {ok: false, value: null, errors: errs};
      return {ok: true, value: this._materializeEnum(data), errors: null};
    }
    const working = this._applyDefaults({ ...(data || {}) });
    const errs = this._validateFields(working, true);
    if (errs.length) return {ok: false, value: null, errors: errs};
    const klass = this._getClass();
    return {ok: true, value: new klass(working, false), errors: null};
  }

  ok(data) {
    if (this.kind === 'mixin') return false;
    if (this.kind === 'enum') return this._validateEnum(data, false);
    const working = this._applyDefaults({ ...(data || {}) });
    return this._validateFields(working, false);
  }

  // ---- :model static ORM methods --------------------------------------------

  async find(id) {
    this._assertModel('find');
    const norm = this._normalize();
    const soft = norm.softDelete ? ' AND "deleted_at" IS NULL' : '';
    const sql = 'SELECT * FROM "' + norm.tableName + '" WHERE "' + norm.primaryKey + '" = ?' + soft + ' LIMIT 1';
    const res = await __schemaAdapter.query(sql, [id]);
    if (!res.rows) return null;
    return this._hydrate(res.columns, res.data[0]);
  }

  where(cond, ...params) {
    this._assertModel('where');
    return new __SchemaQuery(this).where(cond, ...params);
  }

  all() {
    this._assertModel('all');
    return new __SchemaQuery(this).all();
  }

  first() {
    this._assertModel('first');
    return new __SchemaQuery(this).first();
  }

  count() {
    this._assertModel('count');
    return new __SchemaQuery(this).count();
  }

  async create(data) {
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
  }

  toSQL(options) {
    this._assertModel('toSQL');
    return __schemaToSQL(this, options);
  }

  _assertModel(api) {
    if (this.kind !== 'model') {
      throw new Error('schema: .' + api + '() is :model-only (got :' + this.kind + ')');
    }
  }

  // ---- Schema algebra (Phase 6) --------------------------------------------
  // Invariant: every algebra operation returns a :shape. Model algebra
  // strips ORM; :shape algebra drops behavior. Derived shapes preserve
  // field metadata (constraints, defaults, modifiers) from the source
  // normalized descriptor.

  pick(...keys) {
    return __schemaDerive(this, (src) => {
      const names = __schemaFlatten(keys);
      const out = new Map();
      for (const k of names) {
        if (!src.has(k)) throw new Error("pick: unknown field '" + k + "' on " + (this.name || 'schema'));
        out.set(k, src.get(k));
      }
      return out;
    });
  }

  omit(...keys) {
    return __schemaDerive(this, (src) => {
      const drop = new Set(__schemaFlatten(keys));
      const out = new Map();
      for (const [k, v] of src) if (!drop.has(k)) out.set(k, v);
      return out;
    });
  }

  partial() {
    return __schemaDerive(this, (src) => {
      const out = new Map();
      for (const [k, v] of src) out.set(k, { ...v, required: false });
      return out;
    });
  }

  required(...keys) {
    return __schemaDerive(this, (src) => {
      const req = new Set(__schemaFlatten(keys));
      const out = new Map();
      for (const [k, v] of src) out.set(k, { ...v, required: req.has(k) ? true : v.required });
      return out;
    });
  }

  extend(other) {
    if (!(other instanceof __SchemaDef)) {
      throw new Error('extend(): argument must be a schema value');
    }
    return __schemaDerive(this, (src) => {
      const merged = new Map(src);
      const otherFields = other._normalize().fields;
      for (const [k, v] of otherFields) {
        if (merged.has(k)) {
          throw new Error("extend(): field '" + k + "' collides between " + (this.name || 'schema') + " and " + (other.name || 'other'));
        }
        merged.set(k, v);
      }
      return merged;
    });
  }
}

function __schemaFlatten(keys) {
  const out = [];
  for (const k of keys) {
    if (typeof k === 'symbol') out.push(Symbol.keyFor(k) || k.description);
    else if (Array.isArray(k)) for (const kk of k) out.push(typeof kk === 'symbol' ? (Symbol.keyFor(kk) || kk.description) : kk);
    else out.push(k);
  }
  return out;
}

function __schemaDerive(source, transform) {
  const src = source._normalize().fields;
  const derivedFields = transform(src);
  const entries = [];
  for (const [, f] of derivedFields) {
    const mods = [];
    if (f.required) mods.push('!');
    if (f.unique) mods.push('#');
    if (f.optional && !f.required) mods.push('?');
    entries.push({
      tag: 'field', name: f.name, modifiers: mods,
      typeName: f.typeName, array: f.array, constraints: f.constraints,
    });
  }
  const name = (source.name || 'Schema') + 'Derived';
  const derived = new __SchemaDef({ kind: 'shape', name, entries });
  // sourceModel propagates through chained algebra. Tooling can follow
  // the chain back to the original :model for projection hints.
  derived._sourceModel = source._sourceModel || (source.kind === 'model' ? source : null);
  return derived;
}

function __schemaCamel(col) { return String(col).replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }

function __schemaNormalizeDirectiveRelation(directive, ownerModel) {
  const args = directive.args;
  if (!args || !args.length) return null;
  const a = args[0];
  const name = directive.name;
  if (name === 'belongs_to') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'belongsTo', target: a.target, accessor: targetLc, foreignKey: __schemaFkName(a.target), optional: !!a.optional };
  }
  if (name === 'has_one' || name === 'one') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'hasOne', target: a.target, accessor: targetLc, foreignKey: __schemaFkName(ownerModel), optional: !!a.optional };
  }
  if (name === 'has_many' || name === 'many') {
    const targetLc = a.target[0].toLowerCase() + a.target.slice(1);
    return { kind: 'hasMany', target: a.target, accessor: __schemaPluralize(targetLc), foreignKey: __schemaFkName(ownerModel), optional: !!a.optional };
  }
  return null;
}

function __schemaExpandMixins(host, fields, directives, ctx) {
  for (const d of directives) {
    if (d.name !== 'mixin' || !d.args || !d.args[0]) continue;
    const target = d.args[0].target;
    if (!target) continue;
    if (ctx.stack.includes(target)) {
      throw new SchemaError(
        [{field: '', error: 'mixin-cycle', message: 'mixin cycle: ' + ctx.stack.concat(target).join(' -> ')}],
        host.name, host.kind);
    }
    if (ctx.seen.has(target)) continue;
    const mx = __SchemaRegistry.getKind(target, 'mixin');
    if (!mx) {
      throw new SchemaError(
        [{field: '', error: 'mixin-missing', message: 'unknown mixin: ' + target}],
        host.name, host.kind);
    }
    ctx.seen.add(target);
    ctx.stack.push(target);
    // Recurse into nested mixins first (depth-first).
    const childDirectives = mx._desc.entries.filter(e => e.tag === 'directive' && e.name === 'mixin')
      .map(e => ({ name: e.name, args: e.args || [] }));
    __schemaExpandMixins(host, fields, childDirectives, ctx);
    // Then contribute the mixin's own fields.
    for (const e of mx._desc.entries) {
      if (e.tag !== 'field') continue;
      if (fields.has(e.name)) {
        throw new SchemaError(
          [{field: e.name, error: 'mixin-collision', message: e.name + ' from mixin ' + target + ' collides with existing field'}],
          host.name, host.kind);
      }
      fields.set(e.name, {
        name: e.name,
        required: e.modifiers.includes('!'),
        unique: e.modifiers.includes('#'),
        optional: e.modifiers.includes('?'),
        typeName: e.typeName,
        array: e.array === true,
        constraints: e.constraints || null,
      });
    }
    ctx.stack.pop();
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

// ---- Save / Destroy --------------------------------------------------------
// Rails-style lifecycle (D18):
//   beforeValidation -> validate -> afterValidation ->
//   beforeSave -> (beforeCreate|beforeUpdate) -> INSERT/UPDATE ->
//   (afterCreate|afterUpdate) -> afterSave
// Destroy:
//   beforeDestroy -> DELETE -> afterDestroy

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

  if (isNew) {
    const cols = [], placeholders = [], values = [];
    for (const [n, f] of norm.fields) {
      const v = inst[n];
      if (v == null) continue;
      cols.push('"' + __schemaSnake(n) + '"');
      placeholders.push('?');
      values.push(__schemaSerialize(v, f));
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
    inst._persisted = true;
  } else {
    const sets = [], values = [];
    for (const [n, f] of norm.fields) {
      sets.push('"' + __schemaSnake(n) + '" = ?');
      values.push(__schemaSerialize(inst[n], f));
    }
    if (sets.length) {
      const pk = norm.primaryKey;
      values.push(inst[pk]);
      const sql = 'UPDATE "' + norm.tableName + '" SET ' + sets.join(', ') + ' WHERE "' + pk + '" = ?';
      await __schemaAdapter.query(sql, values);
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

// ---- DDL emission (.toSQL) --------------------------------------------------
// Layer 4b: runs on first .toSQL() call. Independent of ORM — scripts
// that build schema from DDL never touch .find/.create.

const __SCHEMA_SQL_TYPES = {
  string: 'VARCHAR', text: 'TEXT', integer: 'INTEGER', number: 'DOUBLE',
  boolean: 'BOOLEAN', date: 'DATE', datetime: 'TIMESTAMP', email: 'VARCHAR',
  url: 'VARCHAR', uuid: 'UUID', phone: 'VARCHAR', json: 'JSON', any: 'JSON',
};

function __schemaToSQL(def, options) {
  const { dropFirst = false, header } = options || {};
  const norm = def._normalize();
  const blocks = [];
  if (header) blocks.push(header);

  const table = norm.tableName;
  const seq = table + '_seq';
  if (dropFirst) {
    blocks.push('DROP TABLE IF EXISTS ' + table + ' CASCADE;\\nDROP SEQUENCE IF EXISTS ' + seq + ';');
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

  blocks.push('CREATE SEQUENCE ' + seq + ' START 1;');
  blocks.push('CREATE TABLE ' + table + ' (\\n' + columns.join(',\\n') + '\\n);');
  if (indexes.length) blocks.push(indexes.join('\\n'));

  return blocks.join('\\n\\n') + '\\n';
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

function __schema(descriptor) { return new __SchemaDef(descriptor); }

if (typeof globalThis !== 'undefined') {
  globalThis.__ripSchema = {
    __schema, SchemaError, __SchemaRegistry, __schemaSetAdapter,
  };
}

// === End Schema Runtime ===
`;

function getSchemaRuntime() {
  return SCHEMA_RUNTIME.trimStart();
}

// ============================================================================
// Shadow TypeScript — Phase 3.5
// ============================================================================
//
// Emits virtual `.d.ts` / `.ts` declarations for :input, :shape, and :enum
// schemas so the TS language service can offer autocomplete and catch
// AST-shape mistakes before Phase 4 layers in :model/ORM/algebra. Written
// to mirror `emitComponentTypes()` in src/types.js — same prototype:
// `emitSchemaTypes(sexpr, lines)` returns true when any schema declaration
// was found (drives preamble injection), mutates `lines` with declarations.
//
// Type surface (locked with peer AI):
//
//   interface Schema<T> {
//     parse(data: unknown): T;
//     safe(data: unknown): SchemaSafeResult<T>;
//     ok(data: unknown): boolean;
//   }
//
// `:input`  emits  declare const Foo: Schema<FooValue>;
// `:shape`  emits  declare const Foo: Schema<FooInstance>;   where
//                  FooInstance = FooData & {methods/readonly getters}.
// `:enum`   emits  declare const Role: { parse(...): Role; ok(d): d is Role; ... }
//
// Methods are typed `(...args: any[]) => unknown`. Computed are
// `readonly name: unknown`. Body inference is out of scope for 3.5.

export const SCHEMA_INTRINSIC_DECLS = [
  'interface SchemaIssue { field: string; error: string; message: string; }',
  'type SchemaSafeResult<T> = { ok: true; value: T; errors: null } | { ok: false; value: null; errors: SchemaIssue[] };',
  // Base Schema interface. `Out` is the parsed value type; `In` is the
  // data shape (defaults to unknown). Algebra methods are parameterized
  // over `In` so chained operations on a typed :shape or :model derive
  // correctly; when `In` defaults to unknown, `keyof In` is `never` and
  // algebra methods don't autocomplete — which is the right behavior
  // for :input schemas where the input shape isn't statically known.
  'interface Schema<Out, In = unknown> {',
  '  parse(data: In): Out;',
  '  safe(data: In): SchemaSafeResult<Out>;',
  '  ok(data: unknown): boolean;',
  '  pick<K extends keyof In>(...keys: K[]): Schema<Pick<In, K>, Pick<In, K>>;',
  '  omit<K extends keyof In>(...keys: K[]): Schema<Omit<In, K>, Omit<In, K>>;',
  '  partial(): Schema<Partial<In>, Partial<In>>;',
  '  required<K extends keyof In>(...keys: K[]): Schema<Omit<In, K> & Required<Pick<In, K>>, Omit<In, K> & Required<Pick<In, K>>>;',
  '  extend<U>(other: Schema<U>): Schema<In & U, In & U>;',
  '}',
  // Chainable query builder for :model.
  'interface SchemaQuery<T> {',
  '  all(): Promise<T[]>;',
  '  first(): Promise<T | null>;',
  '  count(): Promise<number>;',
  '  limit(n: number): SchemaQuery<T>;',
  '  offset(n: number): SchemaQuery<T>;',
  '  order(spec: string): SchemaQuery<T>;',
  '}',
  // ModelSchema extends the base schema surface with ORM methods. Algebra
  // over `Data` (not `Instance`) so derived shapes reflect runtime
  // behavior-dropping semantics.
  'interface ModelSchema<Instance, Data = unknown> extends Schema<Instance, Data> {',
  '  find(id: unknown): Promise<Instance | null>;',
  '  findMany(ids: unknown[]): Promise<Instance[]>;',
  '  where(cond: Record<string, unknown> | string, ...params: unknown[]): SchemaQuery<Instance>;',
  '  all(limit?: number): Promise<Instance[]>;',
  '  first(): Promise<Instance | null>;',
  '  count(cond?: Record<string, unknown>): Promise<number>;',
  '  create(data: Partial<Data>): Promise<Instance>;',
  '  toSQL(options?: { dropFirst?: boolean; header?: string }): string;',
  '}',
];

const RIP_TYPE_TO_TS = {
  string:   'string',
  text:     'string',
  email:    'string',
  url:      'string',
  uuid:     'string',
  phone:    'string',
  number:   'number',
  integer:  'number',
  boolean:  'boolean',
  date:     'Date',
  datetime: 'Date',
  json:     'unknown',
  any:      'any',
};

function mapFieldType(entry) {
  let base = RIP_TYPE_TO_TS[entry.typeName] ?? entry.typeName;
  return entry.array ? `${base}[]` : base;
}

// Extract descriptor from a SCHEMA_BODY s-expr node. Grammar reduces
// `['schema', SCHEMA_BODY_VAL]` where the value is the String wrapper
// carrying `.descriptor` via the metadata bridge.
function descriptorFromSchemaNode(schemaNode) {
  if (!Array.isArray(schemaNode)) return null;
  let head = schemaNode[0]?.valueOf?.() ?? schemaNode[0];
  if (head !== 'schema') return null;
  let body = schemaNode[1];
  if (!body || typeof body !== 'object') return null;
  if (body.descriptor) return body.descriptor;
  if (body.data?.descriptor) return body.data.descriptor;
  return null;
}

// Walk the parsed s-expression collecting every named schema declaration.
// Mixins are emitted first so subsequent :shape/:model type aliases can
// reference them in `& Timestamps`-style intersections. Within a group,
// source order is preserved. Returns true when at least one schema was
// found (drives intrinsic preamble injection).
export function emitSchemaTypes(sexpr, lines) {
  const collected = [];
  collectSchemas(sexpr, collected);
  if (!collected.length) return false;

  // Set of locally-known schema names (for relation-accessor type
  // resolution — same-file targets get typed, unknown targets degrade).
  const known = new Set(collected.map(c => c.name));
  const byName = new Map(collected.map(c => [c.name, c]));

  // Mixin types first so type aliases down-file can reference them.
  for (const c of collected) {
    if (c.descriptor.kind === 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  for (const c of collected) {
    if (c.descriptor.kind !== 'mixin') emitOneSchemaType(c, byName, known, lines);
  }
  return true;
}

function collectSchemas(sexpr, out) {
  if (!Array.isArray(sexpr)) return;
  const head = sexpr[0]?.valueOf?.() ?? sexpr[0];
  let exported = false;
  let assignNode = null;
  if (head === 'export' && Array.isArray(sexpr[1])) {
    const inner = sexpr[1];
    const innerHead = inner[0]?.valueOf?.() ?? inner[0];
    if (innerHead === '=') { exported = true; assignNode = inner; }
    else collectSchemas(sexpr[1], out);
  } else if (head === '=') {
    assignNode = sexpr;
  } else if (head === 'program' || head === 'block') {
    for (let i = 1; i < sexpr.length; i++) {
      if (Array.isArray(sexpr[i])) collectSchemas(sexpr[i], out);
    }
  }
  if (assignNode && Array.isArray(assignNode[2])) {
    const name = assignNode[1]?.valueOf?.() ?? assignNode[1];
    const descriptor = descriptorFromSchemaNode(assignNode[2]);
    if (typeof name === 'string' && descriptor) {
      out.push({ name, descriptor, exported });
    }
  }
}

function emitOneSchemaType(collected, byName, known, lines) {
  const { name, descriptor, exported } = collected;
  const exp = exported ? 'export ' : '';
  const decl = exported ? '' : 'declare ';

  if (descriptor.kind === 'enum') {
    const members = [];
    for (const e of descriptor.entries) {
      if (e.tag !== 'enum-member') continue;
      const v = e.value !== undefined ? e.value : e.name;
      members.push(typeof v === 'string' ? JSON.stringify(v) : String(v));
    }
    const union = members.length ? members.join(' | ') : 'never';
    lines.push(`${exp}type ${name} = ${union};`);
    lines.push(`${exp}${decl}const ${name}: { parse(data: unknown): ${name}; safe(data: unknown): SchemaSafeResult<${name}>; ok(data: unknown): data is ${name}; };`);
    return;
  }

  if (descriptor.kind === 'mixin') {
    // :mixin is declaration-time-only; expose it as a field type alias
    // so hosts that `@mixin Foo` can intersect it into their Data type.
    // No value declaration — mixins aren't user-facing runtime values.
    const fieldProps = fieldPropList(descriptor);
    lines.push(`${exp}type ${name} = { ${fieldProps.join('; ')} };`);
    return;
  }

  const fieldProps = fieldPropList(descriptor);
  const mixinRefs = mixinIntersections(descriptor, byName);
  const methods = [];
  const computed = [];
  for (const e of descriptor.entries) {
    if (e.tag === 'method') {
      methods.push(`${e.name}: (...args: any[]) => unknown`);
    } else if (e.tag === 'computed') {
      computed.push(`readonly ${e.name}: unknown`);
    }
    // hooks are intentionally omitted — they fire automatically and
    // shouldn't appear in autocomplete.
  }

  const dataBase = `{ ${fieldProps.join('; ')} }`;
  const dataType = mixinRefs.length ? `${dataBase} & ${mixinRefs.join(' & ')}` : dataBase;

  if (descriptor.kind === 'model') {
    const dataName = `${name}Data`;
    const instName = `${name}Instance`;
    const relationAccessors = modelRelationAccessors(descriptor, known);
    const instanceExtras = [
      ...computed,
      ...methods,
      ...relationAccessors,
      `save(): Promise<${instName}>`,
      `destroy(): Promise<${instName}>`,
      `ok(): boolean`,
      `errors(): SchemaIssue[]`,
      `toJSON(): ${dataName}`,
    ];
    lines.push(`${exp}type ${dataName} = ${dataType};`);
    lines.push(`${exp}type ${instName} = ${dataName} & { ${instanceExtras.join('; ')} };`);
    lines.push(`${exp}${decl}const ${name}: ModelSchema<${instName}, ${dataName}>;`);
    return;
  }

  if (descriptor.kind === 'shape') {
    const dataName = `${name}Data`;
    const instName = `${name}Instance`;
    const hasBehavior = methods.length + computed.length > 0;
    lines.push(`${exp}type ${dataName} = ${dataType};`);
    if (hasBehavior) {
      lines.push(`${exp}type ${instName} = ${dataName} & { ${[...computed, ...methods].join('; ')} };`);
      lines.push(`${exp}${decl}const ${name}: Schema<${instName}, ${dataName}>;`);
    } else {
      lines.push(`${exp}${decl}const ${name}: Schema<${dataName}, ${dataName}>;`);
    }
    return;
  }

  // :input — parse returns the Data shape directly (no behavior).
  const valueName = `${name}Value`;
  lines.push(`${exp}type ${valueName} = ${dataType};`);
  lines.push(`${exp}${decl}const ${name}: Schema<${valueName}, ${valueName}>;`);
}

// Return an array of mixin type-reference strings for `& Foo & Bar` joins.
function mixinIntersections(descriptor, byName) {
  const refs = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'directive' || e.name !== 'mixin') continue;
    const args = e.args;
    const target = args && args[0] && args[0].target;
    if (!target) continue;
    const known = byName && byName.get(target);
    if (known && known.descriptor.kind === 'mixin') {
      refs.push(target);
    }
  }
  return refs;
}

// Emit relation accessor type declarations for :model instances. For
// targets declared in the same file we emit a typed Promise; for
// unknown (cross-file) targets we degrade to `Promise<unknown>` rather
// than emit an unresolved bare name.
function modelRelationAccessors(descriptor, known) {
  const out = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'directive') continue;
    const args = e.args;
    if (!args || !args[0]) continue;
    const target = args[0].target;
    if (!target) continue;
    const optional = args[0].optional === true;
    const targetLc = target[0].toLowerCase() + target.slice(1);
    const instName = `${target}Instance`;
    const isKnown = known && known.has(target);
    if (e.name === 'belongs_to') {
      const retT = isKnown ? (optional ? `${instName} | null` : `${instName} | null`) : 'unknown';
      out.push(`${targetLc}(): Promise<${retT}>`);
    } else if (e.name === 'has_one' || e.name === 'one') {
      const retT = isKnown ? `${instName} | null` : 'unknown';
      out.push(`${targetLc}(): Promise<${retT}>`);
    } else if (e.name === 'has_many' || e.name === 'many') {
      const retT = isKnown ? `${instName}[]` : 'unknown[]';
      const pluralLc = __schemaClientPluralize(targetLc);
      out.push(`${pluralLc}(): Promise<${retT}>`);
    }
  }
  return out;
}

// Minimal pluralizer for accessor names. Keep in sync with the runtime
// __schemaPluralize rules (same surface for declaration parity).
function __schemaClientPluralize(w) {
  const lw = w.toLowerCase();
  if (/[^aeiouy]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(w)) return w + 'es';
  return w + 's';
}

function fieldPropList(descriptor) {
  const props = [];
  for (const e of descriptor.entries) {
    if (e.tag !== 'field') continue;
    const required = e.modifiers.includes('!');
    const mark = required ? '' : '?';
    props.push(`${e.name}${mark}: ${mapFieldType(e)}`);
  }
  return props;
}

// Eagerly install the runtime on globalThis at module load so downstream
// compilation units emitted with `skipRuntimes: true` (a common test-harness
// setting) can pick up `{__schema, SchemaError}` without a separate bootstrap
// step. The same pattern is used by the reactive and component runtimes.
if (typeof globalThis !== 'undefined' && !globalThis.__ripSchema) {
  try { (0, eval)(SCHEMA_RUNTIME); } catch {}
}

export { SCHEMA_RUNTIME };
