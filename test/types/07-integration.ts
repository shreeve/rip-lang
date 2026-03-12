// 07-integration.ts — Cross-module integration test

import { add, greet, makePoint, sum, isPositive } from './06-functions'

// ── Use: cross-file typed function calls ──

let point = makePoint(10, 20)
let total = sum(1, 2, 3, 4)

console.log('point:', point)
console.log('add(3, 4):', add(3, 4))
console.log('greet(\'World\'):', greet('World'))
console.log('sum(1..4):', total)
console.log('isPositive(5):', isPositive(5))

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string arguments where numbers expected
let badAdd = add('a', 'b')
// @ts-expect-error — number argument where string expected
let badGreet = greet(42)
// @ts-expect-error — boolean arguments where numbers expected
let badPoint = makePoint(true, false)
// @ts-expect-error — string arguments where numbers expected
let badSum = sum('a', 'b')
// @ts-expect-error — string argument where number expected
let badPos = isPositive('five')

// ── Unresolved import paths ──
//
// TypeScript catches nonexistent imports immediately:
//   import { x } from './nonexistent'  // Cannot find module
// Rip's `rip check` doesn't verify import specifiers resolve
// to actual files — the error only surfaces at runtime.
