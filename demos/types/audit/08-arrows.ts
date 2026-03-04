// 08-arrows.ts — Typed arrow functions and array transforms

const nums: number[] = [1, 2, 3, 4, 5]
const doubled: number[] = nums.map((x) => x * 2)
const evens: number[] = nums.filter((x) => x % 2 === 0)
const total: number = nums.reduce((acc, x) => acc + x, 0)

console.log('doubled:', doubled)
console.log('evens:', evens)
console.log('total:', total)
