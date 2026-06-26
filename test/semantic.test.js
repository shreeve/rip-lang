#!/usr/bin/env bun
/**
 * Semantic-token regression pins — the LSP's classify + source-map remap path
 * (`packages/vscode/src/lsp.js`, `textDocument/semanticTokens/full`).
 *
 * Semantic tokens layer ON TOP of the TextMate grammar: where the grammar can
 * only guess from surface syntax, the LSP runs the real compiler + TypeScript
 * classification and maps each token back to Rip source coordinates. These
 * pins drive the actual shipping server as a black box — spawn it, speak LSP
 * over stdio, open a fixture, and assert the decoded token types — so they
 * stay honest across refactors of the (large, intricate) remap.
 *
 * Run under `bun`: the type checker (`typecheck.js`) references the `Bun`
 * global at load, so the server is spawned with bun rather than node.
 */
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const lspPath = resolve(root, 'packages/vscode/src/lsp.js');
const tmp = resolve(__dirname, '_semantic_tmp');

function color(code, s) { return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s; }
const green = s => color('32;1', s), red = s => color('31;1', s);
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); console.log(`  ${green('✓')} ${name}`); passed++; }
  catch (e) { console.log(`  ${red('✗')} ${name}`); console.log(`    ${red(e.message)}`); failed++; }
}

// ── Minimal LSP client over stdio ────────────────────────────────────────
function startServer() {
  const child = spawn('bun', [lspPath, '--stdio'], { cwd: tmp, stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = Buffer.alloc(0);
  const pending = new Map();
  let onLog = () => {};
  let nextId = 1;

  child.stdout.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const m = /Content-Length: (\d+)/i.exec(buf.slice(0, headerEnd).toString());
      if (!m) { buf = buf.slice(headerEnd + 4); continue; }
      const start = headerEnd + 4, len = parseInt(m[1], 10);
      if (buf.length < start + len) break;
      const msg = JSON.parse(buf.slice(start, start + len).toString());
      buf = buf.slice(start + len);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      } else if (msg.method === 'window/logMessage') {
        onLog(msg.params.message);
      }
    }
  });

  const frame = (obj) => {
    const json = JSON.stringify(obj);
    child.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  };
  const send = (method, params) => {
    const id = nextId++;
    frame({ jsonrpc: '2.0', id, method, params });
    return new Promise((res) => pending.set(id, res));
  };
  const notify = (method, params) => frame({ jsonrpc: '2.0', method, params });

  return {
    async init() {
      const ready = new Promise((res) => {
        onLog = (msg) => { if (msg.includes('[rip] ready')) res(); };
      });
      const r = await send('initialize', {
        processId: process.pid,
        rootUri: pathToFileURL(tmp).href,
        capabilities: {},
      });
      this.legend = r.capabilities.semanticTokensProvider.legend.tokenTypes;
      notify('initialized', {});
      await Promise.race([ready, new Promise((res) => setTimeout(res, 8000))]);
    },
    // Write a fixture to disk, open it, and return its decoded tokens. The
    // server processes the didOpen (a synchronous compile) before the
    // following request on its single ordered message queue, so no wait.
    async tokens(name, source) {
      const fp = resolve(tmp, name);
      writeFileSync(fp, source);
      const uri = pathToFileURL(fp).href;
      notify('textDocument/didOpen', { textDocument: { uri, languageId: 'rip', version: 1, text: source } });
      const r = await send('textDocument/semanticTokens/full', { textDocument: { uri } });
      return decode(r?.data || [], source, this.legend);
    },
    stop() { child.kill(); },
  };
}

// Decode the LSP relative-encoded token stream into absolute, text-bearing
// tokens: { line, char, length, type, text }.
function decode(data, source, legend) {
  const lines = source.split('\n');
  const out = [];
  let line = 0, char = 0;
  for (let i = 0; i < data.length; i += 5) {
    line += data[i];
    char = data[i] === 0 ? char + data[i + 1] : data[i + 1];
    const length = data[i + 2];
    out.push({ line, char, length, type: legend[data[i + 3]], text: lines[line]?.slice(char, char + length) });
  }
  return out;
}

// ── Assertion helpers (substring-addressed, like the grammar harness) ────
// Find the source line/col of the occ-th occurrence of needle, then the token
// that starts there. Returns the token, or null if no token starts on it.
function tokenAt(tokens, source, needle, occ = 1) {
  const lines = source.split('\n');
  let seen = 0;
  for (let ln = 0; ln < lines.length; ln++) {
    let from = 0, col;
    while ((col = lines[ln].indexOf(needle, from)) !== -1) {
      if (++seen === occ) return tokens.find((t) => t.line === ln && t.char === col) || null;
      from = col + 1;
    }
  }
  throw new Error(`substring ${JSON.stringify(needle)} #${occ} not found`);
}
function expectType(tokens, source, needle, type, occ = 1) {
  const t = tokenAt(tokens, source, needle, occ);
  if (!t) throw new Error(`expected ${JSON.stringify(needle)} → "${type}", got no token`);
  if (t.type !== type) throw new Error(`expected ${JSON.stringify(needle)} → "${type}", got "${t.type}"`);
}
function expectNoToken(tokens, source, needle, occ = 1) {
  const t = tokenAt(tokens, source, needle, occ);
  if (t) throw new Error(`expected no token on ${JSON.stringify(needle)}, got "${t.type}"`);
}

// ── Setup ────────────────────────────────────────────────────────────────
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(resolve(tmp, 'package.json'), JSON.stringify({ name: 'sem-fixtures', rip: { strict: true, checkAll: true } }));

const server = startServer();
await server.init();

// ── Pins ─────────────────────────────────────────────────────────────────
console.log('\nSemantic-token pins\n');

const SRC = [
  'export Foo = component',
  '  name := "x"',
  '  save = -> name = "y"',
  '  render',
  '    div class: "z", name',
  '    Button size: "lg", disabled',
  '    Button',
  '      disabled',
  '    button @click: save',
  '    if name then Bar tone: "x", name',
].join('\n');

const tokens = await server.tokens('a.rip', SRC);

check('component declaration name → class', () => expectType(tokens, SRC, 'Foo', 'class'));
check('reactive member declaration → property', () => expectType(tokens, SRC, 'name', 'property', 1));
check('method declaration → method', () => expectType(tokens, SRC, 'save', 'method', 1));
check('reactive member referenced as inline child → property', () => expectType(tokens, SRC, 'name', 'property', 3));
check('method passed to an event handler → method', () => expectType(tokens, SRC, 'save', 'method', 2));

// Bare boolean flags. An INLINE flag is already painted attribute-name by the
// TextMate grammar (like any `key:`), so the LSP deliberately emits no token
// there — overriding it would only recolor it out of step with its sibling
// props. An OWN-LINE flag gets no TextMate scope at all, so the stub emits a
// classifying `({ flag: true })` statement; the remap repaints that property
// key as the synthetic `attribute` type, which package.json maps to
// entity.other.attribute-name — the same blue as an inline flag/`key:`.
check('inline bare flag has no semantic token (grammar paints it)', () => expectNoToken(tokens, SRC, 'disabled', 1));
check('own-line bare flag → attribute token', () => expectType(tokens, SRC, 'disabled', 'attribute', 2));

// A prop key on an inline render head (`if … then Bar tone:`) is not caught by
// the line-start checks and the grammar only scopes it meta.object-literal.key,
// so the remap repaints it `attribute` to match every other prop. The trailing
// member child (`name`) stays a member (property).
check('inline-head prop key → attribute token', () => expectType(tokens, SRC, 'tone', 'attribute'));
// A member passed as a component child (`Bar … , name`) is emitted as a
// reference so it classifies as a member — both here and as the `if` condition.
check('inline-head condition member → property', () => expectType(tokens, SRC, 'name', 'property', 4));
check('component member child → property', () => expectType(tokens, SRC, 'name', 'property', 5));

// ── Non-render classifications ───────────────────────────────────────────
// The render block is the subtle part, but the LSP classifies ordinary code
// too; pin the common shapes so a remap change can't silently regress them.

const TYPES_SRC = ['type Mode = "a" | "b"', 'kind:: Mode := "a"'].join('\n');
const typeT = await server.tokens('types.rip', TYPES_SRC);
check('type alias declaration and reference → type', () => {
  expectType(typeT, TYPES_SRC, 'Mode', 'type', 1);
  expectType(typeT, TYPES_SRC, 'Mode', 'type', 2);
});
check('typed reactive binding name → variable', () => expectType(typeT, TYPES_SRC, 'kind', 'variable'));

const FN_SRC = ['greet = (who, count) -> who', 'total = greet("a", 2)'].join('\n');
const fnT = await server.tokens('fn.rip', FN_SRC);
check('function declaration and call site → function', () => {
  expectType(fnT, FN_SRC, 'greet', 'function', 1);
  expectType(fnT, FN_SRC, 'greet', 'function', 2);
});
check('function parameters → parameter', () => {
  expectType(fnT, FN_SRC, 'who', 'parameter', 1);
  expectType(fnT, FN_SRC, 'count', 'parameter');
});

const LOOP_SRC = ['export Foo = component', '  items := []', '  render', '    for row in items', '      div row'].join('\n');
const loopT = await server.tokens('loop.rip', LOOP_SRC);
check('loop variable → variable; iterable member → property', () => {
  expectType(loopT, LOOP_SRC, 'row', 'variable', 1);    // for row
  expectType(loopT, LOOP_SRC, 'items', 'property', 2);  // in items (decl is occ 1)
  expectType(loopT, LOOP_SRC, 'row', 'variable', 2);    // div row (body)
});

const NEST_SRC = ['export Foo = component', '  label := "x"', '  render', '    div', '      span label'].join('\n');
const nestT = await server.tokens('nest.rip', NEST_SRC);
check('member as a child of a nested element → property', () => expectType(nestT, NEST_SRC, 'label', 'property', 2));

// Regression pin for the occurrence-spill mapping — the fragile core. A member
// referenced many times (decl, two mutation bodies, an `if` condition, and a
// component child) must yield a token at EVERY reference; an off-by-one in the
// spill heuristic silently drops one — exactly what blanked the auth screen.
const SPILL_SRC = [
  'export Foo = component',
  '  err := ""',
  '  fix = -> err = ""',
  '  reset = -> err = ""',
  '  render',
  '    if err then Badge err',
  '',
  'Badge = component',
  '  render',
  '    slot',
].join('\n');
const spillT = await server.tokens('spill.rip', SPILL_SRC);
check('every reference of a many-referenced member is classified', () => {
  for (let occ = 1; occ <= 5; occ++) expectType(spillT, SPILL_SRC, 'err', 'property', occ);
});

// `slot` is a render keyword (children projection) AND in HTML_TAG_NAMES, so
// the grammar paints the render-block use entity.name.tag.rip. When the
// component also declares a reactive member named `slot`, the spill remap would
// otherwise paint the keyword use with that member's `property` classification,
// overriding the tag scope. The remap must suppress the keyword use (matchCol
// === slIndent) while still classifying the real member declaration.
const SLOT_SRC = ['export Foo = component', '  slot := 0', '  render', '    slot'].join('\n');
const slotT = await server.tokens('slot.rip', SLOT_SRC);
check('reactive member named slot still classifies at its declaration', () => expectType(slotT, SLOT_SRC, 'slot', 'property', 1));
check('render-keyword slot keeps its grammar tag scope (no semantic token)', () => expectNoToken(slotT, SLOT_SRC, 'slot', 2));

// ── Teardown ─────────────────────────────────────────────────────────────
server.stop();
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
