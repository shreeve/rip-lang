// 03-structural.ts — Structural types with type keyword

// Basic structure
type Dimensions = {
  width: number
  height: number
}

// With optional properties
type Config = {
  host: string
  port: number
  ssl?: boolean
  timeout?: number
}

// Nested structures
type ResponseData = {
  items: string[]
  total: number
}

type ResponseMeta = {
  page: number
  limit: number
  hasMore: boolean
}

type ApiResponse = {
  data: ResponseData
  meta: ResponseMeta
}

// With readonly fields
type ImmutableConfig = {
  readonly host: string
  readonly port: number
  readonly ssl: boolean
}

// Recursive type
type TreeNode = {
  value: string
  children: TreeNode[]
}

// Exercise
const dim: Dimensions = { width: 800, height: 600 }
const cfg: Config = { host: 'localhost', port: 3000 }
console.log('dimensions:', dim)
console.log('config:', cfg)
