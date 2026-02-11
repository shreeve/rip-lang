<p><img src="rip.svg" alt="Rip Logo" width="100"></p>

# Notes

Ideas, future plans, and design thoughts for Rip.

---

## Standard Library (`stdlib`)

Rip is a zero-dependency language, but a small standard library of useful
utilities would save users from writing the same one-liners in every project.
These are **not** language features — they're plain functions that could ship
as a prelude or optional import.

### Candidates

```coffee
# Printing (Ruby's p)
p = console.log

# Exit with optional code (uses implicit `it`)
exit = -> process.exit(it)

# Tap — call a function for side effects, return the original value
# Useful in pipe chains: data |> tap(console.log) |> process
tap = (v, fn) -> fn(v); v

# Identity — returns its argument unchanged
# Useful as a default callback: items.filter(id)
id = -> it

# No-op — does nothing
# Useful as a default handler: onClick ?= noop
noop = ->

# Clamp a value to a range
clamp = (v, lo, hi) -> Math.min(Math.max(v, lo), hi)

# Sleep for N milliseconds (returns a Promise)
sleep = (ms) -> new Promise (resolve) -> setTimeout resolve, ms

# Times helper — call a function N times, collect results
times = (n, fn) -> (fn(i) for i in [0...n])
```

### Design Questions

- **Prelude vs import?** Should these be injected automatically (like Go's
  `fmt` or Rip's reactive runtime), or explicitly imported (`import { p, tap }
  from '@rip-lang/std'`)? Leaning toward explicit — Rip's philosophy is zero
  magic in the output.

- **Scope?** Keep it tiny. A stdlib that grows to 500 functions defeats the
  purpose. Each entry should save real keystrokes on something people do
  constantly.

- **Node vs Browser?** Some helpers (like `exit`) are Node-only. Others (like
  `p`, `tap`, `sleep`) work everywhere. May want to split into `std` (universal)
  and `std/node` (server-only).

---

## Future Syntax Ideas

Ideas that have been discussed but not yet implemented. Each would need
design discussion before building.

- **`defer`** — Go-style cleanup that runs when the function exits. Compiles
  to try/finally. `defer file.close()`.

- **`is a` / `isnt a`** — Readable instanceof. `x is a String` → 
  `x instanceof String`.

- **`.starts?` / `.ends?` / `.has?`** — Ruby-style question-mark methods.
  `url.starts? "https"` → `url.startsWith("https")`.

- **Pattern matching** — `match value` with destructuring arms. Big feature,
  needs careful design.

- **Reactive resource operator (`~>?`)** — Language-level `createResource`.
  `user ~>? fetch!("/api/users/#{id}").json!` gives `user.loading`,
  `user.error`, `user.data`. Park until real-world usage shows demand.

- **Pipe operator (`|>`) — Hack-style placeholder** — Currently Rip uses
  Elixir-style first-arg insertion. A `%` placeholder for arbitrary position
  (`data |> fn(1, %, 3)`) could be added later if needed. Current design
  covers 95%+ of cases.
