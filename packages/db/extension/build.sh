#!/usr/bin/env bash
# =============================================================================
# build.sh — Build the standalone rip-db decoder test harness.
#
# Commit 1 scope: NO DuckDB linkage. This only builds decoder.cpp +
# decoder_test.cpp into a single binary that walks test/fixtures/ and
# asserts round-trip correctness on captured byte fixtures.
#
# Usage:
#   ./build.sh            # build and run the test harness
#   ./build.sh --no-run   # build only
# =============================================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${HERE}/decoder_test"

CXX="${CXX:-clang++}"

set -x
"${CXX}" \
  -std=c++17 \
  -O2 \
  -g \
  -Wall \
  -Wextra \
  -Wno-unused-parameter \
  -Wno-unused-function \
  -Wno-switch \
  "${HERE}/decoder.cpp" \
  "${HERE}/decoder_test.cpp" \
  -o "${OUT}"
set +x

echo "built ${OUT} ($(wc -c < "${OUT}") bytes)"

if [[ "${1:-}" != "--no-run" ]]; then
  "${OUT}" "${HERE}/test/fixtures"
fi
