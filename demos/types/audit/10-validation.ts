// 10-validation.ts — Runtime validation of API responses
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

// ── Negative tests (type errors caught at compile time) ──

async function _negativeTests() {
  const user = await fetchUser(1)
  // @ts-expect-error — property doesn't exist on User
  user.username
  // @ts-expect-error — id is number, not string
  const id: string = user.id
  // @ts-expect-error — firstName is string | null, not string
  const name: string = user.firstName
}
