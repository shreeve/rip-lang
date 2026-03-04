// 07-arrows.ts — Typed arrow functions and array transforms

const nums: number[] = [1, 2, 3, 4, 5]
const doubled: number[] = nums.map((x) => x * 2)
const evens: number[] = nums.filter((x) => x % 2 === 0)
const total: number = nums.reduce((acc, x) => acc + x, 0)

const words: string[] = ['hello', 'world', 'rip']
const upper: string[] = words.map((w) => w.toUpperCase())
const long: string[] = words.filter((w) => w.length > 3)
const joined: string = words.join(', ')

console.log('doubled:', doubled)
console.log('evens:', evens)
console.log('total:', total)
console.log('upper:', upper)
console.log('long:', long)
console.log('joined:', joined)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — map returns number[], not string[]
const badMap: string[] = nums.map((x) => x * 2)
// @ts-expect-error — filter returns number[], not string[]
const badFilter: string[] = nums.filter((x) => x > 2)
// @ts-expect-error — reduce returns number, not string
const badReduce: string = nums.reduce((acc, x) => acc + x, 0)
