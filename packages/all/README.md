<img src="https://raw.githubusercontent.com/shreeve/rip-lang/main/docs/assets/rip.png" style="width:50px" /> <br>

# Rip (all) - @rip-lang/all

> Meta-package that installs `rip-lang` and the published `@rip-lang/*` ecosystem packages.

## Install

```bash
bun add @rip-lang/all
```

## Release

```bash
# Run from the repo root

# Standard full ecosystem release
bun run bump

# Selective package release; also refreshes @rip-lang/all
bun run bump db
bun run bump db csv
```

- Do not publish `@rip-lang/all` by hand.
- The root release script updates and publishes `@rip-lang/all` automatically.
- Full releases come from `bun run bump`; selective package releases also refresh `@rip-lang/all` so its dependency ranges stay current.
