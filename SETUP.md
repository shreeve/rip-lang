# Rip Global Setup Guide

Quick guide to set up Rip so `.rip` files work anywhere with Bun.

## One-Time Setup (5 minutes)

```bash
# 1. Clone Rip
git clone https://github.com/yourusername/rip.git
cd rip

# 2. Link globally
bun link

# 3. Configure Bun to auto-load Rip
echo 'preload = ["rip-lang/loader"]' >> ~/.bunfig.toml

# 4. Verify
bun pm ls --global | grep rip-lang
cat ~/.bunfig.toml
```

## Test It Works

```bash
# Go anywhere
cd ~

# Create a test file
cat > hello.rip << 'EOF'
def greet(name)
  "Hello, ${name}!"

console.log greet("World")
EOF

# Run it
bun hello.rip
# → Hello, World!
```

## How It Works

1. **`bun link`** - Makes the `rip-lang` package available globally
2. **`~/.bunfig.toml`** - Tells Bun to preload the Rip loader for all projects
3. **Automatic compilation** - When you run `bun script.rip`, the loader compiles it on-the-fly

## Using in Projects

### Import .rip modules

```rip
# utils.rip
export def add(a, b)
  a + b

export multiply = (a, b) => a * b
```

```rip
# main.rip
import { add, multiply } from "./utils.rip"

console.log add(5, 3)      # 8
console.log multiply(4, 7) # 28
```

```bash
bun main.rip  # Works!
```

### Per-project override

If you want project-specific configuration:

```bash
# In your project directory
echo 'preload = ["rip-lang/loader"]' > bunfig.toml

# Now this project uses Rip
bun your-script.rip
```

## Uninstalling

```bash
# Remove global link
bun unlink rip-lang

# Remove from global config
sed -i.bak '/rip-lang/d' ~/.bunfig.toml
```

## Troubleshooting

### "Cannot find package rip-lang"

The package isn't linked. Run:
```bash
cd /path/to/rip-lang
bun link
```

### Imports not working

Make sure you include the `.rip` extension:
```rip
import { fn } from "./utils.rip"  # ✅ Good
import { fn } from "./utils"      # ❌ Bad
```

### Changes not reflecting

Bun might be caching. Try:
```bash
bun --bun script.rip  # Bypass cache
```

## What Gets Installed

**Global:**
- Link to `rip-lang` package (via `bun link`)
- One line in `~/.bunfig.toml`

**Nothing else!** Rip has zero dependencies.

## Future: NPM Package

Once Rip is published to npm:

```bash
# Install globally
bun add -g rip-lang

# Or per-project
bun add -d rip-lang

# Same config
echo 'preload = ["rip-lang/loader"]' > bunfig.toml
```

---

**Questions?** See [README.md](README.md) for complete documentation.
