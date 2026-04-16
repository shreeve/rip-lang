#!/bin/bash
#
# Link rip-lang from source into global node_modules.
#
# Usage: bash scripts/link.sh
#
# This symlinks the compiler and all packages so you always run
# rip from source. Re-run after adding new packages.

set -euo pipefail

MONO_REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Remove rip-lang from bun's global manifest if present,
# otherwise `bun i -g <anything>` will reinstall it from npm.
if grep -qE '"rip-lang"|"@rip-lang/' ~/package.json 2>/dev/null; then
  echo "Removing rip-lang from bun's global manifest..."
  bun remove -g rip-lang @rip-lang/all 2>/dev/null || true
fi

# Clean slate
rm -rf ~/node_modules/rip-lang
rm -rf ~/node_modules/@rip-lang
mkdir -p ~/node_modules/@rip-lang

# Symlink compiler
ln -sfn "$MONO_REPO" ~/node_modules/rip-lang
echo "Linked rip-lang -> $MONO_REPO"

# Symlink packages
for pkg in "$MONO_REPO"/packages/*/; do
  name=$(basename "$pkg")
  ln -sfn "$pkg" ~/node_modules/@rip-lang/"$name"
  echo "Linked @rip-lang/$name -> $pkg"
done

# Symlink CLI binaries into ~/.bun/bin (already in PATH)
mkdir -p ~/.bun/bin
ln -sfn "$MONO_REPO"/bin/rip                        ~/.bun/bin/rip
ln -sfn "$MONO_REPO"/packages/db/bin/rip-db         ~/.bun/bin/rip-db
ln -sfn "$MONO_REPO"/packages/print/bin/rip-print   ~/.bun/bin/rip-print
ln -sfn "$MONO_REPO"/packages/server/bin/rip-server ~/.bun/bin/rip-server
echo "Linked rip packages into ~/.bun/bin"

echo ""
echo "Done. Verify with: rip --version"
