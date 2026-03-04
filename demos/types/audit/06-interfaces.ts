// 06-interfaces.ts — Interfaces, extension, and composition

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

interface Serializable {
  toJSON: () => string
}

// Interface with optional members
interface HttpOptions {
  method?: string
  body?: string
  timeout?: number
}
