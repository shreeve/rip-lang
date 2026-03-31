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

// ── Fixed: unresolved import paths ──
//
// Both TypeScript and `rip check` catch nonexistent imports:
//   import { x } from './nonexistent'      // tsc: Cannot find module
//   import { x } from './nonexistent.rip'  // rip: Cannot find module
