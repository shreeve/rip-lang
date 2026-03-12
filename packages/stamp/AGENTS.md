# Stamp — Agent Guide

Declarative host provisioning with pluggable directives. No state file,
no agent, no YAML. The Stampfile is the source of truth.

## Architecture

```
Stampfile → Parser → Engine → Directives
              ↓        ↓         ↓
           variables  resolve   check/apply/verify
           arrows     handlers  via sh/ok/run
           plurals    loop
```

Four source files, ~524 lines total:

| File         | Lines | Purpose                                        |
|--------------|-------|------------------------------------------------|
| `parser.rip` | 170   | Stampfile grammar — variables, arrows, plurals |
| `engine.rip` | 149   | Handler resolution, check/apply/verify loop    |
| `cli.rip`    | 126   | Subcommand dispatch, file discovery            |
| `helpers.rip` | 84   | Shell execution, logging                       |

## Shell Helpers

`sh`, `ok`, and `run` are installed as globals by the engine before any
directive loads. No imports needed in directive files.

Three-mode dispatch based on argument type:

| Call form      | Mode            | Behavior                        |
|----------------|-----------------|---------------------------------|
| `sh $"cmd #{v}"` | Tagged template | Builds argv array, no shell   |
| `sh ['cmd', ...args]` | Plain array | Direct exec, no shell      |
| `sh "cmd \| pipe"` | String       | Passes to `sh -c` (shell)    |

Detection: `kind(args[0]) == 'array'` with `.raw` distinguishes tagged
templates from plain arrays. Strings go to the shell.

`buildArgv` handles:
- Word-splitting static parts on whitespace
- Gluing interpolations to adjacent text (`compression=#{val}` → one arg)
- Dropping `null`/`undefined` values (postfix-if patterns work cleanly)

## Parser

Hand-rolled, line-oriented, ~170 lines. No parser generator needed.

Parsing passes:
1. Strip comments and blank lines
2. Process `set` lines → variable map
3. Expand `$NAME` / `${NAME}` in all lines
4. Process `use` lines → external handler sources
5. Group lines into directives by indentation (3 levels max)
6. Split `->` in property lines into source/dest/flags
7. Expand plural forms (`datasets` → individual `dataset` calls)

Directives with no positional name (parser skips name extraction):
`brew`, `packages`, `firewall`, `ssh`, `incus`

Quoted strings in Stampfiles preserve grouping — `"curl ... | bash"`
becomes one token in the args array, not split on `|`.

## Writing a Directive

A directive is a `.rip` file in `directives/` that exports three functions.
`sh`, `ok`, and `run` are available globally — no imports needed.

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
    results.push { status: 'pass', message: "#{name} present" }
  else
    results.push { status: 'fail', message: "#{name} missing" }
  results
```

### Handler contract

- **check** — no side effects. Returns `"ok"`, `"drift"`, or `"missing"`.
- **apply** — idempotent. Engine runs post-apply re-check; aborts if still not ok.
- **verify** — no side effects. Returns `[{ status, message }]` where
  status is `"pass"`, `"warn"`, or `"fail"`.

### Props structure

For `container web ubuntu/24.04` with block properties:

```javascript
check("web", {
  args: ["ubuntu/24.04"],
  profile: [{ args: ["trusted"] }],
  disk: [{ args: ["data"], source: "/tank/web", dest: "/data", flags: [] }],
  start: [{ args: [] }]
})
```

- `name` — first positional arg (or `null` for no-name directives)
- `props.args` — remaining positional args after name
- `props[key]` — array of property entries, each with `.args`, optional `.source`/`.dest`/`.flags`/`.sub`

### Common patterns

**want/have for verify:**
```coffee
if want = props.compression?[0]?.args?[0]
  if want is (have = sh $"zfs get -H -o value compression #{name}")
    results.push { status: 'pass', message: "#{name} compression is #{want}" }
  else
    results.push { status: 'warn', message: "#{name} compression is #{have}, expected #{want}" }
```

**Guard with unless-assign:**
```coffee
return 'ok' unless args = getCheck(props)
```

**Optional args via null-safe templates:**
```coffee
ro = 'readonly=true' if 'readonly' in (entry.flags or [])
sh $"incus config device add #{name} #{devname} disk source=#{source} path=#{dest} #{ro}"
```

When `ro` is `undefined`, `buildArgv` drops it — no empty argument.

**Pipe elimination — use Rip instead of shell:**
```coffee
# Instead of: sh "getent group #{name} | cut -d: -f3"
(sh $"getent group #{name}").split(':')[2]
```

## Plugin Resolution

1. Built-in — `directives/` in the stamp package
2. Local — `./directives/` beside the Stampfile
3. Installed — `~/.stamp/directives/`
4. npm — `@stamp/<name>` or `stamp-<name>`
5. Remote — `use` directive in the Stampfile

## Testing

Tests live in `test/runner.rip`. Run with:

```bash
bun --preload ../../rip-loader.js test/runner.rip
```

Test types:
- **Parser tests** — verify Stampfile parsing (variables, arrows, plurals, etc.)
- **Helper tests** — verify sh/ok/run in string and tagged template modes
- **Injection tests** — verify shell metacharacters are treated as literal data

Test files in `test/`:
- `Stampfile` — simple packages/user/group/firewall test
- `Hostfile` — full Incus+ZFS host from STAMP.md spec
- `VMfile` — macOS Multipass VM with bootstrap

## Idioms

- Use `p` instead of `console.log`, `warn` instead of `console.error`
- Use `exit n` instead of `process.exit n`
- Use `raise "message"` instead of `throw new Error "message"`
- Use `$"..."` for all interpolated shell commands (injection-safe)
- Use `if want isnt have` over `unless want is have` for comparisons
- Use `if want = props.X?[0]?.args?[0]` to guard and assign in one step
- Directives have no imports — `sh`, `ok`, `run` are globals
