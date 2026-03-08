// 05-interfaces.ts — Interfaces, extension, and composition

interface Identifiable {
  id: number
}

interface Timestamped {
  createdAt: string
  updatedAt: string
}

interface Named {
  name: string
}

interface Animal {
  name: string
  sound: string
  legs: number
}

interface Dog extends Animal {
  breed: string
}

// Interface with optional members
interface HttpOptions {
  method?: string
  body?: string
  timeout?: number
}

// ── Use the types ──

let item: Identifiable = { id: 1 }
let record: Timestamped = { createdAt: '2024-01-01', updatedAt: '2024-06-15' }
let person: Named = { name: 'Jane' }

let cat: Animal = { name: 'Whiskers', sound: 'meow', legs: 4 }
let dog: Dog = { name: 'Rex', sound: 'woof', legs: 4, breed: 'Labrador' }

let opts: HttpOptions = { method: 'POST', timeout: 5000 }
let minOpts: HttpOptions = {}

console.log('item:', item)
console.log('record:', record)
console.log('person:', person)
console.log('cat:', cat)
console.log('dog:', dog)
console.log('opts:', opts)
console.log('minOpts:', minOpts)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — missing required field (id)
let badId: Identifiable = {}
// @ts-expect-error — wrong type for legs
let badAnimal: Animal = { name: 'Cat', sound: 'meow', legs: 'four' }
// @ts-expect-error — Dog extends Animal, breed missing
let badDog: Dog = { name: 'Rex', sound: 'woof', legs: 4 }
// @ts-expect-error — wrong type for optional field
let badOpts: HttpOptions = { timeout: 'slow' }
