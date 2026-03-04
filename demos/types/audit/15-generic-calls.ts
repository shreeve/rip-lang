// 15-generic-calls.ts — Generic function calls

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
}

// In TypeScript, you can use explicit type arguments on calls:
//   const data = await response.json<{ users: User[] }>()
//   const result = schema.parse<User>(rawData)
//
// In Rip, you annotate the target variable instead:
//   data:: UserResponse = response.json!
//   result:: User = schema.parse(rawData)

// Generic variable annotation — same in both languages
const weekMap: Map<number, string[]> = new Map()

// ── Use the types ──

const scores: Map<string, number> = new Map()
scores.set('alice', 95)
scores.set('bob', 87)
console.log('weekMap:', weekMap)
console.log('scores:', scores)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — wrong value type (string[] not assignable to number)
const badMap: Map<string, number> = new Map([['a', [1, 2]]])
