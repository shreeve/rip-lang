// 12-generics.ts — Generic types in function return position

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  bio?: string
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

async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`)
  return response.json()
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch('/api/users')
  const data = await response.json()
  return data.users
}

async function createOrder(cart: OrderItem[]): Promise<Order> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    body: JSON.stringify(cart),
  })
  return response.json()
}

function getEntries(): Map<string, number> {
  return new Map()
}

// ── Use the types ──

const entries: Map<string, number> = getEntries()
console.log('entries:', entries)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — Map<string,number> not assignable to string
const badEntries: string = getEntries()
// @ts-expect-error — wrong generic type argument
const badMap: Map<number, number> = getEntries()
