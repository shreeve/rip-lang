// 11-inference.ts — Type inference on unannotated variables
//
// TypeScript companion showing native inference behavior.
// TS infers from initializers directly — no split declaration issue.
// Where Rip has gaps (block-scoped, destructuring), TS handles them natively.

// ── Setup: typed base variables ──

const count: number = 0
const ratio: number = 3.14
const items: string[] = ['a', 'b', 'c']

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
// TS handles these — Rip doesn't (yet)
// ──────────────────────────────────────────────────

// ── Block-scoped assignment ──
//
// TS uses control flow analysis — even when the first assignment
// is inside a block, the type is tracked. Rip's patcher only
// walks top-level statements, so this is a gap.

let insideIf = 0
if (true) {
  insideIf = count + ratio
}
// @ts-expect-error — TS knows insideIf is number
expectString(insideIf)

// ── Destructuring ──
//
// TS infers element types from the RHS. Rip's patcher only
// matches simple identifiers on the LHS.

const { a, b } = { a: 1, b: 'hello' }
// @ts-expect-error — TS knows a is number
expectString(a)

console.log(insideIf, a, b)
