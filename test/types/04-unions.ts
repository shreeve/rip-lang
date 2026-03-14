// 04-unions.ts — Union types (inline, block, discriminated)

// Inline unions
type Status = 'pending' | 'active' | 'done'
type Result = 'success' | 'error' | 'timeout'

// Block unions (diff-friendly vertical form)
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

let status: Status = 'active'
let pending: Status = 'pending'
let method: HttpMethod = 'GET'
let postMethod: HttpMethod = 'POST'
let level: LogLevel = 'info'
let fatalLevel: LogLevel = 'fatal'
let result: Result = 'success'

let circle: Shape = { kind: 'circle', radius: 5 }
let rect: Shape = { kind: 'rect', width: 10, height: 20 }

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
// Discriminated union narrowing works in the compiled JS — TypeScript
// narrows shape to { kind: 'circle', radius } in the circle case.
// Accessing .radius is safe because the switch/when compiles to
// switch/case which TS narrows correctly.

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
let badStatus: Status = 'unknown'
// @ts-expect-error — invalid literal not in HttpMethod union
let badMethod: HttpMethod = 'FETCH'
// @ts-expect-error — invalid literal not in LogLevel union
let badLevel: LogLevel = 'trace'
// @ts-expect-error — number not assignable to Result
let badResult: Result = 0

// ── Negative: switch narrowing catches wrong property access ──

function badArea(shape: Shape): number {
  switch (shape.kind) {
    // @ts-expect-error — Circle has no .width
    case 'circle': return shape.width * 2
    // @ts-expect-error — Rect has no .radius
    case 'rect': return shape.radius ** 2
  }
}

// ── Exhaustiveness ──
//
// With strict: true, adding a new Shape variant (e.g. Triangle)
// without updating the switch produces:
//   "Type 'number | undefined' is not assignable to type 'number'"
// because TS knows the switch doesn't cover all cases.
