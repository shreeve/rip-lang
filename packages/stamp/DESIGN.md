# Stamp

Declarative host provisioning with pluggable directives.

Stamp reads a Stampfile, resolves each directive to a handler, and reconciles
the declared state against reality using three operations: **check**, **apply**,
and **verify**. No state file. No agent. No YAML. Just a blueprint and an
engine.

```
stamp apply Hostfile
```

---

## Table of Contents

1. [Design principles](#design-principles)
2. [Core concepts](#core-concepts)
3. [Stampfile grammar](#stampfile-grammar)
4. [Handler contract](#handler-contract)
5. [Built-in directives](#built-in-directives)
6. [Plugin system](#plugin-system)
7. [Engine algorithm](#engine-algorithm)
8. [CLI interface](#cli-interface)
9. [Implementation notes](#implementation-notes)
10. [Complete example: Incus host](#complete-example-incus-host)

---

## Design Principles

Three rules govern the Stampfile syntax:

**1. If a field is required and obvious, make it positional.**

```
container web ubuntu/24.04
```

Not:

```
container web
  image ubuntu/24.04
```

**2. If a field is optional or complex, put it in the block.**

```
container web ubuntu/24.04
  profile trusted
  disk data /tank/web -> /data
  start
```

**3. Simple things stay short, complex things stay possible.**

Stamp supports three levels of expression:

- **Inline** — single line, positional args only: `packages curl git jq`
- **Block** — directive line + indented properties: `container web ubuntu/24.04` with body
- **Expanded** — a property with its own nested sub-block for complex cases

The three levels in action:

```
# inline — one line, done
packages curl git jq

# block — directive + properties
container web ubuntu/24.04
  profile trusted
  disk data /tank/web -> /data
  start

# expanded — property with sub-block when it needs multiple fields
container web ubuntu/24.04
  disk data
    source /tank/web
    path /data
    readonly true
    shift 1000:1000
```

Most directives never need the expanded form. It exists so the language
can grow without hitting a wall.

### Syntax anti-patterns

The Stampfile format is deliberately constrained. These styles are
explicitly **not** goals:

**Too English-like.** Reads well for one line, becomes verbose and hard to
parse at scale:

```
create container web from ubuntu/24.04 with profile trusted
```

**Too programmatic.** Turns the blueprint into a function call. Loses the
declarative feel:

```
container("web", image="ubuntu/24.04", profile="trusted")
```

**Too tabular.** Compact but opaque unless you memorize positional fields:

```
dataset tank/incus root:incus-admin 775
dataset tank/app   trust:trust      775
```

The Stampfile is not shell, not YAML, not HCL, not Dockerfile. It is its
own thing: short declarative sentences with indented details.

---

## Core Concepts

### The Stampfile

A Stampfile is a plain text file that declares the desired state of a system.
Each top-level entry names a resource using a **directive**. Indented lines
below it describe properties of that resource.

```
packages curl git jq zfsutils-linux

pool tank /dev/sdb

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

The file is read top to bottom. Each directive is dispatched to a handler.
The handler checks whether reality matches the declaration and acts if it
does not.

The conventional filename is `Hostfile` for host provisioning. Stamp also
recognizes `Stampfile` and `Containerfile` as defaults.

### Directives

A directive is a named resource type. `packages`, `pool`, `container`,
`firewall` — each one maps to a handler that knows how to manage that
specific kind of resource.

Directives come in three tiers:

1. **Built-in** — ships with stamp (brew, packages, ensure, pool, dataset,
   profile, container, incus, multipass, user, group, firewall, ssh, service)
2. **Installed** — community or private handlers installed via npm
   (`stamp install @stamp/postgres`)
3. **Remote** — fetched from a URL at runtime, declared in the Stampfile
   with `use`

### The handler contract

Every directive handler exports three async functions:

- **check** — is reality already correct? Returns `ok`, `drift`, or
  `missing`. No side effects.
- **apply** — make reality match the declaration. Idempotent. Only called
  when check returns something other than `ok`.
- **verify** — produce human-readable PASS/WARN/FAIL results about current
  state. No side effects.

This is the entire interface. Any module that exports these three functions
is a valid directive handler.

### No state file

Stamp does not maintain a state file. Every handler's `check` function
queries the live system directly. The Stampfile IS the source of truth.
There is no `.tfstate` to lose, corrupt, or conflict on. Running
`stamp apply` twice in a row is always safe — the second run finds
everything already in the desired state and makes no changes.

---

## Stampfile Grammar

### Encoding and whitespace

- UTF-8 plain text
- Lines separated by `\n` or `\r\n`
- Trailing whitespace on any line is ignored
- Indentation: **spaces only** (tabs are a parse error)
- Indentation width is flexible but must be consistent within a block

### Comments

Lines whose first non-whitespace character is `#` are comments. They are
stripped before parsing. Inline comments (mid-line `#`) are **not**
supported — `#` appearing after the first token on a line is a literal
character.

```
# This is a comment
packages curl git jq

  # This is also a comment (indented)
```

### Variables

Variables are referenced as `$NAME` or `${NAME}` and expanded at parse
time. Two sources, checked in order:

1. **Stampfile `set` lines** (highest priority)
2. **Environment variables** (fallback)

Undefined variables expand to the empty string. Variable expansion happens
before any directive parsing, so expanded values are indistinguishable
from literal text.

```
set POOL   tank
set DEVICE /dev/sdb

pool $POOL $DEVICE
```

`set` lines are processed top-to-bottom. A later `set` overrides an
earlier one for the same name. `set` does not create resources — it only
defines substitution values.

### Top-level directives

A top-level directive begins at column 0 (no leading whitespace). It
consists of a directive name followed by zero or more positional arguments.

```
DIRECTIVE [ARG...]
```

Each directive type defines how many positional arguments it expects:

| Directive | Positional args | Example |
|-----------|----------------|---------|
| `brew` | `<name>...` (variadic) | `brew multipass` |
| `packages` | `<name>...` (variadic) | `packages curl git jq` |
| `ensure` | `<name>` | `ensure bun` |
| `pool` | `<name> <device>` | `pool tank /dev/sdb` |
| `dataset` | `<path>` | `dataset tank/home` |
| `profile` | `<name>` | `profile trusted` |
| `container` | `<name> <image>` | `container web images:ubuntu/24.04` |
| `incus` | (none) | `incus` |
| `multipass` | `<name> <image>` | `multipass stamp 24.04` |
| `user` | `<name> <uid>:<gid>` | `user shreeve 1000:1000` |
| `group` | `<name> <gid>` | `group jail 1002` |
| `firewall` | (none) | `firewall` |
| `ssh` | (none) | `ssh` |
| `service` | `<name>` | `service fail2ban` |

### Block properties

Lines indented deeper than the directive line are properties of that
directive. Each property line begins with a property name followed by
zero or more arguments.

```
DIRECTIVE [ARG...]
  PROPERTY [ARG...]
  PROPERTY [ARG...]
```

A blank line or a new line at column 0 ends the block.

Properties are **context-dependent**: `profile` inside a `container` block
means "attach this profile to the container," while `profile` at the top
level means "define an Incus profile." The directive handler receives its
properties and interprets them.

Properties that appear multiple times produce an array in the parsed
output. This is how a container gets multiple disks or users:

```
container web ubuntu/24.04
  disk data /tank/web -> /data
  disk logs /tank/logs -> /var/log
  user shreeve 1000:1000
  user trust 1001:1001
```

### The `->` operator

Inside property lines, `->` denotes a source-to-destination mapping:

```
disk data /tank/web -> /data
disk logs /tank/web/logs -> /var/log/app readonly
```

The parser splits on `->`:
- Everything before `->` (after the property name): **source**
- The first token after `->`: **destination**
- Remaining tokens after destination: **flags** (e.g., `readonly`)

### The `use` directive

`use` imports a directive handler from an external source. It must appear
before any directive that depends on it.

```
use @stamp/postgres
use https://example.com/directives/caddy.rip

postgres main
  version 16
  data /tank/db/main

caddy proxy
  domain example.com
  upstream localhost:3000
```

`use` with an npm package name resolves from `node_modules`. `use` with a
URL fetches the module and caches it locally in `~/.stamp/cache/`. Both
make the directive name available for the rest of the file.

### Expanded properties (sub-blocks)

A property can have its own indented block for complex cases. The property
line starts a sub-block; lines indented further are sub-properties:

```
container web ubuntu/24.04
  disk data
    source /tank/web
    path /data
    readonly true
```

This is equivalent to the inline `disk data /tank/web -> /data readonly`
form. Use expanded properties only when a property has enough fields to
benefit from named sub-properties. The handler receives sub-properties
as a nested object.

### Block-as-list pattern

Some directives interpret their block as a simple list rather than
key-value properties. The `packages` directive is the primary example:

```
packages
  curl
  git jq
  zfsutils-linux
  incus qemu-utils
```

Each indented line is parsed as a property. Multiple tokens on one line
are multiple items — `git jq` installs both `git` and `jq`. The handler
flattens all property names and args into a single package list.

The inline form and block form are equivalent:

```
packages curl git jq zfsutils-linux incus qemu-utils
```

The block form is preferred when the list is long, because it allows
grouping related packages by line for readability.

### Grouped directives (plural sugar)

For directives that commonly repeat, a plural form groups multiple
resources under one header:

```
datasets
  tank/incus
  tank/home
    owner 1000:1000
  tank/shared
    owner 1001:1001
    mode 2775
```

This is syntactic sugar. The engine expands it to individual `dataset`
directives before dispatching to handlers. Internally, `datasets` is
never a handler — it decomposes to `dataset` calls.

Plural forms are supported for: `datasets`, `containers`, `users`,
`groups`, `services`. The parser recognizes the plural name, strips the
trailing `s`, and dispatches each entry to the singular handler.

The singular form is always available and is the canonical representation.
Plural forms are a convenience for humans, not a separate concept.

### Formal grammar

```
stampfile    = line*
line         = comment | set_line | use_line | directive | blank
blank        = NEWLINE
comment      = WS? '#' TEXT NEWLINE

set_line     = 'set' WS NAME WS VALUE NEWLINE
use_line     = 'use' WS SOURCE NEWLINE

directive    = NAME (WS ARG)* NEWLINE block?
block        = entry+
entry        = property | grouped_item
property     = INDENT NAME (WS ARG)* NEWLINE sub_block?
sub_block    = sub_prop+
sub_prop     = INDENT2 NAME (WS ARG)* NEWLINE
grouped_item = INDENT NAME (WS ARG)* NEWLINE block?

ARG          = WORD | STRING | ARROW_EXPR
ARROW_EXPR   = WORD WS '->' WS WORD (WS WORD)*
STRING       = '"' [^"]* '"' | "'" [^']* "'"
WORD         = [^ \t\n"']+
NAME         = [a-zA-Z_./][a-zA-Z0-9_./-]*
WS           = [ \t]+
INDENT       = [ ]+   (deeper than directive's column)
INDENT2      = [ ]+   (deeper than property's column)
SOURCE       = URL | PACKAGE_NAME
URL          = 'http://' ... | 'https://' ...
PACKAGE_NAME = '@'? [a-zA-Z0-9_-]+ ('/' [a-zA-Z0-9_-]+)?
VALUE        = [^\n]+
```

The grammar has three indentation levels:
- Column 0: top-level directives
- Level 1 (indented): properties or grouped items
- Level 2 (further indented): sub-properties of expanded properties

### Parsing algorithm

1. Read all lines. Strip trailing whitespace.
2. Remove comment lines and blank lines.
3. Process `set` lines in order → build variable map.
4. Expand `$NAME` / `${NAME}` in all remaining lines using variable map
   then environment.
5. Process `use` lines → resolve and cache remote handlers.
6. For each remaining line at column 0 → start a new directive.
   If the directive name is a known plural form (e.g., `datasets`),
   mark it for grouped expansion.
7. For each subsequent indented line → add as property to the current
   directive. If the next line is indented further, it is a sub-property
   of the current property (expanded form).
8. For property lines containing `->` → split into source, dest, flags.
9. Expand grouped directives: for a `datasets` block, each level-1 entry
   becomes an individual `dataset` directive with its own properties.
10. Return an ordered list of `(directive_type, name, props)` tuples.

---

## Handler Contract

### Signatures

```
check(name: string | null, props: Props) -> "ok" | "drift" | "missing"
apply(name: string | null, props: Props) -> void
verify(name: string | null, props: Props) -> Result[]
```

Where:

```
Props = {
  args:    string[]       # remaining positional args after name
  [key]:   Property[]     # block properties, keyed by property name
}

Property = {
  args:    string[]       # tokens on the property line after the name
  source?: string         # if line contains ->, the source path
  dest?:   string         # if line contains ->, the destination path
  flags?:  string[]       # if line contains ->, tokens after destination
}

Result = {
  status:  "pass" | "warn" | "fail"
  message: string
}
```

### Arguments

**name** — the first positional argument from the directive line. For
`container web ubuntu/24.04`, name is `"web"`. For directives with no
positional args (like `firewall`), name is `null`.

**props** — contains `args` (remaining positional arguments after name)
and all block properties keyed by name. Properties that appear multiple
times produce an array.

Worked example — this Stampfile block:

```
container web ubuntu/24.04
  profile trusted
  disk data /tank/web -> /data
  disk logs /tank/logs -> /var/log readonly
  user shreeve 1000:1000
  start
```

Produces this handler call:

```
check("web", {
  args: ["ubuntu/24.04"],
  profile: [{ args: ["trusted"] }],
  disk: [
    { args: ["data"], source: "/tank/web", dest: "/data", flags: [] },
    { args: ["logs"], source: "/tank/logs", dest: "/var/log", flags: ["readonly"] }
  ],
  user: [{ args: ["shreeve", "1000:1000"] }],
  start: [{ args: [] }]
})
```

### Behavior rules

1. **check has no side effects.** It reads system state only. It never
   creates, modifies, or deletes anything.

2. **apply is idempotent.** Calling apply when the system already matches
   the declaration is a safe no-op. The engine calls check first and skips
   apply when the result is `"ok"`, but handlers must tolerate being called
   regardless.

3. **verify has no side effects.** It produces diagnostic results only.

4. **apply is incremental.** If a container exists but is missing a disk
   device, apply adds the device. It does not destroy and recreate the
   container.

5. **Handlers validate their own prerequisites.** If a container handler
   needs Incus to be running, it checks and fails with a clear message. It
   does not silently assume a prior directive handled Incus initialization.
   The Stampfile's top-to-bottom order ensures prerequisites are handled
   first, but handlers must not rely on this blindly.

6. **Handlers do not call `process.exit()`.** On failure, throw an error
   with a descriptive message. The engine catches it and reports it.

7. **apply returns void.** Success is silent. Failure is an exception.
   The engine runs a post-apply check to confirm the operation succeeded.

### Shell execution helpers

Stamp provides these helpers to directive handlers. They are installed
as globals — no imports needed in directive files.

```
sh(cmd)  -> string                                      # stdout; throws on failure
ok(cmd)  -> bool                                        # true if exit code is 0
run(cmd) -> { ok: bool, stdout: string, stderr: string, code: number }
```

All three support tagged template syntax (`$"..."`) for injection-safe
shell execution. Interpolated values are passed as separate arguments
and never interpreted by a shell:

```coffee
sh $"zfs set compression=#{value} #{pool}"    # safe — no shell injection
ok $"incus info #{name}"                      # safe — boolean check
```

They also accept plain arrays for dynamic argument lists:

```coffee
sh ['apt-get', 'install', '-y', ...missing]   # safe — direct exec
```

---

## Built-in Directives

### `packages`

Ensures system packages are installed.

**Syntax:**

```
packages <name>...

# or block form:
packages
  curl
  git
  jq
```

Both forms are equivalent. The block form is preferred when the list is
long.

**Check:** runs `dpkg -s <name>` for each package. Returns `ok` if all
installed, `drift` if some missing.

**Apply:** runs `apt-get update` then `apt-get install -y <missing-names>`.
Only installs packages that are actually missing.

**Verify:** reports installed/missing for each package.

**Platform note:** currently Debian/Ubuntu only (apt-get). The handler
should detect the package manager and fail clearly on unsupported
platforms.

---

### `pool`

Ensures a ZFS pool exists with the specified properties.

**Syntax:**

```
pool <name> <device>
  ashift <value>             # default: 12
  compression <algorithm>    # default: zstd
  atime <on|off>             # default: off
  mountpoint <path>          # default: /<name>
```

**Check:** runs `zpool list <name>`. Returns `ok` if pool exists.

**Apply:**
1. Verify block device exists (`test -b <device>`).
2. Guard: check `blkid <device>` — refuse to create if device has existing
   data. This prevents accidental destruction. Operator must `wipefs` first.
3. `zpool create -f -o ashift=<n> <name> <device>`.
4. Set pool properties (compression, atime).
5. Set mountpoint.

**Verify:** reports pool existence, device, and each property value.

---

### `dataset`

Ensures a ZFS dataset exists with correct ownership and permissions.

**Syntax:**

```
dataset <path>
  owner <uid>:<gid>          # numeric or username:groupname
  mode <octal>               # e.g., 2775
```

The `<path>` is the full ZFS dataset path (e.g., `tank/home/foo`). The
mount point is derived from the pool's mountpoint setting (typically
`/<path>`).

**Check:** runs `zfs list <path>`. If owner or mode are specified, checks
those against the mounted directory.

**Apply:** `zfs create <path>` if missing. `chown` and `chmod` if
ownership or mode differ.

**Verify:** reports dataset existence, current owner, current mode.

---

### `profile`

Ensures an Incus profile exists with the declared configuration.

**Syntax:**

```
profile <name>
  <config-key> <value>
```

Any Incus profile configuration key can appear as a property.

**Examples:**

```
profile trusted
  security.privileged true
  limits.memory 2GB
  limits.cpu 2

profile hardened
  security.idmap.isolated true
  security.nesting false
  limits.memory 1GB
  limits.cpu 1
  limits.processes 512
```

**Check:** runs `incus profile show <name>`, compares each declared key
against the current value. Returns `ok` if profile exists and all keys
match.

**Apply:** creates profile if missing (`incus profile create`), then
sets each key (`incus profile set <name> <key> <value>`).

**Verify:** reports profile existence and each config key's current vs.
expected value.

**Prerequisite:** Incus must be initialized. If `incus profile show`
fails because the daemon is not running, the handler reports a clear
error.

---

### `container`

Ensures an Incus container exists with the declared configuration.

**Syntax:**

```
container <name> <image>
  profile <name>
  disk <devname> <source> -> <path> [readonly]
  user <username> <uid>:<gid>
  start
```

**Block properties:**

| Property | Meaning | Multi? |
|----------|---------|--------|
| `profile` | Attach this profile to the container | yes |
| `disk` | Mount a host path into the container | yes |
| `user` | Create a user inside the container | yes |
| `start` | Ensure the container is running after apply | no |

**Check:** verifies container exists, expected profiles are attached, each
disk device matches (source, path, readonly), users exist inside the
container (only checkable if container is running).

**Apply:**
1. `incus init <image> <name>` if container does not exist.
   Uses `init` (not `launch`) so the container is created stopped.
2. For each `profile`: attach if not already present.
3. For each `disk`: compare source/path/readonly against current config.
   Remove and re-add if different. Add if missing.
4. If `start` is declared: start the container.
5. Wait for readiness: poll `incus exec <name> -- true` with a timeout
   (30 seconds, 1-second intervals).
6. For each `user`: create the user/group inside the container via
   `incus exec`.

**Verify:** reports existence, running state, each profile, each disk
device (source and path), and each user.

**Design note:** creating with `init` instead of `launch` ensures the
security profile and disk devices are configured before the container's
first boot. This prevents the UID namespace mismatch that occurs when a
container starts unprivileged and then has `security.privileged` applied
afterward.

**Prerequisite:** Incus must be initialized. The handler checks
`incus info` and fails with a clear message if the daemon is not
available.

---

### `incus`

Ensures the Incus daemon is initialized with a network and storage pool.

**Syntax:**

```
incus
  storage <pool-name> <driver> <source>
  network <bridge-name>
```

**Examples:**

```
incus
  storage default zfs tank/incus/default
  network incusbr0
```

**Check:** runs `incus info` to verify the daemon is responsive. Checks
that the named storage pool and network exist.

**Apply:**
1. Enable and start the Incus systemd service if not running.
2. If not yet initialized, run `incus admin init` with a minimal preseed
   that creates the declared network (bridge, IPv4 NAT, no IPv6) and
   storage pool.
3. If already initialized, verify the declared storage pool and network
   exist and report an error if they do not (stamp will not modify an
   existing Incus init).

**Verify:** reports daemon status, storage pool existence and driver,
network bridge existence.

**Note:** this directive replaces the preseed template workflow from the
bash scripts. The handler generates the preseed YAML internally from the
declared properties.

---

### `user`

Ensures a system user exists on the host.

**Syntax:**

```
user <name> <uid>:<gid>
  shell <path>               # default: /bin/bash
  groups <name>...           # supplementary group memberships
  home <path>                # default: /home/<name>
```

**Check:** runs `id -u <name>`, verifies UID and primary GID match.

**Apply:**
1. Create the primary group if a group with the specified GID does not
   exist (uses the username as the group name).
2. `useradd -m -u <uid> -g <gid> -s <shell> <name>` if user does not
   exist.
3. `usermod -aG <groups> <name>` if supplementary groups are declared.

**Verify:** reports user existence, UID, primary GID, shell, group
memberships.

---

### `group`

Ensures a system group exists on the host.

**Syntax:**

```
group <name> <gid>
```

**Check:** runs `getent group <name>`, verifies GID matches.

**Apply:** `groupadd -g <gid> <name>`.

**Verify:** reports group existence and GID.

---

### `firewall`

Ensures ufw firewall rules are configured.

**Syntax:**

```
firewall
  default <deny|allow> <incoming|outgoing>
  allow <rule>
  deny <rule>
```

**Examples:**

```
firewall
  default deny incoming
  default allow outgoing
  allow ssh
  allow 443/tcp
  allow 80/tcp
```

**Check:** verifies ufw is installed and active, default policies match,
declared rules exist.

**Apply:** installs ufw if missing, sets default policies, adds rules,
enables ufw if inactive.

**Verify:** reports ufw active status, each default policy, each rule.

---

### `ssh`

Ensures the SSH daemon is configured.

**Syntax:**

```
ssh
  password-auth <yes|no>
  permit-root-login <yes|no|prohibit-password>
  pubkey-auth <yes|no>
```

**Check:** runs `sshd -T` and compares the effective configuration
against each declared property.

**Apply:** writes a drop-in config to `/etc/ssh/sshd_config.d/99-stamp.conf`
with the declared settings. Reloads sshd (`systemctl reload ssh` or
`systemctl reload sshd`).

**Verify:** reports each setting's effective vs. declared value.

**Safety note:** the handler writes a drop-in file rather than modifying
`sshd_config` directly. This is reversible — deleting `99-stamp.conf` and
reloading sshd restores the original configuration.

---

### `service`

Ensures a systemd service is enabled and running.

**Syntax:**

```
service <name>
  enabled <true|false>       # default: true
  running <true|false>       # default: true
```

**Check:** runs `systemctl is-enabled <name>` and
`systemctl is-active <name>`.

**Apply:** enables/starts, disables/stops as needed.

**Verify:** reports enabled and active state.

---

## Plugin System

### Resolution order

When stamp encounters a directive name, it resolves the handler in this
order:

1. **Built-in** — stamp's own `directives/` directory
2. **Local** — `./directives/` relative to the Stampfile's directory
3. **Installed** — `~/.stamp/directives/<name>.rip` (or `.js`/`.ts`)
4. **npm** — `node_modules/@stamp/<name>/` or `node_modules/stamp-<name>/`
5. **Remote** — if a `use` line declared this name, the cached URL module

The first match wins.

### Handler module format

A handler must export `check`, `apply`, and `verify`. It may also export
metadata used by `stamp info`:

```coffee
export name        = "container"
export version     = "1.0.0"
export description = "Manages Incus containers"
export positional  = ["name", "image"]
export properties  = {
  profile: { description: "Attach an Incus profile", multi: true }
  disk:    { description: "Mount a host path", arrow: true, multi: true }
  user:    { description: "Create a user inside the container", multi: true }
  start:   { description: "Ensure container is running" }
}
```

Metadata is optional. The handler works without it.

### Installing directives

```
stamp install @stamp/postgres          # from npm registry
stamp install ./my-directive           # from local directory
```

Installed directives are copied to `~/.stamp/directives/`. The directory
can be overridden with `$STAMP_HOME`.

### Remote directives via `use`

```
use https://raw.githubusercontent.com/org/stamp-caddy/v1.2/caddy.rip
```

On first use, stamp fetches the module and caches it in `~/.stamp/cache/`.
Subsequent runs use the cache unless `stamp update` is called.

The URL should include a version tag, branch, or commit hash for pinning.
Unversioned URLs are a warning.

### Security model for remote directives

Remote directive modules run with full system access (they call shell
commands). This is the same trust model as `curl | bash` or `npx`. Users
should only `use` URLs they control or audit.

Mitigations:
- Cached modules are stored as plain files — inspect before first apply
- `stamp plan` runs `check` only (read-only) — safe to run against
  untrusted modules
- Future: hash pinning (`use <url> sha256=<hash>`)

### Publishing directives

A directive package is a standard npm package:

```
package.json
  {
    "name": "@stamp/postgres",
    "main": "directives/postgres.js",
    "stamp": { "directives": ["postgres"] }
  }
directives/
  postgres.rip   (or .js or .ts)
```

The `stamp.directives` field lists the directive names this package
provides, allowing one package to supply multiple directives.

---

## Engine Algorithm

### Overview

```
parse(stampfile)
  → resolve variables (set lines)
  → expand variables in all lines
  → resolve handlers (use lines + resolution order)
  → build directive list: [(handler, name, props), ...]

execute(mode, directives)
  → for each directive: check, then apply/verify/plan
```

### Apply mode

For each directive, in Stampfile order:

```
result = handler.check(name, props)
if result == "ok"
  log "  ok    <type> <name>"
else
  log "  apply <type> <name>"
  handler.apply(name, props)
  after = handler.check(name, props)
  if after != "ok"
    log "  FAIL  <type> <name> — still not ok after apply"
    abort
```

The post-apply re-check is a safety net. If apply runs but the system
still does not match the declaration, something is wrong and the engine
stops immediately.

### Verify mode

For each directive, in Stampfile order:

```
results = handler.verify(name, props)
for result in results
  log "  <PASS|WARN|FAIL> <type>: <message>"
```

Collect totals. Exit 0 if no FAILs, exit 1 if any FAIL.

### Plan mode (dry-run)

For each directive, in Stampfile order:

```
result = handler.check(name, props)
if result == "ok"      → log "  ok     <type> <name>"
if result == "drift"   → log "  update <type> <name>"
if result == "missing" → log "  create <type> <name>"
```

No changes are made. Only `check` is called.

### Error handling

If a handler throws during `apply`:

1. Log the error with the directive type, name, and error message.
2. Stop execution immediately (do not proceed to next directive).
3. Exit with code 1.

Fail-fast prevents cascading failures. A future `--continue-on-error`
flag may be added.

### Execution order

Directives execute **sequentially**, in the order they appear in the
Stampfile. No parallelism. This is deliberate:

- Infrastructure operations have implicit ordering (pool before dataset,
  dataset before container, profile before container).
- Sequential execution eliminates race conditions.
- The Stampfile's top-to-bottom order IS the dependency order. The
  operator controls it explicitly.

---

## CLI Interface

### Commands

```
stamp apply [file]           # reconcile system to match Stampfile
stamp verify [file]          # check current state, report PASS/WARN/FAIL
stamp plan [file]            # dry-run: show what apply would do

stamp install <source>       # install a directive handler
stamp update [name]          # re-fetch cached remote directives
stamp list                   # show all available directives
stamp info <directive>       # show a directive's syntax and properties

stamp version                # print stamp version
stamp help                   # show usage
```

### Default file resolution

If `[file]` is omitted, stamp searches the current directory for:
`Stampfile`, then `Hostfile`, then `Containerfile`.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (apply completed, verify had no FAILs, plan found nothing to do) |
| 1 | Failure (apply error, verify had FAILs, plan found changes needed) |
| 2 | Usage error (bad arguments, file not found, unknown directive) |

### Output format

Apply mode:

```
$ stamp apply Hostfile

  ok     packages
  ok     pool tank
  apply  dataset tank/home/web
  ok     profile trusted
  apply  container web
  ok     firewall
  ok     ssh

Applied 2 of 7 directives.
```

Verify mode:

```
$ stamp verify Hostfile

  PASS  packages: curl installed
  PASS  packages: git installed
  PASS  pool: tank exists
  PASS  dataset: tank/home/web exists
  FAIL  dataset: tank/home/web owner is root:root, expected 1000:1000
  PASS  profile: trusted exists
  PASS  profile: trusted security.privileged is true
  PASS  container: web exists
  PASS  container: web running
  PASS  container: web profile trusted attached
  PASS  container: web disk data source matches
  WARN  container: web no memory limit set
  PASS  firewall: ufw active
  PASS  ssh: password-auth is no

PASS=12 WARN=1 FAIL=1
```

Plan mode:

```
$ stamp plan Hostfile

  ok     packages
  ok     pool tank
  create dataset tank/home/web
  ok     profile trusted
  create container web
  ok     firewall
  ok     ssh

2 changes would be applied.
```

---

## Implementation Notes

### Runtime

Bun. Distributed as an npm package. Invoked as `bunx stamp`, or installed
globally with `bun add -g stamp`.

### Language

Rip (compiles to JS, runs on Bun). The engine, parser, CLI, and all
built-in directives are written in Rip. Community directives can be Rip,
TypeScript, or JavaScript — the engine imports them as ES modules.

### Package structure

```
packages/stamp/
  package.json
  bin/stamp                  # #!/usr/bin/env bun
  src/
    cli.rip                  # argument parsing, subcommand dispatch
    parser.rip               # hand-rolled Stampfile parser
    engine.rip               # handler resolution, check/apply/verify loop
    helpers.rip              # sh, ok, run, logging
  directives/
    brew.rip
    packages.rip
    ensure.rip
    pool.rip
    dataset.rip
    profile.rip
    container.rip
    incus.rip
    multipass.rip
    user.rip
    group.rip
    firewall.rip
    ssh.rip
    service.rip
  stamps/
    basic                    # simple test: packages, users, groups, firewall
    host                     # production Incus+ZFS host
    mac-install              # macOS: Multipass VM + bootstrap
    mac-vm                   # full host provisioning inside the VM
  test/
    runner.rip               # test suite (79 tests)
```

### Stampfile parser

The parser is hand-rolled (~170 lines), line-oriented. No parser
generator needed — the grammar is two indentation levels with
`set`/`use` as special forms.

Parsing passes:

1. Strip trailing whitespace, remove comment and blank lines.
2. Process `set` lines to build the variable map.
3. Expand `$NAME` / `${NAME}` in all remaining lines.
4. Process `use` lines to resolve remote handlers.
5. Group lines into directives by indentation (column 0 = new directive).
6. For each property line, detect `->` and split into source/dest/flags.
7. Expand plural forms (`datasets` → individual `dataset` calls).
8. Produce a flat ordered list of `{ type, name, args, properties }`.

### Shell execution helpers

`sh`, `ok`, and `run` are installed as globals by the engine before
any directive loads. They support three calling modes:

```coffee
sh $"incus init #{image} #{name}"       # tagged template — injection-safe
sh ['apt-get', 'install', ...missing]   # plain array — direct exec
sh "echo 'y' | ufw enable"             # string — passes to sh -c
```

The `$"..."` syntax compiles to a JavaScript tagged template literal.
Interpolated values are passed as separate arguments and never
interpreted by a shell. `null` and `undefined` values are silently
dropped from the argument list.

### Reference directive: `dataset.rip`

Complete implementation showing the handler contract. No imports —
`sh`, `ok`, and `run` are available globally:

```coffee
export name        = "dataset"
export description = "Ensures a ZFS dataset exists with correct ownership and permissions"
export positional  = ["path"]
export properties  =
  owner: { description: "Ownership as uid:gid" }
  mode:  { description: "Permission mode (octal)" }

export check = (path, props) ->
  return 'missing' unless ok $"zfs list #{path}"
  mountpoint = sh $"zfs get -H -o value mountpoint #{path}"
  if want = props.owner?[0]?.args?[0]
    return 'drift' if want isnt sh $"stat -c %u:%g #{mountpoint}"
  if want = props.mode?[0]?.args?[0]
    return 'drift' if want isnt sh $"stat -c %a #{mountpoint}"
  'ok'

export apply = (path, props) ->
  sh $"zfs create -p #{path}" unless ok $"zfs list #{path}"
  mountpoint = sh $"zfs get -H -o value mountpoint #{path}"
  sh $"chown #{props.owner[0].args[0]} #{mountpoint}" if props.owner
  sh $"chmod #{props.mode[0].args[0]} #{mountpoint}" if props.mode

export verify = (path, props) ->
  results = []
  unless ok $"zfs list #{path}"
    results.push { status: 'fail', message: "dataset missing: #{path}" }
    return results
  results.push { status: 'pass', message: "dataset exists: #{path}" }
  mountpoint = sh $"zfs get -H -o value mountpoint #{path}"
  if want = props.owner?[0]?.args?[0]
    if want is (have = sh $"stat -c %u:%g #{mountpoint}")
      results.push { status: 'pass', message: "#{path} owner is #{want}" }
    else
      results.push { status: 'fail', message: "#{path} owner is #{have}, expected #{want}" }
  if want = props.mode?[0]?.args?[0]
    if want is (have = sh $"stat -c %a #{mountpoint}")
      results.push { status: 'pass', message: "#{path} mode is #{want}" }
    else
      results.push { status: 'fail', message: "#{path} mode is #{have}, expected #{want}" }
  results
```

---

## Complete Example: Incus Host

This Stampfile provisions a complete Incus + ZFS host on Linode or GCP.
It replaces ~600 lines of bash scripts, a host.env config file, preseed
templates, profile YAMLs, numbered setup scripts, container stamping
scripts, and a verification script — with a single declarative file.

```
# Hostfile — Incus host on Linode or GCP

set POOL     tank
set DEVICE   /dev/disk/by-id/scsi-0Linode_Volume_tank
set MOUNT    /tank
set INCUS_DS incus/default
set SHARED   shared/common

# ── system packages ──────────────────────────────────────────

packages
  zfsutils-linux
  incus
  uidmap
  acl
  gettext-base
  openssh-server
  ripgrep
  fail2ban
  ufw
  unattended-upgrades

# ── ZFS pool and datasets ───────────────────────────────────

pool $POOL $DEVICE
  ashift 12
  compression zstd
  atime off
  mountpoint $MOUNT

dataset $POOL/$INCUS_DS

dataset $POOL/home
dataset $POOL/home/foo
  owner 1000:1000
dataset $POOL/home/bar
  owner 1000:1000
dataset $POOL/home/baz
  owner 1000:1000
dataset $POOL/home/base
  owner 1000:1000

dataset $POOL/shared
dataset $POOL/$SHARED
  owner 1001:1001
  mode 2775

# ── host users and groups ───────────────────────────────────

user shreeve 1000:1000
  groups trust

user trust 1001:1001

group jail 1002

# ── Incus initialization ────────────────────────────────────

incus
  storage default zfs $POOL/$INCUS_DS
  network incusbr0

# ── Incus profiles ──────────────────────────────────────────

profile trusted
  security.privileged true
  limits.memory 2GB
  limits.cpu 2

profile hardened
  security.idmap.isolated true
  security.nesting false
  limits.memory 1GB
  limits.cpu 1
  limits.processes 512

# ── containers ──────────────────────────────────────────────

container foo ubuntu/24.04
  profile trusted
  disk home $MOUNT/home/foo -> /home
  disk shared $MOUNT/$SHARED -> /shared
  user shreeve 1000:1000
  user trust 1001:1001
  start

container bar ubuntu/24.04
  profile trusted
  disk home $MOUNT/home/bar -> /home
  disk shared $MOUNT/$SHARED -> /shared
  user shreeve 1000:1000
  user trust 1001:1001
  start

container baz ubuntu/24.04
  profile hardened
  disk home $MOUNT/home/baz -> /home
  disk shared $MOUNT/$SHARED -> /shared readonly
  user shreeve 1000:1000
  user trust 1001:1001
  start

# ── security ────────────────────────────────────────────────

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

To provision the host:

```
stamp apply Hostfile
```

To verify current state:

```
stamp verify Hostfile
```

To preview changes without applying:

```
stamp plan Hostfile
```

That is the entire system. One file describes the host. One command
converges reality to match it.
