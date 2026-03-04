// 09-domain.ts — Complex domain modeling with generics

type Address = {
  street: string
  city: string
  state: string
  zip: string
  country?: string
}

type Customer = {
  id: number
  name: string
  email: string
  addresses: Address[]
  primaryAddress?: Address
  tags: string[]
}

type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

type OrderItem = {
  productId: number
  quantity: number
  unitPrice: number
  discount?: number
}

type Order = {
  id: number
  customerId: number
  status: OrderStatus
  items: OrderItem[]
  total: number
  createdAt: string
  shippedAt?: string
}

// Generic structural types
type PaginatedResponse<T> = {
  data: T[]
  page: number
  pageSize: number
  total: number
  hasNext: boolean
}

type ErrorResponse = {
  code: number
  message: string
  details?: string[]
}

// Exercise
const customer: Customer = {
  id: 1,
  name: 'Jane Doe',
  email: 'jane@example.com',
  addresses: [{ street: '123 Main St', city: 'Springfield', state: 'IL', zip: '62704' }],
  tags: ['vip'],
}

const order: Order = {
  id: 1001,
  customerId: customer.id,
  status: 'submitted',
  items: [
    { productId: 1, quantity: 2, unitPrice: 29.99 },
    { productId: 2, quantity: 1, unitPrice: 49.99, discount: 5.00 },
  ],
  total: 104.97,
  createdAt: new Date().toISOString(),
}

console.log('customer:', customer.name);
console.log('order:', order.id, 'status:', order.status);

// ── Negative: wrong types must be caught ──

// @ts-expect-error — missing required fields (name, email, addresses, tags)
const badCustomer: Customer = { id: 1 };
// @ts-expect-error — invalid order status literal
const badOrder: Order = { id: 1, customerId: 1, status: "invalid", items: [], total: 0, createdAt: "" };
// @ts-expect-error — wrong type for address field
const badAddr: Address = { street: 123, city: "X", state: "IL", zip: "62704" };
// @ts-expect-error — missing required unitPrice in OrderItem
const badItem: OrderItem = { productId: 1, quantity: 2 };
