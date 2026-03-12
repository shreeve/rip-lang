<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Stamp - @rip-lang/stamp

**Declarative host provisioning — no state file, no agent, no YAML.**

Stamp reads a Stampfile, resolves each directive to a handler, and
reconciles the declared state against reality. No state file to lose.
No agent to install. No YAML to wrestle. Just a blueprint and an engine.

```
stamp apply Hostfile
```

---

## Why Stamp?

- **No state file.** Every handler queries the live system. The Stampfile
  IS the source of truth. Running `stamp apply` twice is always safe.
- **Tiny directives.** Each handler is 30–50 lines of Rip. Three functions:
  `check`, `apply`, `verify`. No imports, no boilerplate.
- **Injection-safe by default.** Shell commands use `$"..."` tagged templates —
  interpolated values can never become shell code.
- **Pluggable.** Drop a `.rip` file in `directives/` and it just works.
  Community handlers are npm packages with three exported functions.
- **Cross-platform.** Works on macOS (Homebrew, Multipass) and Linux
  (apt-get, ZFS, Incus, systemd).

---

## Quick Start

```bash
stamp plan Hostfile       # preview what would change
stamp apply Hostfile      # make it so
stamp verify Hostfile     # audit current state
```

All three commands are read-safe. `plan` and `verify` never modify
anything. `apply` only changes what doesn't match.

---

## Stampfile Syntax

A Stampfile declares the desired state of a system. Each top-level entry
names a resource using a **directive**. Indented lines below it describe
properties. The file is read top to bottom — order IS the dependency order.

### Inline — one line, done

```
packages curl git jq zfsutils-linux
```

### Block — directive + properties

```
container web ubuntu/24.04
  profile trusted
  disk data /tank/web -> /data
  start
```

### Expanded — property with its own sub-block

```
container web ubuntu/24.04
  disk data
    source /tank/web
    path /data
    readonly true
```

### Variables

```
set POOL   tank
set DEVICE /dev/sdb

pool $POOL $DEVICE
  compression zstd
  atime off
  mountpoint /tank
```

Variables are expanded before parsing. `$NAME` and `${NAME}` both work.
Undefined variables expand to the empty string.

### The `->` operator

Source-to-destination mapping for disks, mounts, and similar:

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

This is syntactic sugar — `datasets` decomposes to individual `dataset`
calls before dispatching.

---

## Examples

### macOS: Create an Ubuntu VM with Multipass

```
brew multipass

multipass stamp 24.04
  cpus 2
  memory 4G
  disk 20G
  start

ensure unzip
  check multipass exec stamp -- which unzip
  apply multipass exec stamp -- sudo apt-get update -qq
  apply multipass exec stamp -- sudo apt-get install -y -qq unzip

ensure bun
  check multipass exec stamp -- test -x /home/ubuntu/.bun/bin/bun
  apply multipass exec stamp -- bash -lc "curl -fsSL https://bun.sh/install | bash"

ensure rip
  check multipass exec stamp -- test -x /home/ubuntu/.bun/bin/rip
  apply multipass exec stamp -- /home/ubuntu/.bun/bin/bun add -g rip-lang
```

One file installs Multipass, creates a VM, and bootstraps Bun + Rip
inside it. Run it again — everything shows `ok`, nothing changes.

### Linux: Provision an Incus + ZFS host

```
set POOL   tank
set DEVICE /dev/disk/by-id/scsi-0Linode_Volume_tank
set MOUNT  /tank

packages
  zfsutils-linux
  incus
  openssh-server
  fail2ban
  ufw

pool $POOL $DEVICE
  compression zstd
  atime off
  mountpoint $MOUNT

dataset $POOL/home
dataset $POOL/home/web
  owner 1000:1000

incus
  storage default zfs $POOL/incus/default
  network incusbr0

profile trusted
  security.privileged true
  limits.memory 2GB
  limits.cpu 2

container web ubuntu/24.04
  profile trusted
  disk home $MOUNT/home/web -> /home
  user shreeve 1000:1000
  start

firewall
  default deny incoming
  default allow outgoing
  allow ssh

service fail2ban

ssh
  password-auth no
  permit-root-login prohibit-password
  pubkey-auth yes
```

This replaces ~600 lines of bash scripts, preseed templates, and
numbered setup files with a single declarative file.

---

## Built-in Directives

| Directive   | Purpose                                | Platform |
|-------------|----------------------------------------|----------|
| `brew`      | Homebrew packages                      | macOS    |
| `packages`  | System packages (apt-get)              | Linux    |
| `ensure`    | Guarded imperative commands            | any      |
| `pool`      | ZFS pool creation                      | Linux    |
| `dataset`   | ZFS dataset with ownership/permissions | Linux    |
| `profile`   | Incus profile configuration            | Linux    |
| `container` | Incus container management             | Linux    |
| `incus`     | Incus daemon initialization            | Linux    |
| `multipass` | Multipass virtual machines             | macOS    |
| `user`      | System user management                 | Linux    |
| `group`     | System group management                | Linux    |
| `firewall`  | ufw firewall rules                     | Linux    |
| `ssh`       | SSH daemon configuration               | Linux    |
| `service`   | systemd service management             | Linux    |

---

## Writing a Directive

A directive is a `.rip` file that exports three functions. That's it.
No imports needed — `sh`, `ok`, and `run` are available globally.

```coffee
export name        = "mydirective"
export description = "What it does"

export check = (name, props) ->
  return 'missing' unless ok $"some-check #{name}"
  'ok'

export apply = (name, props) ->
  sh $"some-command #{name}"

export verify = (name, props) ->
  results = []
  if ok $"some-check #{name}"
    results.push { status: 'pass', message: "#{name} is good" }
  else
    results.push { status: 'fail', message: "#{name} is missing" }
  results
```

### Shell helpers

| Function     | Returns                          | Use case               |
|--------------|----------------------------------|------------------------|
| `sh $"cmd"`  | stdout string, throws on failure | Do the thing           |
| `ok $"cmd"`  | boolean                          | Does this exist?       |
| `run $"cmd"` | `{ ok, stdout, stderr, code }`   | Need the full picture  |
| `sh [array]` | stdout string, throws on failure | Dynamic argument lists |

The `$"..."` syntax prevents shell injection — interpolated values are
passed as separate arguments, never interpreted by a shell.

### Handler contract

- **check** has no side effects. Returns `"ok"`, `"drift"`, or `"missing"`.
- **apply** is idempotent. Only called when check returns something other
  than `"ok"`. The engine runs a post-apply re-check to confirm success.
- **verify** has no side effects. Returns `[{ status, message }]` results
  where status is `"pass"`, `"warn"`, or `"fail"`.

### Plugin resolution

Handlers resolve in this order:

1. **Built-in** — `directives/` in the stamp package
2. **Local** — `./directives/` beside the Stampfile
3. **Installed** — `~/.stamp/directives/`
4. **npm** — `@stamp/<name>` or `stamp-<name>`
5. **Remote** — fetched via `use` directive in the Stampfile

The first match wins. Drop a file in `./directives/` beside your
Stampfile to override any built-in.

---

## CLI

```
stamp apply [file]       Reconcile system to match Stampfile
stamp verify [file]      Check current state, report PASS/WARN/FAIL
stamp plan [file]        Dry-run: show what apply would do
stamp list               Show all available directives
stamp info <directive>   Show a directive's syntax and properties
stamp version            Print version
stamp help               Show help
```

Default file search: `Stampfile`, `Hostfile`, `Containerfile`.

### Exit codes

| Code | Meaning                                                         |
|------|-----------------------------------------------------------------|
| 0    | Success (apply completed, verify had no FAILs, plan found nothing) |
| 1    | Failure (apply error, verify had FAILs, plan found changes)    |
| 2    | Usage error (bad arguments, file not found)                    |

---

## Runtime

Bun + Rip. Zero dependencies beyond `rip-lang`. The entire engine —
parser, handler resolution, execution loop, and shell helpers — is
524 lines of Rip.

## License

MIT
