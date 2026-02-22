<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Packages

> **Optional packages that extend Rip for full-stack development**

All packages are written in Rip, run on Bun, and have zero dependencies (except `@rip-lang/print` which uses `highlight.js`).

## Installation

```bash
bun add rip-lang                 # Core language (required)
bun add @rip-lang/api            # Web framework
bun add @rip-lang/csv            # CSV parser + writer
bun add @rip-lang/db             # DuckDB server
bun add @rip-lang/print          # Syntax-highlighted code printer
bun add @rip-lang/server         # Production server
bun add @rip-lang/swarm          # Parallel job runner
bun add @rip-lang/grid           # Reactive data grid
bun add @rip-lang/x12            # X12 EDI parser + query engine

# VS Code / Cursor extension
cursor --install-extension rip-lang.rip
```

---

## Packages

### [@rip-lang/api](api/) — Web Framework

Hono-compatible web framework with Sinatra-style routing, AsyncLocalStorage context, 37 built-in validators, file serving (`@send`), and smart response handling. ~650 lines.

```coffee
import { get, post, read, start } from '@rip-lang/api'

get '/', -> { message: 'Hello, Rip!' }
get '/users/:id', -> User.find!(read 'id', 'id!')
get '/css/*', -> @send "public/#{@req.path.slice(5)}"

post '/signup' ->
  email = read 'email', 'email!'
  name = read 'name', 'string!'
  { success: true, email, name }

start port: 3000
```

### [@rip-lang/csv](csv/) — CSV Parser + Writer

Fast, flexible CSV parser and writer with an indexOf ratchet engine. Auto-detects delimiters, quoting, escaping, BOM, and line endings. Supports headers, excel mode, relax mode, comments, and row-by-row streaming. ~430 lines.

```coffee
import { CSV } from '@rip-lang/csv'

rows = CSV.read "name,age\nAlice,30\nBob,25\n", headers: true
# [{name: 'Alice', age: '30'}, {name: 'Bob', age: '25'}]

CSV.save! 'out.csv', rows
```

### [@rip-lang/db](db/) — DuckDB Server

HTTP server for DuckDB queries with JSONCompact responses, parameterized queries, and the official DuckDB UI built in. Pure Bun FFI, no native build step. ~390 lines.

```bash
rip-db mydata.duckdb --port=4000
```

### [@rip-lang/print](print/) — Syntax-Highlighted Code Printer

Highlights source code using highlight.js and serves the result in the browser for viewing and printing. 14 themes (7 light, 7 dark), line numbers, native Rip highlighting, sticky theme selection, and print-optimized CSS. Serves once and exits. ~450 lines.

```bash
rip-print src/                   # Print all source files
rip-print -d packages/api/      # Dark theme
rip-print file.rip file.js      # Specific files
```

### [@rip-lang/server](server/) — Production Server

Multi-worker process manager with hot reloading, automatic HTTPS, mDNS service discovery, and request queueing. Serves Rip UI apps with SSE hot-reload out of the box. ~1,210 lines.

```bash
rip-server -w                    # Start with file watching + hot-reload
rip-server myapp                 # Named (accessible at myapp.local)
```

### [@rip-lang/swarm](swarm/) — Parallel Job Runner

Batch job engine with worker threads, real-time progress bars, automatic retries, and file-based task queues. Setup once, swarm many. ~380 lines.

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

### Rip UI (built into rip-lang) — Reactive Web Framework

Zero-build reactive web framework. The browser loads `rip.min.js` (compiler + UI framework), fetches an app bundle, and renders with fine-grained DOM updates. Includes file-based router (path + hash modes), reactive stash, component store, server middleware (`ripApp`), SSE hot-reload, and `launch bundle:` for self-contained static deployment.

```coffee
import { get, use, start, notFound } from '@rip-lang/api'
import { ripApp } from '@rip-lang/api/app'

dir = import.meta.dir
use ripApp dir: dir, components: 'routes', includes: ['ui'], watch: true, title: 'My App'
get '/css/*', -> @send "#{dir}/css/#{@req.path.slice(5)}"
notFound -> @send "#{dir}/index.html", 'text/html; charset=UTF-8'
start port: 3000
```

### [@rip-lang/x12](x12/) — X12 EDI Parser

X12 EDI parser, editor, and query engine for healthcare transactions (270/271, 835, 837, etc.). Path-based addressing (`seg(num)-fld(rep).com`), auto-detected separators, get/set/find/show, and a full CLI. ~690 lines.

```coffee
import { X12 } from '@rip-lang/x12'

x12 = new X12 rawString
sender = x12.get "ISA-6"
name = x12.get "NM1(3)-3"
[a, b] = x12.find "ISA-6", "ISA-8"
x12.show 'down', 'full'
```

```bash
rip-x12 -f message.x12          # Show fields
rip-x12 -q "ISA-6,GS-2" *.x12  # Query values
rip-x12 -d -f /path/to/edi/     # Recursive scan
```

### [rip](vscode/) — VS Code / Cursor Extension

IDE support with syntax highlighting, auto `.d.ts` generation on save, and type intelligence (autocomplete, hover, go-to-definition) from third-party TypeScript types. Published to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rip-lang.rip).

```bash
cursor --install-extension rip-lang.rip
```
