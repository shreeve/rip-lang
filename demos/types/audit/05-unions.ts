// 05-unions.ts — Union types (inline, block, discriminated)

// Inline unions
type Status = 'pending' | 'active' | 'done'
type Result = 'success' | 'error' | 'timeout'

// Block unions (vertical form)
type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'

type LogLevel =
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'

// Discriminated unions
type Shape =
  | { kind: 'circle', radius: number }
  | { kind: 'rect', width: number, height: number }

const currentStatus: Status = 'active'
const method: HttpMethod = 'GET'
const level: LogLevel = 'info'
console.log('status:', currentStatus)
console.log('method:', method)
console.log('level:', level)
