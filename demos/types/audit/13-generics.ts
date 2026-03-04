// 13-generics.ts — Generic types in function return position

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
