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

# DuckDB source + dylib selection.
#
# We prefer the in-tree pinned submodule at packages/db/duckdb because it is
# the same source the loadable extension is built against (`make release`
# from the repo root drives that), so we are guaranteed source/header
# coherence with the dylib we link.
#
# History: this script previously defaulted to the looser `misc/duckdb`
# checkout. That worked for a while, but the prebuilt dylib drifted out
# of sync with the system toolchain — it was built ~April 2026 under an
# earlier XCode that emitted a different libc++ container layout, and
# any -O0 in-process compile against the current toolchain's headers
# crashes inside `ColumnList::AddColumn` with `std::length_error: vector`.
# It's a stale-binary issue, not an ABI bug in DuckDB or the extension;
# rebuilding misc/duckdb's libduckdb under the current toolchain also
# fixes it. Pointing at the in-tree submodule sidesteps the trap entirely.
#
# To override (e.g. for cross-checking), set both DUCKDB_SRC and DUCKDB_BUILD
# explicitly on the env:
#   DUCKDB_SRC=/path DUCKDB_BUILD=/path/build/release ./build-extension.sh
DEFAULT_DUCKDB_SRC="$HERE/../duckdb"
DEFAULT_DUCKDB_BUILD="$HERE/../build/release"

DUCKDB="${DUCKDB_SRC:-$DEFAULT_DUCKDB_SRC}"
BUILD="${DUCKDB_BUILD:-$DEFAULT_DUCKDB_BUILD}"

if [[ ! -d "$BUILD" ]]; then
	echo "error: $BUILD not found." >&2
	echo "  Run 'make release' from the repo root to build it" >&2
	echo "  (or override with DUCKDB_SRC=... DUCKDB_BUILD=... pointing at another DuckDB checkout)." >&2
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
	# Use the rip:// scheme rather than http://. Either works at the
	# extension level (NormalizeUrl accepts both), but DuckDB's
	# `DatabaseManager::AttachDatabase` resolves `IsRemoteFile(info.path)`
	# BEFORE `(TYPE ripdb)` is considered — and `http://` is in
	# `EXTENSION_FILE_PREFIXES`, so an `http://` ATTACH whose
	# AccessMode is AUTOMATIC gets silently bumped to READ_ONLY (which
	# then surfaces as "Cannot execute INSERT/UPDATE/DELETE on database
	# attached in read-only mode" for every DML test). Using `rip://`
	# (not in the prefix list) keeps the access mode as AUTOMATIC →
	# READ_WRITE through to our PlanInsert/Update/Delete hooks. See
	# CLI.md §"BSD-sockets HTTP/1.1 client" for the related discussion.
	echo ""
	echo "# running against rip-db @ rip://localhost:4214 (start it with: "
	echo "#   rip packages/db/extension/scripts/smoke-server.rip)"
	echo ""
	"$OUT" "rip://localhost:4214"
fi
