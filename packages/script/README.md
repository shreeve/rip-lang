<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip Script - @rip-lang/script

> **A homoiconic interaction engine — automate stateful conversations with remote systems using nested data structures**

Rip Script turns arrays of patterns and responses into fully automated
interactive sessions. It connects to a system via PTY, SSH, or TCP, then walks
a nested data structure — matching output, sending input, branching on patterns,
and recursing into sub-scripts. The data structure IS the program.

## Quick Start

```bash
bun add @rip-lang/script
```

```coffee
import Script from '@rip-lang/script'

chat = Script.spawn! 'bash'

result = chat! [
  "$ ", "echo hello"
  "hello", ""
]

chat.disconnect!
```

## What It Does

Rip Script sits between your code and an interactive system, driving a
conversation through a PTY, SSH connection, or TCP socket:

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Rip Script  │  chat!   │    Engine    │   PTY    │    Remote    │
│  (your code) │─────────▶│  (interpret) │◀────────▶│   (system)   │
└──────────────┘          └──────────────┘          └──────────────┘
                                │                          │
                           type-dispatch             interactive
                           on nested data            terminal I/O
```

You pass it an array. It processes each element by type:

- **Strings** alternate between *expect* (wait for this in output) and *send* (type this as input)
- **Regexes** match patterns in output with capture groups
- **Objects/Maps** branch on multiple possible prompts (first match wins)
- **Arrays** nest sub-scripts or execute conditionally
- **Functions** inject dynamic behavior — their return value becomes the next instruction
- **Symbols** control flow: `:redo`, `:skip`, `:else`, `:this`, `:pure`

## Connection Types

### PTY Spawn (Local Console)

Spawn a local process with a real pseudo-terminal:

```coffee
chat = Script.spawn! 'mumps -dir'           # MUMPS console
chat = Script.spawn! 'bash'                 # local shell
chat = Script.spawn! 'python3', ['-i']      # interactive Python
```

### SSH (Remote Systems)

Connect via SSH, using your `~/.ssh/config`, keys, and agent:

```coffee
chat = Script.ssh! 'admin@company.example.com'
chat = Script.ssh! 'ssh://user:pass@10.0.1.50:22'
chat = Script.ssh! 'user@host', slow: 30    # longer timeout for slow links
```

### TCP (Raw Socket)

For telnet-style connections:

```coffee
chat = Script.tcp! '10.0.1.50', 23
```

### Auto-Detect from URL

```coffee
chat = Script.connect! 'ssh://user@host:22'
chat = Script.connect! 'tcp://10.0.1.50:23'
chat = Script.connect! 'spawn:bash'
```

### Trace Mode (Dry Run)

Log what a script would do without connecting:

```coffee
chat = Script.trace()

chat! [
  ">", "D ^XUP"
  "Select OPTION:", "DG ADMIT PATIENT"
]

# Output:
# EXPECT: ">"
#   SEND: "D ^XUP"
# EXPECT: "Select OPTION:"
#   SEND: "DG ADMIT PATIENT"
```

## The Chat Engine

### Alternating Expect/Send

The simplest pattern — strings alternate between waiting and sending:

```coffee
chat! [
  ">",               "D ^XUP"               # wait for ">", send "D ^XUP"
  "Select OPTION:",  "DG ADMIT PATIENT"     # wait for prompt, send menu choice
  "Admit PATIENT:",  "SMITH,JOHN"           # wait for prompt, send patient name
]
```

### Regex Matching

Use regexes for flexible pattern matching with captures:

```coffee
result = chat! [
  ">", "W $ZV"
  /Version: (\d+\.\d+)/   # match and capture version number
]

version = chat.last   # "1.2" — the first capture group
```

### Object Multiplexing (Branching)

Objects try each key against the output buffer — first match wins:

```coffee
chat! [
  "Enter name:", "SMITH,JOHN"
  {
    "SURE YOU WANT TO ADD":    ["Y"]        # if confirmation, say yes
    "Select ADMISSION DATE:":  [""]         # if date prompt, press enter
    "Do you want to continue": ["C"]        # if continue prompt, continue
  }
]
```

### Map Literal Multiplexing

When you need regex keys or mixed key types, use a map literal (`*{ }`):

```coffee
chat! [
  "Enter name:", "SMITH,JOHN"
  *{
    /^NAME:/: [""]                           # regex key
    "CHOOSE 1": [1]                          # string key
    :else: null                              # fallback — nothing matched
  }
]
```

### Conditional Arrays

Arrays with a boolean first element execute conditionally:

```coffee
chat! [
  "DIVISION:", data.division
  [data.hasBeds                             # only if hasBeds is true
    "NUMBER OF BEDS:", data.beds
    "SERIOUSLY ILL:", "N"
  ]
  "Select WARD:", ""
]
```

### Sub-Scripts

Arrays without a boolean first element are nested sub-scripts:

```coffee
chat! [
  "Select OPTION:", "EDIT"
  [                                         # nested conversation
    "FIELD:", "NAME"
    "FIELD:", "TITLE"
    "FIELD:", ""
  ]
  "Select OPTION:", ""
]
```

### Function Callbacks

Functions inject dynamic behavior. Their return value becomes the next item:

```coffee
chat! [
  "Select KEY:", ->
    for key in keys
      chat! [
        "Select KEY:", key
        { "KEY:": [""], "REVIEW DATE:": "" }
      ]
    true                                    # continue to next item

  "Select KEY:", ""
]
```

Functions receive the last matched value:

```coffee
chat! [
  /Version: (\S+)/, (fullMatch, version) ->
    p "Running version #{version}"
    true
]
```

### Return Values

`chat!` returns the last matched value — use it to extract data:

```coffee
pair = chat! [
  ">", "D GETENV^%ZOSV W Y"
  /\n([^\n]+)\n/
]

systemInfo = pair[1]                        # the captured group
```

### Control Flow Symbols

Rip symbol literals (`:name`) control the engine's behavior. No imports needed —
they're interned values available everywhere:

| Symbol | Purpose |
|--------|---------|
| `:redo` | Re-enter the current multiplexer (after reading more data) |
| `:skip` | Skip the current item, continue to next |
| `:else` | Fallback key in multiplexers — fires when no other key matches |
| `:this` | In a multiplexer value, return the matched text itself |
| `:pure` | Raw mode — no line terminator, no ANSI stripping |

```coffee
# :skip — bail out of a script early
chat! [
  "prompt>", "command"
  "result:", -> :skip                       # stop processing this list
]

# :else — fallback when no key matches in a multiplexer
*{
  /^NAME:/: [""]
  "CHOOSE 1": [1]
  :else: null                               # default handler
}

# :pure — send raw bytes without line terminator
chat! [
  "prompt>", "command"
  "Hint:", [:pure, "\x1b0"]                 # raw escape sequence
]
```

## Helper Functions

### Map Literals (`*{ }`) — Mixed-Key Multiplexers

Use map literals for multiplexers with regex keys or mixed key types:

```coffee
*{
  /^NAME:/: [""]
  "CHOOSE 1": [1]
  :else: null
}
```

Map literals compile to `new Map(...)` and support all key types: strings,
regexes, numbers, booleans, symbols, and expressions via `(expr)`.
Spread (`...expr`) merges entries from other Maps or iterables:

```coffee
*{ "Are you adding": ["Y"], ...extra }
```

### `replace(value)` — Replace/Edit Handler

Handle a "Replace ... With ..." editing pattern:

```coffee
chat! [
  "OUTPATIENT EXPANSION:", replace(data.description)
]
```

### `quote(value)` — Exact Match

Wrap in double quotes for forced exact matching:

```coffee
chat! [
  "Select DRUG:", quote(data.drugName)
]
```

### `prompts(obj)` — Prompt/Response Sugar

Shorthand for common prompt-response objects:

```coffee
chat! [
  prompts
    "Select KEY:":   [key]
    "  KEY:":        [""]
    "REVIEW DATE:":  ""
]
```

### `enter(value, extra)` — Add-If-New Handler

Handle entries that may trigger "Are you adding?" confirmation:

```coffee
chat! [
  "Select WARD:", enter(data.ward)
]
```

## Connection Options

All connection factories accept options:

```coffee
chat = Script.ssh! 'user@host',
  live: true       # print received data to stdout (default: true)
  echo: false      # print sent data to stdout (default: false)
  show: false      # print matched data to stdout (default: false)
  slow: 10         # timeout in seconds waiting for output (default: 10)
  fast: 0.25       # timeout in seconds for "is there more?" (default: 0.25)
  bomb: true       # throw on timeout (default: true)
  line: "\r"       # line terminator appended to sends (default: "\r")
  ansi: false      # keep ANSI escapes (default: false = strip them)
  nocr: true       # strip \r characters (default: true)
  wait: null       # [min, max] random delay in seconds before sends
  auth: [...]      # initial authentication script to run on connect
  init: [...]      # initialization script to run after auth
  onSend:  null    # (text) -> hook called after each send
  onRecv:  null    # (data) -> hook called after each read
  onMatch: null    # (pattern, matched) -> hook called after each match
```

## Options Reference

| Option | Default | Description |
|--------|---------|-------------|
| `live` | `true`  | Print received data to stdout in real time |
| `echo` | `false` | Print sent data to stdout |
| `show` | `false` | Print matched/consumed text to stdout |
| `slow` | `10`    | Seconds to wait before timeout |
| `fast` | `0.25`  | Seconds for "is there more data?" check |
| `bomb` | `true`  | Throw on timeout (false = return silently) |
| `line` | `"\r"`  | Line terminator appended to every send |
| `ansi` | `false` | Keep ANSI escape sequences (false = strip) |
| `nocr` | `true`  | Strip carriage returns from received data |
| `wait` | `null`  | `[min, max]` random delay before sends (seconds) |
| `auth` | `null`  | Script array to run on connect (authentication) |
| `init` | `null`  | Script array to run after auth (initialization) |

## Type Dispatch Reference

| Type | Role | Behavior |
|------|------|----------|
| `String` / `Number` | Match or Send | Listen mode: wait for string in output. Talk mode: send to system. |
| `RegExp` | Pattern Match | Match against output buffer, captures available. |
| `null` | Mode Toggle | Flip between listen and talk modes. |
| `true` | Continue | No-op pass-through. |
| `false` / `Symbol` | Control Signal | `:redo`, `:skip`, etc. — flow control. |
| `Object` | Multiplexer | Try each string key against buffer. First match wins. |
| `Map` | Multiplexer | Like Object but supports regex keys. Use `*{ }` map literals. |
| `Array` | Sub-script | Nest a conversation. Boolean first element = conditional. |
| `Function` | Callback | Execute, return value becomes next item to process. |

## How It Works

Rip Script is built from a single file:

| File | Role |
|------|------|
| `script.rip` | Transports (Spawn, TCP, Trace), Engine (chat interpreter), Script (factory), helpers |

The engine is a recursive type-dispatching interpreter. It maintains a buffer of
received data and alternates between two modes: **listen** (searching the buffer
for patterns) and **talk** (sending responses). Each element in the script array
is dispatched by its JavaScript type — strings, regexes, objects, arrays, and
functions each have fixed, well-defined roles. This makes the data structure
simultaneously readable by humans and executable by the engine.

The `chat!` callable is an async function with utility methods attached.
`Script.ssh!` et al. create a transport, wrap it in an engine, and return
the callable — so the variable name itself becomes the verb.

## Requirements

- **Bun** 1.3.5+ (for native PTY support via `Bun.Terminal`)
- **rip-lang** 3.x (installed automatically as a dependency)
- **ssh** binary on PATH (for SSH connections)

## License

MIT
