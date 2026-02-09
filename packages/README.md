<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Packages

> **Optional packages that extend Rip for full-stack development**

All packages are written in Rip, have zero dependencies, and run on Bun.

## Installation

```bash
bun add rip-lang                 # Core language (required)
bun add @rip-lang/api            # Web framework
bun add @rip-lang/ui             # Reactive web UI framework
bun add @rip-lang/server         # Process manager
bun add @rip-lang/db             # DuckDB server
bun add @rip-lang/schema         # ORM + validation
bun add @rip-lang/swarm          # Parallel job runner
bun add @rip-lang/csv            # CSV parser + writer

# VS Code / Cursor extension (install from Marketplace)
# Search "Rip" in Extensions, or:
cursor --install-extension rip-lang.rip
```

---

## Packages

### [@rip-lang/api](api/) — Web Framework

Hono-compatible web framework with Sinatra-style routing, AsyncLocalStorage context, built-in validators, file serving (`@send`), and smart response handling. ~640 lines.

```coffee
import { get, post, start } from '@rip-lang/api'

get '/', -> { message: 'Hello, Rip!' }
get '/users/:id', -> User.find!(read 'id')
get '/css/*', -> @send "public/#{@req.path.slice(5)}"

start port: 3000
```

### [@rip-lang/server](server/) — Process Manager

Multi-worker process manager with hot reloading, automatic HTTPS, mDNS service discovery, and request queueing. Serves Rip UI apps with SSE hot-reload out of the box. ~1,210 lines.

```bash
rip-server -w                    # Start with workers + hot-reload
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

### [@rip-lang/ui](ui/) — Reactive Web Framework

Zero-build reactive web framework. Ships the 40KB Rip compiler to the browser, compiles `.rip` components on demand, and renders with fine-grained DOM updates. Includes a Virtual File System, file-based router, reactive stash, server middleware (`ripUI`), and SSE hot-reload. ~1,300 lines.

```coffee
import { get, use, start, notFound } from '@rip-lang/api'
import { ripUI } from '@rip-lang/ui/serve'

dir = import.meta.dir

use ripUI pages: "#{dir}/pages", watch: true

get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"

notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'

start port: 3000
```

### [rip](vscode/) — VS Code / Cursor Extension

IDE support with syntax highlighting, auto `.d.ts` generation on save, and type intelligence (autocomplete, hover, go-to-definition) from third-party TypeScript types. Published to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip).

```bash
# Install from Marketplace
cursor --install-extension rip-lang.rip

# Or install locally from source
cd packages/vscode
npx @vscode/vsce package --no-dependencies
cursor --install-extension rip-0.3.1.vsix --force
```
