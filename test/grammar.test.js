#!/usr/bin/env bun
/**
 * TextMate grammar regression pins — `packages/vscode/syntaxes/rip.tmLanguage.json`.
 *
 * Rip's render syntax is positionally overloaded (a bare identifier can be a
 * tag, a child value, a boolean flag, or a keyword), so the grammar walks a
 * fine line and we have regressed it several times. These pins tokenize real
 * snippets through the SAME engine VS Code ships (vscode-textmate over the
 * Oniguruma WASM regex engine) and assert the resulting scopes.
 *
 * Fixture format — substring annotations (self-aligning, à la
 * vscode-tmgrammar-test's idea without the column counting):
 *
 *     input disabled
 *   # "input"    entity.name.tag.rip
 *   # "disabled" entity.other.attribute-name.rip
 *
 * A line whose first non-space char is `#` is an ASSERTION for the nearest
 * preceding CODE line. It names a quoted substring of that line; every column
 * spanned by the (first, or @n-th) occurrence must carry the named scope.
 * Prefix the scope with `!` to assert the scope is ABSENT over that range.
 * Assertion lines are NOT fed to the tokenizer — only code lines are, with
 * the rule stack carried across them, so each fixture tokenizes as one unit.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as oniguruma from 'vscode-oniguruma';
import * as vsctm from 'vscode-textmate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sx = (f) => resolve(root, 'packages/vscode/syntaxes', f);
const GRAMMARS = {
  'source.rip': 'rip.tmLanguage.json',
  'rip.injection.markdown': 'rip-markdown-injection.tmLanguage.json',
  'rip.injection.html': 'rip-html-injection.tmLanguage.json',
};

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s), dim = s => color('2', s);
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failed++; }
}

// ── Grammar engine ───────────────────────────────────────────────────────
const wasmBin = readFileSync(resolve(root, 'node_modules/vscode-oniguruma/release/onig.wasm'));
await oniguruma.loadWASM(wasmBin.buffer);
const registry = new vsctm.Registry({
  onigLib: Promise.resolve({
    createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
    createOnigString: (s) => new oniguruma.OnigString(s),
  }),
  loadGrammar: async (scope) => {
    const file = GRAMMARS[scope];
    return file ? vsctm.parseRawGrammar(readFileSync(sx(file), 'utf8'), sx(file)) : null;
  },
});
const ripGrammar = await registry.loadGrammar('source.rip');
// Injection grammars carry top-level patterns, so they tokenize a fenced/script
// block directly here; their `include: source.rip` resolves through the same
// registry. (In VS Code they activate via injectionSelector inside the base
// HTML/Markdown grammars, which aren't needed to exercise the embedding.)
const mdInjection = await registry.loadGrammar('rip.injection.markdown');
const htmlInjection = await registry.loadGrammar('rip.injection.html');

// ── Fixture runner ───────────────────────────────────────────────────────
// Token carrying the scope of the column it owns. Tokenizes code lines in
// sequence (rule stack carried), then checks each caret assertion against the
// code line it annotates.
function scopesAt(tokens, col) {
  for (const t of tokens) if (col >= t.startIndex && col < t.endIndex) return t.scopes;
  return null;
}

const ASSERT_RE = /^\s*#\s*"((?:[^"\\]|\\.)*)"(?:@(\d+))?\s+(!?)(\S.*?)\s*$/;

function runFixture(fixture, grammar = ripGrammar) {
  const lines = fixture.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
  let stack = vsctm.INITIAL;
  let lastCode = null; // { text, tokens }

  for (const line of lines) {
    // An assertion is a `#`-line matching the `# "substr" scope` shape; any
    // other `#`-line is a genuine Rip comment and tokenizes as a code line
    // (so the grammar's own comment scoping can be pinned).
    if (ASSERT_RE.test(line)) {
      if (!lastCode) throw new Error(`assertion with no preceding code line: ${line}`);
      const m = ASSERT_RE.exec(line);
      const [, raw, occStr, bang, scope] = m;
      const needle = raw.replace(/\\(.)/g, '$1');
      const occ = occStr ? parseInt(occStr, 10) : 1;
      const negate = bang === '!';

      // Locate the occ-th occurrence of needle in the code line.
      let start = -1;
      for (let i = 0, from = 0; i < occ; i++) {
        start = lastCode.text.indexOf(needle, from);
        if (start === -1) break;
        from = start + 1;
      }
      if (start === -1)
        throw new Error(`substring ${JSON.stringify(needle)}${occStr ? ` #${occ}` : ''} not found in ${JSON.stringify(lastCode.text)}`);

      for (let col = start; col < start + needle.length; col++) {
        const scopes = scopesAt(lastCode.tokens, col) || [];
        const has = scopes.includes(scope);
        if (has === negate) {
          throw new Error(
            `${negate ? 'unexpected' : 'missing'} scope "${scope}"\n` +
            `      line:  ${JSON.stringify(lastCode.text)}\n` +
            `      token: ${JSON.stringify(needle)} col ${col} (${JSON.stringify(lastCode.text[col])})\n` +
            `      got:   ${scopes.slice(1).join(' ') || '(none)'}`
          );
        }
      }
    } else {
      const r = grammar.tokenizeLine(line, stack);
      stack = r.ruleStack;
      lastCode = { text: line, tokens: r.tokens };
    }
  }
}

// ── Pins ─────────────────────────────────────────────────────────────────
console.log('\nTextMate grammar pins\n');

// All three prop forms on one HTML tag — event binding, bare boolean flag, and
// key: value — each highlighted with its own scope.
check('inline event + bare flag + key on an HTML tag', () => runFixture(`
export Foo = component
  render
    form @submit: foo, noValidate, class: "x"
  # "submit"     entity.other.attribute-name.event.rip
  # "noValidate" entity.other.attribute-name.rip
  # "class"      entity.other.attribute-name.rip
`));

// Bare flag on an HTML tag (block form, same line).
check('bare flag on HTML tag', () => runFixture(`
export Foo = component
  render
    input disabled
  # "input"    entity.name.tag.rip
  # "disabled" entity.other.attribute-name.rip
`));

// Bare flag trailing a key:value on a component.
check('bare flag trailing key:value on a component', () => runFixture(`
export Foo = component
  render
    Button size: "lg", disabled
  # "Button"   entity.name.type.class.rip
  # "size"     entity.other.attribute-name.rip
  # "disabled" entity.other.attribute-name.rip
`));

// Bare flag on a component (block form, same line).
check('bare flag on a component', () => runFixture(`
export Foo = component
  render
    Button disabled
  # "Button"   entity.name.type.class.rip
  # "disabled" entity.other.attribute-name.rip
`));

// String values are strings, never attribute names.
check('string value is a string, not an attribute', () => runFixture(`
export Foo = component
  render
    Button size: "lg"
  # "lg" string.quoted.double.rip
  # "lg" !entity.other.attribute-name.rip
`));

// ── Known limitations (pinned so a fix flips these deliberately) ──────────
// An inline trailing bare identifier is a CHILD here, but the grammar cannot
// tell it from a flag and tags it as an attribute. The semantic-token
// provider (which has live scope analysis) is the layer that will correct
// this; when it does, this pin should flip to `!`.
check('KNOWN: inline trailing child is mis-tagged as an attribute', () => runFixture(`
export Foo = component
  render
    div class: "y", title
  # "title" entity.other.attribute-name.rip
`));

// A bare identifier on its OWN line is never tagged as an attribute: it is a
// tag (if a known HTML name), a keyword, or unscoped. Genuine own-line flags
// therefore get NO highlight today — the other half of the LSP's job.
check('own-line loop-var child is not an attribute', () => runFixture(`
export Foo = component
  render
    for item in items
      item
  # "item" !entity.other.attribute-name.rip
`));

check('own-line keyword stays a keyword', () => runFixture(`
export Foo = component
  render
    if x
      else
  # "else" keyword.control.rip
`));

// ── Core (non-render) scopes ─────────────────────────────────────────────
// The render grammar is the tricky part, but the everyday scopes (strings,
// numbers, comments, types, operators, imports) are where silent theme
// regressions hide. One pin per construct family.

check('string literals — double, single, template', () => runFixture(`
x = "hi"
# "hi" string.quoted.double.rip
y = 'yo'
# "yo" string.quoted.single.rip
z = \`t #{n} u\`
# "t " string.quoted.script.rip
# "n" source.js.embedded.rip
`));

check('numeric literals — decimal, hex, underscored', () => runFixture(`
a = 42
# "42" constant.numeric.decimal.rip
b = 0xff
# "0xff" constant.numeric.hex.rip
c = 1_000
# "1_000" constant.numeric.decimal.rip
`));

check('comments — line and trailing', () => runFixture(`
# a note
# "a note" comment.line.number-sign.rip
x = 1 # tail
# "tail" comment.line.number-sign.rip
`));

check('regular expression literal', () => runFixture(`
re = /ab+c/gi
# "ab+c" string.regexp.rip
# "gi" string.regexp.rip
`));

check('control keywords', () => runFixture(`
if x then y else z
# "if" keyword.control.rip
# "then" keyword.control.rip
# "else" keyword.control.rip
for i in list
# "for" keyword.control.rip
# "in" keyword.control.rip
return foo
# "return" keyword.control.rip
`));

check('type annotation, primitives, union, alias', () => runFixture(`
x:: string
# "::" keyword.operator.type-annotation.rip
# "string" support.type.primitive.rip
y:: number | null
# "number" support.type.primitive.rip
# "|" keyword.operator.type.union.rip
export type Mode = "a"
# "type" storage.type.type.rip
# "Mode" entity.name.type.alias.rip
`));

check('type-keyword name as an object key is a key, not a primitive', () => runFixture(`
number: 'L2602852147'
# "number" meta.object-literal.key.rip
# "number" !support.type.primitive.rip
object?: 42
# "object" meta.object-literal.key.rip
# "object" !support.type.primitive.rip
`));

check('operators — arithmetic, nullish, reactive, logical', () => runFixture(`
a = b + c
# "+" keyword.operator.arithmetic.rip
p ?? q
# "??" keyword.operator.nullish.rip
count := 0
# ":=" keyword.operator.assignment.reactive.rip
doubled ~= count
# "~=" keyword.operator.assignment.reactive.rip
r <=> s
# "<=>" keyword.operator.assignment.reactive.rip
x and y or not z
# "and" keyword.control.rip
# "or" keyword.control.rip
# "not" keyword.control.rip
`));

check('imports — keywords, aliases, module braces', () => runFixture(`
import { api, helper } from './x.rip'
# "import" keyword.control.rip
# "from" keyword.control.rip
# "api" variable.other.readwrite.alias.rip
# "{" punctuation.definition.modules.begin.rip
`));

check('functions — name, params, arrow', () => runFixture(`
add = (lhs, rhs) -> lhs
# "add" entity.name.function.rip
# "lhs" variable.parameter.rip
# "->" storage.type.function.rip
inc = => x
# "=>" storage.type.function.rip
`));

check('instance variable shorthand', () => runFixture(`
inc = -> @count
# "@" punctuation.definition.variable.rip
# "count" variable.other.readwrite.instance.rip
`));

check('tag shorthand — .class is a CSS class in render', () => runFixture(`
export Foo = component
  render
    div.card
  # "card" entity.other.attribute-name.class.rip
`));

// KNOWN: `#id` shorthand is lexed as a line comment (rip has no `#id` sugar;
// `#` always starts a comment). Pinned so a future change to either is noticed.
check('KNOWN: #id after a tag is a comment, not an id', () => runFixture(`
export Foo = component
  render
    div.card#main
  # "main" comment.line.number-sign.rip
`));

// ── Injection grammars (Rip embedded in Markdown / HTML) ─────────────────
// These inject source.rip into a Markdown ```rip fence or an HTML
// <script type="text/rip"> block. The key contract: the fence/tag keeps its
// host scope, and the Rip code inside is wrapped in meta.embedded.block.rip and
// carries real Rip scopes. (`~~~` fences avoid backticks in the JS template.)

check('markdown injection — fence marks language and embeds Rip', () => runFixture(`
~~~rip
# "rip" fenced_code.block.language.markdown
x = "hi"
# "x" meta.embedded.block.rip
# "hi" string.quoted.double.rip
~~~
`, mdInjection));

check('html injection — script tag embeds Rip in its body', () => runFixture(`
<script type="text/rip">
# "script" entity.name.tag.script.html
y = 42
# "y" meta.embedded.block.rip
# "42" constant.numeric.decimal.rip
</script>
`, htmlInjection));

// ── Schema blocks (inline `schema` declarations in source.rip) ───────────
// A `... = schema [:kind]` head ending a line opens an indented block whose
// fields/directives/enum members/hooks get schema scopes; values and
// expression bodies fall through to the rest of the Rip grammar ($self). The
// head prefix (`export Name =`) keeps its normal Rip scopes — the block only
// takes over at the `schema` keyword — and the block releases at the dedent.

check('schema — head keeps Rip scopes, then keyword and kind', () => runFixture(`
export User = schema :model
# "export" keyword.control.rip
# "schema" keyword.control.schema.rip
# ":model" storage.type.schema.rip
  name! string
# "name" variable.other.property.rip
# "!" keyword.operator.modifier.rip
# "string" support.type.rip
`));

check('schema — bare schema head (no kind)', () => runFixture(`
SignupInput = schema
# "schema" keyword.control.schema.rip
  email! email
# "email" variable.other.property.rip
# "email"@2 support.type.rip
`));

check('schema — model-ref type and array suffix', () => runFixture(`
Order = schema :model
  items! OrderItem[]
# "items" variable.other.property.rip
# "OrderItem" entity.name.type.rip
# "[]" punctuation.definition.array.rip
`));

check('schema — field directive and relationships', () => runFixture(`
User = schema :model
  email! email @unique
# "email" variable.other.property.rip
# "@unique" entity.name.function.decorator.rip
  @belongs_to Account
# "@belongs_to" entity.name.function.decorator.rip
# "Account" entity.name.type.rip
  @timestamps
# "@timestamps" entity.name.function.decorator.rip
  @index [role, active]
# "@index" entity.name.function.decorator.rip
# "[" punctuation.definition.array.rip
# "role" variable.other.property.rip
# "active" variable.other.property.rip
# "]" punctuation.definition.array.rip
  @index role
# "@index" entity.name.function.decorator.rip
# "role" variable.other.property.rip
  @unique :email
# "@unique" entity.name.function.decorator.rip
# ":" punctuation.definition.symbol.rip
# "email" variable.other.property.rip
`));

// Inside hook/computed bodies, `@foo` is instance member access, not a
// directive — the directive allowlist must let these fall through.
check('schema — hook-body @member is instance access, not a directive', () => runFixture(`
User = schema :model
  email! email
  beforeSave: -> @email = @email.toLowerCase()
# "@email" variable.other.readwrite.instance.rip
# "@email" !entity.name.function.decorator.rip
# "->" storage.type.function.rip
  isAdmin: ~> @role is 'admin'
# "@role" variable.other.readwrite.instance.rip
# "~>" keyword.operator.assignment.reactive.rip
  display: !> @label
# "display" entity.name.function.rip
# "!>" keyword.operator.assignment.reactive.rip
`));

check('schema — enum members fall through to Rip values', () => runFixture(`
Status = schema :enum
  :pending 0
# ":" punctuation.definition.symbol.rip
# "pending" variable.other.enummember.rip
# "0" constant.numeric.decimal.rip
`));

check('schema — hook/computed entry keys', () => runFixture(`
Address = schema :shape
  full: ~> @street
# "full" entity.name.function.rip
# ":" punctuation.separator.key-value.rip
`));

check('schema — comment inside the block', () => runFixture(`
User = schema :model
  # a note
# "a note" comment.line.number-sign.rip
  name! string
# "name" variable.other.property.rip
`));

check('schema — block ends at dedent', () => runFixture(`
User = schema :model
  name! string
done = 1
# "done" !variable.other.property.rip
# "done" variable.other.readwrite.rip
`));

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
