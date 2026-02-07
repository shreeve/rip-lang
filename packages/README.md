<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.svg" style="width:50px" /> <br>

# Rip Packages

> **Optional packages that extend Rip for full-stack development**

All packages are written in Rip, have zero dependencies, and run on Bun.

## Installation

```bash
bun add rip-lang                 # Core language (required)
bun add @rip-lang/api            # Web framework
bun add @rip-lang/server         # Process manager
bun add @rip-lang/db             # DuckDB server
bun add @rip-lang/schema         # ORM + validation
bun add @rip-lang/swarm          # Parallel job runner
bun add @rip-lang/csv            # CSV parser + writer
```

---

## Packages

### [@rip-lang/api](api/) — Web Framework

Hono-compatible web framework with Sinatra-style routing, AsyncLocalStorage context, built-in validators, and smart response handling. ~595 lines.

```coffee
import { get, post, start } from '@rip-lang/api'

get '/', -> { message: 'Hello, Rip!' }
get '/users/:id', -> User.find!(read 'id')

start port: 3000
```

### [@rip-lang/server](server/) — Process Manager

Multi-worker process manager with hot reloading, automatic HTTPS, mDNS service discovery, and request queueing. ~1,110 lines.

```bash
rip-server http app.rip          # Start with workers + hot-reload
```

### [@rip-lang/db](db/) — DuckDB Server

HTTP server for DuckDB queries with JSONCompact responses, parameterized queries, and duck-ui compatibility. One server per database. ~225 lines.

```bash
rip-db mydata.duckdb --port=4000
```

### [@rip-lang/schema](schema/) — ORM + Validation

Unified schema language with ActiveRecord-style ORM. Replaces TypeScript interfaces, Zod validation, and Prisma models with a single declarative syntax — plus Rip's native reactivity. ~420 lines.

```coffee
class User extends Model
  @table = 'users'
  @schema
    name:  { type: 'string', required: true }
    email: { type: 'email', unique: true }

user = User.find!(25)
user.name = 'Alice'
user.save!()
```

### [@rip-lang/swarm](swarm/) — Parallel Job Runner

Batch job engine with worker threads, real-time progress bars, automatic retries, and file-based task queues. Setup once, swarm many. ~330 lines.

```coffee
import { swarm, init, retry, todo } from '@rip-lang/swarm'

setup = ->
  unless retry()
    init()
    for i in [1..100] then todo(i)

perform = (task, ctx) ->
  await Bun.sleep(Math.random() * 1000)

swarm { setup, perform }
```

### [@rip-lang/csv](csv/) — CSV Parser + Writer

Fast, flexible CSV parser and writer with an indexOf ratchet engine. Auto-detects delimiters, quoting, escaping, BOM, and line endings. Supports headers, excel mode, relax mode, comments, and row-by-row streaming. ~300 lines.

```coffee
import { CSV } from '@rip-lang/csv'

rows = CSV.read "name,age\nAlice,30\nBob,25\n", headers: true
# [{name: 'Alice', age: '30'}, {name: 'Bob', age: '25'}]

CSV.save! 'out.csv', rows
```

### [@rip-lang/parser](parser/) — Parser Generator

SLR(1) parser generator for building DSLs. The same engine (`solar.rip`) that powers the Rip compiler itself, extracted as a standalone package. Coming soon.

### [@rip-lang/ui](ui/) — UI Components

Pre-built component library for building web applications with Rip's reactive system. Buttons, cards, modals, inputs, layout primitives, and theming via CSS custom properties. Early.
