// 11-inference.ts — Type inference on unannotated variables
//
// TypeScript companion showing native inference behavior.
// TS infers from initializers directly — `let x = value` gives
// the type immediately. Rip emits inline-let for most variables,
// achieving the same result. For hoisted variables, Rip's
// patchUninitializedTypes fills in the type at check time.

// ── Setup ──

let count = 0
let ratio = 3.14
let items = ['a', 'b', 'c']

function double(n: number) {
  return n * 2
}

function expectString(x: string) {
  return x
}

// ──────────────────────────────────────────────────
// Top-level assignment with a concrete RHS
// ──────────────────────────────────────────────────

// ── Primitives ──

let total = count + ratio
let label = 'hello'
let active = true

// @ts-expect-error — inferred number
total = 'oops'
// @ts-expect-error — inferred string
label = 42
// @ts-expect-error — inferred boolean
active = 'yes'

// ── Typed function return ──

let result = double(5)
// @ts-expect-error — inferred number
result = 'oops'

// ── Method calls on typed values ──

let upper = 'hello'.toUpperCase()
let joined = items.join(', ')

// @ts-expect-error — inferred string
upper = 42
// @ts-expect-error — inferred string
joined = false

// ── Array element access ──

let first = items[0]
// @ts-expect-error — inferred string | undefined
first = 99

// ── Template literals ──

let msg = `count is ${count}`
// @ts-expect-error — inferred string
msg = 42

console.log(total, label, active, result, upper, joined, first, msg)

// ──────────────────────────────────────────────────
// Block-scoped and destructured assignments
// ──────────────────────────────────────────────────

// ── Block-scoped first assignment ──
//
// Rip compiles this as `let insideIf; ... insideIf = count + ratio;`
// (split declaration). The patcher finds the assignment inside the
// if-block and infers `number`. TS can't mirror the split pattern
// (strict rejects untyped `let`), so we use a typed declaration.

let insideIf: number
if (true) {
  insideIf = count + ratio
}
// @ts-expect-error — number not assignable to string
expectString(insideIf)

// ── Destructuring ──
//
// TS infers element types from the RHS. Rip's patcher walks
// destructuring patterns and infers each property's type.

let { a, b } = { a: 1, b: 'hello' }
// @ts-expect-error — number not assignable to string
expectString(a)

console.log(insideIf, a, b)

// ──────────────────────────────────────────────────
// Inline-let inside functions
// ──────────────────────────────────────────────────

// Variables inside functions get `let x = value;` at the assignment
// site. TS infers the type directly from the initializer.

function expectNum(x: number) {
  return x
}

function process(data: string[]) {
  let csv = data.join(', ')
  let loud = csv.toUpperCase()
  return loud
}

let out = process(items)
// @ts-expect-error — out inferred as string
expectNum(out)

function filterBy(query: string) {
  let q = query.toLowerCase()
  return items.filter((s) => s.includes(q))
}

let matches = filterBy('a')
// @ts-expect-error — matches inferred as string[]
expectNum(matches)

console.log(out, matches)

// ──────────────────────────────────────────────────
// Block-confined inside functions
// ──────────────────────────────────────────────────

// Variables confined to one branch inside a function get `let`
// emitted at the block level. Before inline-let, these were
// hoisted to the function top as `let x;` — TS saw `any`.

function search(data: string[], query: string) {
  if (query.length > 0) {
    let needle = query.toLowerCase()
    let hits = data.filter((n) => n.toLowerCase().includes(needle))
    // @ts-expect-error — hits inferred as string[]
    expectNum(hits)
    return hits.join(', ')
  } else {
    return 'no results'
  }
}

let found = search(items, 'a')
// @ts-expect-error — found inferred as string
expectNum(found)

console.log(found)
