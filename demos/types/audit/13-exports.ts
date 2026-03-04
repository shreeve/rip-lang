// 13-exports.ts — Export type / import type

// Named type export
export type UserIDNumber = number

// Type-only import (not yet supported in Rip)
// import type { User, Order } from './models'

// Mixed export (values + types) — not yet supported in Rip
// export { formatDate, type DateFormat } from './dates'

// ── Use the types ──

const id: UserIDNumber = 42
console.log('id:', id)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — string not assignable to UserIDNumber (number)
const badId: UserIDNumber = 'not-a-number'
