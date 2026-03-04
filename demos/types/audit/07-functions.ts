// 07-functions.ts — Typed function params, returns, and patterns

type Point = {
  x: number
  y: number
}

type Address = {
  street: string
  city: string
  state: string
  zip: string
  country?: string
}

type OrderItem = {
  productId: number
  quantity: number
  unitPrice: number
  discount?: number
}

type Order = {
  id: number
  customerId: number
  status: string
  items: OrderItem[]
  total: number
  createdAt: string
  shippedAt?: string
}

// Basic typed function
export function add(a: number, b: number): number {
  return a + b
}

export function greet(n: string): string {
  return `Hello, ${n}!`
}

export function timestamp(): number {
  return Date.now()
}

export function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val))
}

export function makeRange(start: number, end: number): number[] {
  const range: number[] = []
  let i = start
  while (i <= end) {
    range.push(i)
    i++
  }
  return range
}

// Object return with structural type
export function makePoint(x: number, y: number): Point {
  return { x, y }
}

// Union return type
export function parse(input: string): number | null {
  const num = parseInt(input)
  return isNaN(num) ? null : num
}

// Type narrowing
export function describe(val: string | number): string {
  if (typeof val === 'string') {
    return `String: ${val}`
  } else {
    return `Number: ${val}`
  }
}

// Rest parameters
export function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

export function isPositive(n: number): boolean {
  return n > 0
}

// Function taking typed object param
export function formatAddress(addr: Address): string {
  const parts = [addr.street, addr.city, addr.state, addr.zip]
  if (addr.country) {
    parts.push(addr.country)
  }
  return parts.join(', ')
}

// Function taking typed array param
export function calculateTotal(lineItems: OrderItem[]): number {
  return lineItems.reduce((total, item) => {
    const price = item.unitPrice * item.quantity
    const discount = item.discount || 0
    return total + price - discount
  }, 0)
}

export function validateOrder(order: Order): string[] {
  const errors: string[] = []
  if (order.items.length === 0) {
    errors.push('Order must have at least one item')
  }
  if (order.total < 0) {
    errors.push('Total cannot be negative')
  }
  return errors
}

// Functions with any-typed params (workaround for no generics)
export function first(arr: any[]): any {
  return arr[0]
}

export function last(arr: any[]): any {
  return arr[arr.length - 1]
}

export function uniq(arr: any[]): any[] {
  return [...new Set(arr)]
}

// Exercise
console.log('add(3, 4):', add(3, 4))
console.log('greet(\'World\'):', greet('World'))
console.log('clamp(15, 0, 10):', clamp(15, 0, 10))
console.log('makeRange(1, 5):', makeRange(1, 5))
console.log('sum(1, 2, 3, 4):', sum(1, 2, 3, 4))
console.log('isPositive(5):', isPositive(5))
console.log('parse(\'42\'):', parse('42'))
console.log('parse(\'abc\'):', parse('abc'))
console.log('describe(\'hello\'):', describe('hello'))
console.log('describe(42):', describe(42))
console.log('first([10, 20, 30]):', first([10, 20, 30]))
console.log('last([10, 20, 30]):', last([10, 20, 30]))
console.log('uniq([1, 2, 2, 3, 3]):', uniq([1, 2, 2, 3, 3]))

// ── Negative: wrong types must be caught ──
//
// NOTE: Same-file function calls can't check argument types — the
// compiled JS has untyped params. Arity and return-type mismatches
// are still caught. Cross-file calls (via .d.ts) get full checking.

// @ts-expect-error — too few arguments
const badClamp: number = clamp(5, 0);
// @ts-expect-error — wrong return type annotation (sum returns number)
const badSum: string = sum(1, 2, 3);
