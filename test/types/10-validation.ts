// 10-validation.ts — Runtime validation use cases
//
// TS + Zod implements each case with runtime validation and inferred
// types. Compare with the .rip companion to see the gap: Rip types
// describe the same shapes at compile time, but can't validate at
// runtime. Zod schemas are the single source of truth — they define
// the shape, validate incoming data, and derive the TypeScript type.
//
// Use cases:
//   1. API response shape — validate what the server returns
//   2. Composition — client schema ≠ server model
//   3. Non-DB config — discriminated unions with no backing table
//   4. 3rd-party API transform — normalize external data on parse

import { z } from 'zod'
import dayjs from 'dayjs'

// ── 1. API response shape ──

const UserSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
})

type User = z.infer<typeof UserSchema>

// .parse() validates at runtime AND returns typed value
async function fetchUser(id: number): Promise<User> {
  let response = await fetch(`/api/users/${id}`)
  return UserSchema.parse(await response.json())
}

let alice = UserSchema.parse({ id: 1, email: 'alice@example.com', name: 'Alice' })
let bob = UserSchema.parse({ id: 2, email: 'bob@example.com', name: null })

console.log(`user: ${alice.id} ${alice.email} ${alice.name}`)
console.log(`user: ${bob.id} ${bob.email} ${bob.name ?? '(anon)'}`)

// ── 2. Composition — client schema ≠ server model ──
//
// The DB model (Prisma):
//   model Order {
//     id          Int       @id @default(autoincrement())
//     userId      Int
//     number      String
//     payment     String
//     subtotal    Int
//     total       Int
//     meta        Json      ← items live in here, untyped
//     shippedAt   DateTime?
//     completedAt DateTime?
//     createdAt   DateTime
//     updatedAt   DateTime
//   }
//
// The client schema types meta into OrderItem[], drops DB-only
// fields (userId, updatedAt), transforms date strings into Dayjs
// instances, and computes derived fields (name, status) via
// .transform(). The output type has fields that don't exist in
// the DB at all, and fields whose types differ from the raw JSON.

const OrderItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
})

const OrderSchema = z.object({
  id: z.number(),
  number: z.string(),
  payment: z.string(),
  subtotal: z.number(),
  total: z.number(),
  meta: z.object({
    items: OrderItemSchema.array(),
  }),
  shippedAt: z.string().nullable().transform((val) => val ? dayjs(val) : null),
  completedAt: z.string().nullable().transform((val) => val ? dayjs(val) : null),
  createdAt: z.string().transform((val) => dayjs(val)),
}).transform((order) => {
  let name = order.meta.items[0]?.name ?? ''
  if (order.meta.items.length > 1) {
    let more = order.meta.items.length - 1
    name += ` + ${more} more item${more === 1 ? '' : 's'}`
  }
  let status = order.completedAt ? 'Completed' : order.shippedAt ? 'Shipped' : 'Pending'
  return { ...order, name, status }
})

type Order = z.infer<typeof OrderSchema>

let order = OrderSchema.parse({
  id: 1,
  number: 'ORD-1001',
  payment: 'card',
  subtotal: 22500,
  total: 22500,
  meta: {
    items: [
      { id: 1, name: 'Lab Panel A', price: 7500, quantity: 1 },
      { id: 2, name: 'Lab Panel B', price: 7500, quantity: 2 },
    ],
  },
  shippedAt: null,
  completedAt: null,
  createdAt: '2024-03-15T10:30:00Z',
})

console.log(`order: ${order.number} ${order.name}`)
console.log(`status: ${order.status}`)
console.log(`item: ${order.meta.items[0].name} $${(order.meta.items[0].price / 100).toFixed(2)}`)
console.log(`item: ${order.meta.items[1].name} $${(order.meta.items[1].price / 100).toFixed(2)} x${order.meta.items[1].quantity}`)

// ── 3. Non-DB config — discriminated unions ──
//
// Workflow configs are built server-side and returned as JSON —
// no database table. Each step type has different required fields.
//
// z.discriminatedUnion() validates the discriminant and applies
// the correct schema per variant — both at compile time and runtime.

const IntroStepSchema = z.object({
  type: z.literal('intro'),
  heading: z.string(),
  consent: z.string(),
})

const TaskStepSchema = z.object({
  type: z.literal('task'),
  heading: z.string(),
  duration: z.number(),
})

const FinalStepSchema = z.object({
  type: z.literal('final'),
  heading: z.string(),
  button: z.string().nullable(),
})

const WorkflowStepSchema = z.discriminatedUnion('type', [
  IntroStepSchema,
  TaskStepSchema,
  FinalStepSchema,
])

const WorkflowSchema = z.object({
  name: z.string(),
  steps: WorkflowStepSchema.array(),
})

type Workflow = z.infer<typeof WorkflowSchema>

let workflow = WorkflowSchema.parse({
  name: 'Lab Kit Collection',
  steps: [
    { type: 'intro', heading: 'Welcome', consent: 'I agree to the terms' },
    { type: 'task', heading: 'Collect Sample', duration: 300 },
    { type: 'final', heading: 'Ship Kit', button: 'findLocations' },
  ],
})

console.log(`workflow: ${workflow.name} (${workflow.steps.length} steps)`)
for (let step of workflow.steps) {
  console.log(`step: ${step.type} - ${step.heading}`)
  // after narrowing on step.type, variant-specific fields are accessible
  if (step.type === 'intro') {
    console.log(`  consent: ${step.consent}`)
  } else if (step.type === 'task') {
    console.log(`  duration: ${step.duration}s`)
  } else if (step.type === 'final') {
    console.log(`  button: ${step.button}`)
  }
}

// ── 4. 3rd-party API transform ──
//
// QuickBooks returns PascalCase fields: { Id: "123", DisplayName: "Acme Corp" }
// Our app wants camelCase: { id: "123", displayName: "Acme Corp" }
//
// In Zod, .transform() normalizes during .parse() — one declaration
// handles validation + reshaping + output type inference.
// This data doesn't come from your DB, so a server .schema can't define it.

const QBCustomerSchema = z.object({
  Id: z.string(),
  DisplayName: z.string(),
}).transform((raw) => ({
  id: raw.Id,
  displayName: raw.DisplayName,
}))

let customer = QBCustomerSchema.parse({ Id: '123', DisplayName: 'Acme Corp' })
console.log(`customer: ${customer.id} ${customer.displayName}`)
