// 04-nullable.ts — Nullable and optional types

// Nullable variables use explicit unions
let optionalName: string | undefined = undefined
let nullableCount: number | null = null

// ── Use the types ──

const maybeName: string | undefined = 'hello'
const maybeCount: number | null = 42

console.log('optionalName:', optionalName)
console.log('nullableCount:', nullableCount)
console.log('maybeName:', maybeName)
console.log('maybeCount:', maybeCount)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — number not assignable to string | undefined
const badOptional: string | undefined = 123
// @ts-expect-error — string not assignable to number | null
const badNullable: number | null = 'oops'
