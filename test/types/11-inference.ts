// 11-inference.ts — Type inference on unannotated variables
//
// TypeScript companion showing native inference behavior.
// TS infers from initializers directly — no split declaration issue.
// Where Rip has gaps (block-scoped, destructuring), TS handles them natively.

// ── Setup: typed base variables ──

let count: number = 0
let ratio: number = 3.14
let items: string[] = ['a', 'b', 'c']

function double(n: number): number {
  return n * 2
}

function expectString(x: string): string {
  return x
}

// ──────────────────────────────────────────────────
// WORKS — same behavior as Rip
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
// WORKS — block-scoped and destructured assignments
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
// TS infers element types from the RHS. Rip's patcher now walks
// destructuring patterns and infers each property's type.

let { a, b } = { a: 1, b: 'hello' }
// @ts-expect-error — number not assignable to string
expectString(a)

console.log(insideIf, a, b)
