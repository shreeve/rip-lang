// 10-integration.ts — Cross-module integration test

import { add, greet, makePoint, formatAddress, calculateTotal, validateOrder } from './07-functions.js'

type User = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  bio?: string
}

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

// Create typed instances
const user: User = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '555-0100',
}

const point: Point = makePoint(10, 20)

const addr: Address = {
  street: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  zip: '62704',
  country: 'US',
}

const order: Order = {
  id: 1001,
  customerId: user.id,
  status: 'submitted',
  items: [
    { productId: 1, quantity: 2, unitPrice: 29.99 },
    { productId: 2, quantity: 1, unitPrice: 49.99, discount: 5.00 },
  ],
  total: 0,
  createdAt: new Date().toISOString(),
}
order.total = calculateTotal(order.items)

console.log('--- Integration test ---')
console.log('user:', user.firstName, user.lastName)
console.log('point:', point)
console.log('add(3, 4):', add(3, 4))
console.log('greet(\'World\'):', greet('World'))
console.log('address:', formatAddress(addr))
console.log('order total:', order.total)
console.log('validation:', validateOrder(order))
console.log('✓ All type-safe code executed successfully')