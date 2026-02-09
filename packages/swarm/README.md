<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/rip.png" style="width:50px" /> <br>

# Rip Swarm - @rip-lang/swarm

> **Parallel job runner with worker threads — setup once, swarm many**

Swarm is a high-performance batch job engine for Rip. Give it a list of
tasks and a function to process each one, and it fans out across worker
threads with real-time progress bars, automatic retries, and a clean
summary when done. No database, no message broker, no dependencies —
just files, threads, and message passing.

## Why This Approach?

Most job queues add complexity: Redis, RabbitMQ, database-backed queues,
distributed locks. Swarm takes the opposite approach:

- **Tasks are files.** A directory listing *is* the queue. You can
  inspect, add, or remove tasks with basic shell commands.
- **State is a file move.** `todo/ → done/` is one atomic `rename`.
  No transactions, no eventual consistency. If the process crashes,
  unfinished tasks are still in `todo/` — restart and pick up where
  you left off.
- **Workers are threads.** Setup runs once in the main thread, context
  is cloned to N workers via message passing. No shared mutable state,
  no locks, no deadlocks.
- **Progress is real-time.** The main thread owns the terminal — ANSI
  progress bars update live with per-worker stats. Workers never touch
  stdout.

The result: ~330 lines of Rip, zero dependencies, and it handles
thousands of tasks reliably. Boring infrastructure, rock solid.

## Quick Start

```bash
bun add @rip-lang/swarm        # add to your project
```

Create a job script:

```coffee
import { swarm, init, retry, todo } from '@rip-lang/swarm'

setup = ->
  unless retry()
    init()
    for i in [1..100] then todo(i)
  { startedAt: Date.now() }

perform = (task, ctx) ->
  await Bun.sleep(Math.random() * 1000)
  throw new Error("boom") if Math.random() < 0.03

swarm { setup, perform }
```

Run it:

```bash
rip jobs.rip                # workers default to CPU count
rip jobs.rip -w 10          # 10 workers
rip jobs.rip -w 40          # 40 workers for I/O-heavy jobs
```

## How It Works

```
┌──────────────────────────────────────────────────┐
│                Single Bun Process                │
│                                                  │
│  Main Thread              Worker Threads (N)     │
│  ──────────              ──────────────────      │
│  setup() runs once        each loads your script │
│  creates .swarm/todo/*    receives tasks via IPC │
│  dispatches tasks         calls perform(task)    │
│  renders progress bars    reports done/failed    │
│  moves files atomically   stays alive for more   │
│                                                  │
│  .swarm/todo/42 ──rename──→ .swarm/done/42       │
│                 ──rename──→ .swarm/died/42       │
└──────────────────────────────────────────────────┘
```

1. **`setup()`** runs once in the main thread — creates task files and
   returns an optional context object (auth tokens, config, paths)
2. **N worker threads** are spawned — each loads your script and gets
   the `perform` function. Workers are long-lived and process many tasks
3. Tasks are dispatched from `.swarm/todo/` to workers via message passing
4. Workers call `perform(task, ctx)` — on success the file moves to
   `done/`, on failure it moves to `died/`
5. ANSI progress bars update live — per-worker throughput and overall
   completion. When done, per-worker stats are shown
6. If tasks died, just run it again — `retry()` moves them back to
   `todo/` and only those tasks are reprocessed

## Task Lifecycle

```
.swarm/
├── todo/       ← tasks waiting to be processed
├── done/       ← completed successfully
└── died/       ← failed (retryable)
```

Tasks are plain files. The filename identifies the task (e.g., `000315`,
`2024-01-15`, `amazon.json`). Files can be empty (filename is the data)
or contain a payload that `perform` reads. File moves use `renameSync`
— atomic on the same filesystem, no partial states.

## API

### Task Queue

```coffee
import { init, retry, todo } from '@rip-lang/swarm'

init()               # Remove old .swarm, create todo/done/died dirs
retry()              # Move .swarm/died/* back to .swarm/todo/ for retry
todo('task-1')       # Create empty task file
todo('task-2', data) # Create task file with data (string or JSON)
```

### swarm()

```coffee
swarm { setup, perform }
swarm { setup, perform, workers: 8, bar: 30, char: '█' }
```

| Option | Description | Default |
|--------|-------------|---------|
| **setup** | Runs once in main thread, returns optional context | — |
| **perform** | `(taskPath, ctx)` — runs in worker threads | required |
| **workers** | Number of worker threads | CPU count |
| **bar** | Progress bar width in characters | 20 |
| **char** | Character for progress bars | `•` |

### CLI Flags

```
-w, --workers <n>     Number of workers (default: CPU count)
-b, --bar <width>     Progress bar width (default: 20)
-c, --char <ch>       Bar character (default: •)
-r, --reset           Remove .swarm directory and quit
```

CLI flags override options passed to `swarm()`.

### args()

Swarm also exports `args()` which returns `process.argv` with all
swarm flags stripped — only your script's positional arguments remain:

```coffee
import { swarm, args } from '@rip-lang/swarm'

inputFile = args()[0]    # first non-swarm argument
```

## Crash Recovery

| Failure | What Happens | Recovery |
|---------|-------------|----------|
| `perform()` throws | Worker catches it, reports failed, picks up next task | Automatic |
| Unhandled rejection | Worker error handler fires, continues | Automatic |
| Worker thread dies | Main thread detects exit, respawns worker | Automatic |
| Process killed (Ctrl+C) | Unfinished tasks remain in `todo/`, cursor restored | Re-run to continue |

Failed tasks land in `.swarm/died/`. Call `retry()` in your next
`setup()` to move them back for reprocessing — only the failed tasks
run, not the entire batch.

## Real-World Example

Downloading 15,000 lab test definitions from an API with 40 workers:

```coffee
import { swarm, args, init, retry, todo } from '@rip-lang/swarm'
import { isMainThread } from 'worker_threads'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

TESTS_FILE = null
if isMainThread
  TESTS_FILE = args()[0]

setup = ->
  unless retry()
    init()
    lines = readFileSync(TESTS_FILE, 'utf-8').trim().split('\n')
    for code in lines then todo(code.trim()) if code.trim()
  outDir = resolve('../data/tests')
  mkdirSync(outDir, { recursive: true })
  auth = readFileSync(resolve('.auth'), 'utf-8')
  xibm = auth.match(/^X-IBM-Client-Id=(.*)$/m)?[1]
  cook = auth.match(/^lch-authorization_ACC=.*$/m)?[0]
  { xibm, cook, outDir }

perform = (task, ctx) ->
  code = task.split('/').pop()
  return if existsSync(join(ctx.outDir, "#{code}.json"))
  resp = await fetch "https://api.example.com/tests/#{code}",
    method: 'POST'
    headers: { 'Cookie': ctx.cook }
    body: JSON.stringify { testCode: code }
  throw new Error("HTTP #{resp.status}") unless resp.ok
  await Bun.write(join(ctx.outDir, "#{code}.json"), await resp.text())

swarm { setup, perform }
```

```bash
rip download-tests.rip tests.txt -w 40
# 15,000 tests across 40 workers — finishes in minutes
```
