#!/usr/bin/env bash
# =============================================================================
# build-extension.sh — Build the in-process extension test driver (Phase 2A).
#
# Compiles decoder.cpp + ripdb.cpp + extension_test.cpp into a single binary
# that links against libduckdb from misc/duckdb/build/release. The binary
# loads ripdb by calling Load(loader) directly — no .duckdb_extension file,
# no metadata footer, no LOAD statement. This is the fast inner loop for
# iterating on catalog + scan + HTTP semantics.
#
# Phase 2B will add a separate script that produces a real .duckdb_extension
# binary plus metadata footer and smoke-tests via the stock `duckdb -unsigned`
# CLI. That's a follow-up commit.
#
# Prerequisites:
#   cd misc/duckdb && make release    # builds libduckdb.dylib + CLI
#
# Usage:
#   ./build-extension.sh              # compile + run (requires rip-db on :4214)
#   ./build-extension.sh --no-run     # compile only
# =============================================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUCKDB="${DUCKDB_SRC:-$HERE/../../../misc/duckdb}"
BUILD="${DUCKDB_BUILD:-$DUCKDB/build/release}"

if [[ ! -d "$BUILD" ]]; then
	echo "error: $BUILD not found. Run 'cd $DUCKDB && make release' first." >&2
	exit 1
fi

CXX="${CXX:-clang++}"
OUT="$HERE/extension_test"

set -x
"$CXX" \
	-std=c++17 \
	-O0 \
	-g \
	-Wall \
	-Wno-unused-parameter \
	-Wno-unused-function \
	-Wno-switch \
	-I "$DUCKDB/src/include" \
	-I "$DUCKDB/third_party/yyjson/include" \
	"$HERE/decoder.cpp" \
	"$HERE/ripdb.cpp" \
	"$HERE/extension_test.cpp" \
	-L "$BUILD/src" \
	-lduckdb \
	-Wl,-rpath,"$BUILD/src" \
	-o "$OUT"
set +x

echo "built $OUT ($(wc -c < "$OUT") bytes)"

if [[ "${1:-}" != "--no-run" ]]; then
	echo ""
	echo "# running against rip-db @ http://localhost:4214 (start it with: "
	echo "#   rip packages/db/extension/scripts/smoke-server.rip)"
	echo ""
	"$OUT" "http://localhost:4214"
fi
