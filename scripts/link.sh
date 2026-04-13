#!/bin/bash
#
# Link rip-lang from source into global node_modules.
#
# Usage: bash scripts/link.sh
#
# This symlinks the compiler and all packages so you always run
# rip from source. Re-run after adding new packages.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
ln -sfn "$REPO_ROOT" ~/node_modules/rip-lang
echo "Linked rip-lang -> $REPO_ROOT"

# Symlink packages
for pkg in "$REPO_ROOT"/packages/*/; do
  name=$(basename "$pkg")
  ln -sfn "$pkg" ~/node_modules/@rip-lang/"$name"
  echo "Linked @rip-lang/$name -> $pkg"
done

# Symlink CLI binaries into ~/.bun/bin (already in PATH)
mkdir -p ~/.bun/bin
ln -sfn "$REPO_ROOT"/bin/rip                        ~/.bun/bin/rip
ln -sfn "$REPO_ROOT"/packages/db/bin/rip-db         ~/.bun/bin/rip-db
ln -sfn "$REPO_ROOT"/packages/print/bin/rip-print   ~/.bun/bin/rip-print
ln -sfn "$REPO_ROOT"/packages/script/bin/rip-script ~/.bun/bin/rip-script
ln -sfn "$REPO_ROOT"/packages/server/bin/rip-server ~/.bun/bin/rip-server
ln -sfn "$REPO_ROOT"/packages/swarm/bin/rip-swarm   ~/.bun/bin/rip-swarm
echo "Linked rip packages into ~/.bun/bin"

echo ""
echo "Done. Verify with: rip --version"
