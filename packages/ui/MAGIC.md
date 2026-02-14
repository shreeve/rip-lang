# How Rip Runs in the Browser

Rip provides full async/await support across every browser execution
context — inline scripts, the Playground, and the console REPL. No other
compile-to-JS language has this.

## The Execution Contexts

| Context | How async works | Returns value? |
|---------|-----------------|----------------|
| `<script type="text/rip">` | Async IIFE wrapper | No (fire-and-forget) |
| Playground "Run" button | Async IIFE wrapper | No (use console.log) |
| `rip()` console REPL | Rip `do ->` block | Yes (sync direct, async via Promise) |
| `.rip` files via `importRip()` | ES module import | Yes (module exports) |

## `<script type="text/rip">` — Inline Scripts

When the browser sees `<script type="text/rip">`, it ignores the tag.
The `processRipScripts` handler finds these tags on `DOMContentLoaded`,
compiles each one to JavaScript, wraps it in an async IIFE, and evals it:

```
Rip source:     { launch } = importRip! '/rip/ui.rip'
Compiled JS:    const { launch } = await importRip('/rip/ui.rip');
Wrapped:        (async () => { const { launch } = await importRip(...); })()
Executed via:   await (0, eval)("(async()=>{...})()")
```

The `!` postfix compiles to `await`. The async IIFE provides the required
async context. Indirect eval runs it in global scope. The outer `await`
ensures scripts execute in order.

## `rip()` — Browser Console REPL

The `rip()` function wraps user code in a Rip `do ->` block before
compiling. This lets the Rip compiler handle two things natively:

1. **Implicit return** — the last expression is returned automatically
2. **Auto-async detection** — if the code contains `!`, the `do ->` block
   compiles to an async IIFE; otherwise it compiles to a sync IIFE

```
rip("42 * 10 + 8")

  Rip wraps as:     do ->
                      42 * 10 + 8

  Compiled JS:      (() => { return 42 * 10 + 8; })();

  Result:           428 (direct value)
```

```
rip("res = fetch! 'https://api.example.com/data'; res.json!")

  Rip wraps as:     do ->
                      res = fetch! 'https://api.example.com/data'
                      res.json!

  Compiled JS:      (async () => {
                      res = await fetch('https://...');
                      return await res.json();
                    })();

  Result:           Promise → Chrome auto-awaits → {id: 1, ...}
```

### Variable Persistence

Variables persist between `rip()` calls on `globalThis`:

- `let` declarations are stripped — bare assignments create globals in
  sloppy mode (e.g., `x = 42` creates `globalThis.x`)
- `const` is replaced with `globalThis.` for explicit hoisting
- After an async call resolves, the result is stored in `globalThis._`

```javascript
rip("name = 'Alice'")           // name is now on globalThis
rip("console.log name")         // → Alice
await rip("data = fetch!('https://...').json!()")
data.title                      // → accessible in plain JS too
```

## Why `(0, eval)` Instead of `eval`

JavaScript has two forms of eval:

- **Direct eval** — `eval(code)` — runs in the current scope, can access
  local variables. Rarely what you want.

- **Indirect eval** — `(0, eval)(code)` — runs in the global scope. The
  `(0, eval)` trick evaluates `0, eval` (comma operator returns the right
  side), producing a reference to `eval` that JavaScript treats as indirect.

We use indirect eval so compiled code runs in global scope, where
`globalThis.importRip`, `globalThis.rip`, and other globals are accessible.

## What `globalThis` Provides

When `rip.browser.js` loads, it registers these on `globalThis`:

| Function | Purpose |
|----------|---------|
| `rip(code)` | Console REPL — compile and execute Rip code |
| `importRip(url)` | Fetch, compile, and import a `.rip` file as an ES module |
| `compileToJS(code)` | Compile Rip source to JavaScript |
| `__rip` | Reactive runtime — `__state`, `__computed`, `__effect`, `__batch` |
| `__ripComponent` | Component runtime — `__Component`, `__clsx`, `__fragment` |
| `__ripExports` | All compiler exports — `compile`, `compileToJS`, `formatSExpr`, `VERSION`, `BUILD_DATE`, `getReactiveRuntime`, `getComponentRuntime` |

These bridge the gap between ES module scope (where the functions are
defined) and the global scope (where eval'd code and inline scripts run).

## Why This Matters

CoffeeScript, TypeScript, LiveScript, Elm, PureScript — no compile-to-JS
language has a browser REPL that handles async natively. Their `await`
only works inside explicitly declared async functions.

Rip's `!` operator works everywhere — in a component, in an inline script
tag, in the browser console, in a `.rip` file. The async context is
provided transparently, and the user never has to think about it.
