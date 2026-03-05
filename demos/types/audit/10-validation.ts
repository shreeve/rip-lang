// 10-validation.ts — Runtime validation + async/await
//
// Rip's return type annotations are erased — no runtime validation.
// TypeScript + Zod gives both: schemas define the shape once,
// infer the type, and validate at runtime.

import { z } from 'zod'

// ── Schema (single source of truth) ──

const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  phone: z.string().nullable(),
})

type User = z.infer<typeof UserSchema>

// ── Typed + validated fetch ──

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  return UserSchema.parse(await response.json())
}

// ── Runtime exercise ──

const alice: User = UserSchema.parse({
  id: 1,
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  phone: '555-1234',
})

const bob: User = UserSchema.parse({
  id: 2,
  email: 'bob@example.com',
  firstName: null,
  lastName: null,
  phone: null,
})

console.log(`id: ${alice.id}`)
console.log(`email: ${alice.email}`)
console.log(`name: ${alice.firstName} ${alice.lastName}`)
console.log(`phone: ${alice.phone}`)
console.log(`id: ${bob.id}`)
console.log(`email: ${bob.email}`)
console.log(`name: ${bob.firstName ?? '(anon)'}`)
console.log(`phone: ${bob.phone ?? '(none)'}`)

// ── Async/await (equivalent of Rip's ! operator) ──

async function delay(ms: number): Promise<string> {
  await new Promise(r => setTimeout(r, ms))
  return `done after ${ms}ms`
}

const r1: string = await delay(50)
console.log(`r1: ${r1}`)

// If we wrote `const r2: number = await delay(50)`, tsc catches:
//   "Type 'string' is not assignable to type 'number'" ✓

// Without return annotation, TS infers return type (no gap in TS)
async function delayUntyped(ms: number) {
  await new Promise(r => setTimeout(r, ms))
  return `untyped after ${ms}ms`
}

const r3 = await delayUntyped(50)
console.log(`r3: ${r3}`)
// In TS this IS caught — delayUntyped infers Promise<string>
// @ts-expect-error — string is not assignable to number
const r4: number = r3
