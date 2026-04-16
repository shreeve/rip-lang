#!/bin/bash
#
# Link rip-lang from source into global node_modules.
#
# Usage: bash scripts/link.sh
#
# This symlinks the compiler and all packages so you always run
# rip from source. Re-run after adding new packages.

set -euo pipefail
shopt -s nullglob

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USER_MOD="$HOME/node_modules"
GLOB_MOD="$HOME/.bun/install/global/node_modules"
GLOB_BIN="$HOME/.bun/bin"

# Remove rip-lang from bun's global manifest if present,
# otherwise `bun i -g <anything>` will reinstall it from npm.
if grep -qE '"rip-lang"|"@rip-lang/' "$HOME/package.json" 2>/dev/null; then
  echo "Removing rip-lang from bun's global manifest..."
  bun remove -g rip-lang @rip-lang/all 2>/dev/null || true
fi

# Clean slate — link into both ~/node_modules (NODE_PATH fallback)
# and bun's global install tree (where global require/import resolves)
rm -rf "$USER_MOD/rip-lang"
rm -rf "$USER_MOD/@rip-lang"
rm -rf "$GLOB_MOD/rip-lang"
rm -rf "$GLOB_MOD/@rip-lang"
mkdir -p "$USER_MOD/@rip-lang" "$GLOB_MOD/@rip-lang" "$GLOB_BIN"

# Symlink compiler
ln -sfn "$REPO_DIR" "$USER_MOD/rip-lang"
ln -sfn "$REPO_DIR" "$GLOB_MOD/rip-lang"
echo "Linked rip-lang -> $REPO_DIR"

# Symlink packages
for pkg in "$REPO_DIR"/packages/*/; do
  [[ -f "$pkg/package.json" ]] || continue
  name=${pkg%/}
  name=${name##*/}
  ln -sfn "$pkg" "$USER_MOD/@rip-lang/$name"
  ln -sfn "$pkg" "$GLOB_MOD/@rip-lang/$name"
  echo "Linked @rip-lang/$name -> $pkg"
done

# Symlink CLI binaries into ~/.bun/bin (already in PATH)
ln -sfn "$REPO_DIR"/bin/rip                        "$GLOB_BIN"/rip
ln -sfn "$REPO_DIR"/packages/db/bin/rip-db         "$GLOB_BIN"/rip-db
ln -sfn "$REPO_DIR"/packages/print/bin/rip-print   "$GLOB_BIN"/rip-print
ln -sfn "$REPO_DIR"/packages/server/bin/rip-server "$GLOB_BIN"/rip-server
echo "Linked binaries into $GLOB_BIN"

echo
echo "Done. Verify with: rip --version"
