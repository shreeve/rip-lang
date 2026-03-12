# Stamp

Declarative host provisioning — no state file, no agent, no YAML.

Stamp reads a Stampfile, resolves each directive to a handler, and reconciles
the declared state against reality using three operations: **check**, **apply**,
and **verify**.

```
stamp apply Hostfile
```

## Quick Start

```bash
# Preview changes (read-only)
stamp plan Hostfile

# Apply the declared state
stamp apply Hostfile

# Audit current state
stamp verify Hostfile
```

## Stampfile Syntax

A Stampfile declares the desired state of a system. Each top-level entry
names a resource using a **directive**. Indented lines below it describe
properties.

```
packages curl git jq zfsutils-linux

pool tank /dev/sdb
  compression zstd
  atime off

container web ubuntu/24.04
  profile trusted
  disk data /tank/web -> /data
  start

firewall
  default deny incoming
  default allow outgoing
  allow ssh
  allow 443/tcp
```

### Three levels of expression

- **Inline** — single line: `packages curl git jq`
- **Block** — directive + indented properties
- **Expanded** — property with its own nested sub-block

### Variables

```
set POOL   tank
set DEVICE /dev/sdb

pool $POOL $DEVICE
```

### The `->` operator

Source-to-destination mapping:

```
disk data /tank/web -> /data
disk logs /tank/logs -> /var/log readonly
```

### Grouped directives

Plural forms expand to individual directives:

```
datasets
  tank/home
  tank/shared
    owner 1001:1001
    mode 2775
```

## Built-in Directives

| Directive | Purpose |
|-----------|---------|
| `packages` | System packages (apt-get) |
| `pool` | ZFS pool creation |
| `dataset` | ZFS dataset with ownership/permissions |
| `profile` | Incus profile configuration |
| `container` | Incus container management |
| `incus` | Incus daemon initialization |
| `user` | System user management |
| `group` | System group management |
| `firewall` | ufw firewall rules |
| `ssh` | SSH daemon configuration |
| `service` | systemd service management |

## Handler Contract

Every directive handler exports three async functions:

- **check(name, props)** — returns `"ok"`, `"drift"`, or `"missing"`
- **apply(name, props)** — make reality match the declaration
- **verify(name, props)** — return `[{ status, message }]` results

## Plugin System

Handlers resolve in this order:

1. Built-in (`directives/`)
2. Local (`./directives/` beside Stampfile)
3. Installed (`~/.stamp/directives/`)
4. npm (`@stamp/<name>` or `stamp-<name>`)
5. Remote (via `use` directive)

### Writing a directive

```coffee
import { sh!, sh? } from "@rip-lang/stamp/helpers"

export name        = "mydirective"
export description = "What it does"

export check = (name, props) ->
  return 'missing' unless sh? "some-check"
  'ok'

export apply = (name, props) ->
  sh! "some-command"

export verify = (name, props) ->
  [{ status: 'pass', message: 'looks good' }]
```

## CLI

```
stamp apply [file]           Reconcile system to match Stampfile
stamp verify [file]          Check current state, report PASS/WARN/FAIL
stamp plan [file]            Dry-run: show what apply would do
stamp list                   Show all available directives
stamp info <directive>       Show a directive's syntax and properties
stamp version                Print version
stamp help                   Show help
```

Default file search: `Stampfile`, `Hostfile`, `Containerfile`.

## Runtime

Bun + Rip. Zero dependencies beyond `rip-lang`.

## License

MIT
