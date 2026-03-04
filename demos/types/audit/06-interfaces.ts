// 06-interfaces.ts — Interfaces, extension, and composition

interface Identifiable {
  id: number;
}

interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

interface Named {
  name: string;
}

interface Animal {
  name: string;
  sound: string;
  legs: number;
}

interface Dog extends Animal {
  breed: string;
}

interface Serializable {
  toJSON: () => string;
}

// Interface with optional members
interface HttpOptions {
  method?: string;
  body?: string;
  timeout?: number;
}

// ── Use the types ──

const item: Identifiable = { id: 1 };
const record: Timestamped = { createdAt: "2024-01-01", updatedAt: "2024-06-15" };
const person: Named = { name: "Jane" };

const cat: Animal = { name: "Whiskers", sound: "meow", legs: 4 };
const dog: Dog = { name: "Rex", sound: "woof", legs: 4, breed: "Labrador" };

const opts: HttpOptions = { method: "POST", timeout: 5000 };
const minOpts: HttpOptions = {};

console.log("item:", item);
console.log("record:", record);
console.log("person:", person);
console.log("cat:", cat);
console.log("dog:", dog);
console.log("opts:", opts);

// ── Negative: wrong types must be caught ──

// @ts-expect-error — missing required field (id)
const badId: Identifiable = {};
// @ts-expect-error — wrong type for legs
const badAnimal: Animal = { name: "Cat", sound: "meow", legs: "four" };
// @ts-expect-error — Dog extends Animal, breed missing
const badDog: Dog = { name: "Rex", sound: "woof", legs: 4 };
// @ts-expect-error — wrong type for optional field
const badOpts: HttpOptions = { timeout: "slow" };
