// 04-unions.ts — Union types (inline, block, discriminated)

// Inline unions
type Status = 'pending' | 'active' | 'done'
type Result = 'success' | 'error' | 'timeout'

// Block unions (vertical form)
type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'

type LogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'

// Discriminated unions — named variants composed into a union
type Circle = { kind: 'circle', radius: number }
type Rect = { kind: 'rect', width: number, height: number }
type Shape = Circle | Rect

// ── Use the types ──

const status: Status = 'active'
const pending: Status = 'pending'
const method: HttpMethod = 'GET'
const postMethod: HttpMethod = 'POST'
const level: LogLevel = 'info'
const fatalLevel: LogLevel = 'fatal'
const result: Result = 'success'

const circle: Shape = { kind: 'circle', radius: 5 }
const rect: Shape = { kind: 'rect', width: 10, height: 20 }

console.log('status:', status)
console.log('pending:', pending)
console.log('method:', method)
console.log('postMethod:', postMethod)
console.log('level:', level)
console.log('fatalLevel:', fatalLevel)
console.log('result:', result)
console.log('circle:', circle)
console.log('rect:', rect)

// ── Switch narrowing ──
//
// TypeScript narrows the type in each case branch. After checking
// kind === 'circle', TS knows shape has .radius — accessing .width
// would be an error. Rip can't do this.

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2
    case 'rect': return shape.width * shape.height
  }
}

console.log('circle area:', area(circle))
console.log('rect area:', area(rect))

// ── Negative: wrong types must be caught ──

// @ts-expect-error — invalid literal not in Status union
const badStatus: Status = 'unknown'
// @ts-expect-error — invalid literal not in HttpMethod union
const badMethod: HttpMethod = 'FETCH'
// @ts-expect-error — invalid literal not in LogLevel union
const badLevel: LogLevel = 'trace'
// @ts-expect-error — number not assignable to Result
const badResult: Result = 0

// ── Enum exhaustiveness ──
//
// TypeScript enforces exhaustive switch handling. The `area` function
// above must handle all Shape variants — adding Triangle without
// updating the switch would produce:
//   "Function lacks ending return statement and return type does
//    not include 'undefined'."
// Rip's `rip check` doesn't verify this — missing cases only fail
// at runtime.
