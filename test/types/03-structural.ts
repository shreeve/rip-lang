// 03-structural.ts — TypeScript companion

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
type ApiResponse = {
  data: {
    items: string[]
    total: number
  }
  meta: {
    page: number
    limit: number
    hasMore: boolean
  }
}

// With readonly fields
type ImmutableConfig = {
  readonly host: string
  readonly port: number
  readonly ssl: boolean
}

// Optional vs required-but-undefined (distinct in TS)
type FormField = {
  label: string
  value: string | undefined
  placeholder?: string
}

// Recursive type
type TreeNode = {
  value: string
  children: TreeNode[]
}

// Generic structural type
type PagedResult<T> = {
  data: T[]
  page: number
  total: number
}

// ── Use the types ──

let dim: Dimensions = { width: 800, height: 600 }
let cfg: Config = { host: 'localhost', port: 3000 }
let fullCfg: Config = { host: 'prod.example.com', port: 443, ssl: true, timeout: 5000 }

let resp: ApiResponse = {
  data: { items: ['a', 'b'], total: 2 },
  meta: { page: 1, limit: 10, hasMore: false },
}

let frozen: ImmutableConfig = { host: 'localhost', port: 3000, ssl: true }

let tree: TreeNode = {
  value: 'root',
  children: [
    { value: 'left', children: [] },
    { value: 'right', children: [{ value: 'deep', children: [] }] },
  ],
}

// value is required (must pass key), placeholder is optional (can omit key)
let field: FormField = { label: 'Name', value: undefined }
let fullField: FormField = { label: 'Email', value: 'test@example.com', placeholder: 'you@domain.com' }

console.log('dimensions:', dim)
console.log('config:', cfg)
console.log('fullCfg:', fullCfg)
console.log('response items:', resp.data.items)
console.log('frozen:', frozen)
console.log('field:', field)
console.log('fullField:', fullField)
console.log('tree root:', tree.value)

let paged: PagedResult<string> = { data: ['a', 'b'], page: 1, total: 2 }
console.log('paged:', paged)

// ── Negative: wrong types must be caught ──

// @ts-expect-error — missing required field (height)
let badDim: Dimensions = { width: 800 }
// @ts-expect-error — wrong field type
let badCfg: Config = { host: 123, port: 3000 }
// @ts-expect-error — extra unknown field
let badExtra: Dimensions = { width: 800, height: 600, depth: 100 }
// @ts-expect-error — nested wrong type
let badResp: ApiResponse = { data: { items: [1, 2], total: 2 }, meta: { page: 1, limit: 10, hasMore: false } }
// @ts-expect-error — missing required field (value must be passed even if undefined)
let badField: FormField = { label: 'Name' }
// @ts-expect-error — wrong element type in generic structural type
let badPaged: PagedResult<string> = { data: [1, 2], page: 1, total: 2 }

// ── Gap: index signatures ──
// These work in TypeScript but emit with a missing `[` in Rip.
//
type Dictionary = {
  [key: string]: number
}
