# How `<script type="text/rip">` Works

## The Problem

When the browser sees `<script type="text/rip">`, it doesn't know what Rip
is — it ignores the tag entirely. The content sits in the DOM as inert text.
Our job is to find it, compile it to JavaScript, and execute it.

The naive approach is `eval(compiledJS)`. But that breaks the moment you use
Rip's `!` operator (which compiles to `await`), because `eval` runs code in
a plain script context where `await` is illegal.

## The Solution: Async IIFE

**IIFE** stands for Immediately Invoked Function Expression — a function
defined and called in one step:

```javascript
(() => {
  // code runs immediately
  // variables here don't leak to global scope
})();
```

The key insight: `await` is only valid inside an `async function`. So we
wrap the compiled code in an **async** IIFE:

```javascript
(async () => {
  const { launch } = await importRip('/rip/ui.rip');
  launch('/demo');
})();
```

Now `await` works. The `async` keyword makes the function return a Promise.
The `()` at the end invokes it immediately. The code runs right away, but
asynchronously — it can pause at each `await` and resume when the value
resolves.

## What `processRipScripts` Does

When `rip.js` loads, it registers a handler for `DOMContentLoaded`. That
handler is `processRipScripts`, which does this for each `<script type="text/rip">`:

```
1. Read the text content from the DOM
2. Compile Rip source → JavaScript (using compileToJS)
3. Wrap in an async IIFE: (async () => { <compiled JS> })()
4. eval() the wrapper — this starts execution
5. await the returned Promise — so scripts run in order
```

## Why `(0, eval)` Instead of `eval`

JavaScript has two forms of eval:

- **Direct eval** — `eval(code)` — runs in the current scope, can access
  local variables. Rarely what you want.

- **Indirect eval** — `(0, eval)(code)` — runs in the global scope. The
  `(0, eval)` trick evaluates the expression `0, eval` (comma operator
  returns the right side), which gives you a reference to `eval` that
  JavaScript treats as indirect. This is the standard pattern.

We use indirect eval so the compiled code runs in global scope, where
`globalThis.importRip` and other globals are accessible.

## The Full Chain

```
Rip source:          { launch } = importRip! '/rip/ui.rip'

Compiled JS:         const { launch } = await importRip('/rip/ui.rip');

Wrapped in IIFE:     (async () => {
                       const { launch } = await importRip('/rip/ui.rip');
                     })()

Executed via:        await (0, eval)("(async()=>{\n...\n})()")
```

The `!` postfix in Rip compiles to `await`. The async IIFE provides the
required async context. Indirect eval runs it in global scope. And the
outer `await` ensures scripts execute in order.

## Why `globalThis`

Functions like `importRip` and `rip` are defined inside the `rip.js` ES
module. Module exports are scoped — they're not visible to eval'd code.
To bridge this gap, we register key functions on `globalThis`:

```javascript
globalThis.rip = rip;             // console REPL
globalThis.importRip = importRip; // fetch + compile + import .rip files
```

Now eval'd code (including compiled `<script type="text/rip">` blocks)
can call `importRip(...)` because it's a global.
