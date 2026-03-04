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
  // parse() throws ZodError on contract violations — per-field
  // details with expected vs received types. Left unhandled so
  // Sentry (or similar) captures them in production.
  return UserSchema.parse(await response.json())
}

// ── Consume the type (field access is type-checked) ──

async function demo() {
  const user = await fetchUser(1)
  console.log(user.firstName, user.email)

  // user is fully type-safe — these all fail at compile time:
  // @ts-expect-error — property doesn't exist on User
  user.username
  // @ts-expect-error — id is number, not string
  const id: string = user.id
  // @ts-expect-error — firstName is string | null, not string
  const name: string = user.firstName
}
