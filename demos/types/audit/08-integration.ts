// 08-integration.ts — Cross-module integration test

import { add, greet, makePoint, sum, isPositive } from './06-functions.js'

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
}

// ── Use: cross-file typed function calls ──

const user: User = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '555-0100',
}

const point = makePoint(10, 20)
const total = sum(1, 2, 3, 4)

console.log('user:', user.firstName, user.lastName)
console.log('point:', point)
console.log('add(3, 4):', add(3, 4))
console.log('greet(\'World\'):', greet('World'))
console.log('sum(1..4):', total)
console.log('isPositive(5):', isPositive(5))

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string arguments where numbers expected
const badAdd: number = add('a', 'b')
// @ts-expect-error — number argument where string expected
const badGreet: string = greet(42)
// @ts-expect-error — missing required fields on User
const badUser: User = { id: 1, email: 'x@y.com' }
