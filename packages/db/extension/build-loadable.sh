#!/usr/bin/env bash
# =============================================================================
# build-loadable.sh — Build ripdb.duckdb_extension (Phase 2B).
#
# Compiles decoder.cpp + ripdb.cpp into a loadable .dylib, then appends the
# 532-byte DuckDB extension metadata footer. The resulting file is loadable
# via `duckdb -unsigned` / `LOAD '/path/to/ripdb.duckdb_extension';`.
#
# Footer layout (from misc/duckdb/scripts/append_metadata.cmake):
#     1 byte  0x00                          (WebAssembly custom-section prefix)
#     2 bytes ULEB128(531) = \x93 \x04       (length of what follows)
#     1 byte  \x10                          (length of name field = 16)
#    16 bytes "duckdb_signature"
#     2 bytes ULEB128(512) = \x80 \x04       (length of metadata + signature)
#   256 bytes signature (256 zero bytes — unsigned)
#     8 × 32  bytes metadata fields, written in REVERSE order on disk:
#              META1 = "4" (magic value — ParsedExtensionMetaData::EXPECTED_MAGIC_VALUE)
#              META2 = platform   e.g. "osx_arm64"
#              META3 = duckdb_version  (SourceID() or release tag)
#              META4 = extension_version
#              META5 = abi_type   ("CPP" for DUCKDB_CPP_EXTENSION_ENTRY)
#              META6, META7, META8 = empty
#
# Output: <HERE>/ripdb.duckdb_extension
#
# Usage:
#   ./build-loadable.sh
#   ./build-loadable.sh --no-metadata    # build dylib only, skip footer
# =============================================================================

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DUCKDB="${DUCKDB_SRC:-$HERE/../../../misc/duckdb}"
BUILD="${DUCKDB_BUILD:-$DUCKDB/build/release}"
DUCKDB_BIN="$BUILD/duckdb"
OUT="$HERE/ripdb.duckdb_extension"
EXT_VERSION="${RIPDB_EXT_VERSION:-0.1.0}"

if [[ ! -x "$DUCKDB_BIN" ]]; then
	echo "error: $DUCKDB_BIN not built. Run 'cd $DUCKDB && make release' first." >&2
	exit 1
fi

DUCKDB_VERSION="$($DUCKDB_BIN -csv -noheader -c 'SELECT source_id FROM pragma_version()' | tr -d '\r\n ')"
# Library version normalized: GetVersionDirectoryName uses SourceID for non-release
# builds (i.e. anything with '-dev' in library_version), otherwise the v-tag.
LIBRARY_VERSION="$($DUCKDB_BIN -csv -noheader -c 'SELECT library_version FROM pragma_version()' | tr -d '\r\n ')"
if [[ "$LIBRARY_VERSION" == *-dev* ]]; then
	FOOTER_DUCKDB_VERSION="$DUCKDB_VERSION"
else
	FOOTER_DUCKDB_VERSION="$LIBRARY_VERSION"
fi
# Platform. Auto-detected from the DuckDB CLI by default, but callers
# (e.g. cross-compilation in CI) can override explicitly by exporting
# OVERRIDE_PLATFORM — in that case, the embedded metadata AND any
# platform-specific compile flags come from the override.
if [[ -n "${OVERRIDE_PLATFORM:-}" ]]; then
	PLATFORM="$OVERRIDE_PLATFORM"
else
	PLATFORM="$($DUCKDB_BIN -csv -noheader -c 'PRAGMA platform' | tr -d '\r\n ')"
fi

echo "# footer metadata:"
echo "#   platform         = $PLATFORM"
echo "#   duckdb_version   = $FOOTER_DUCKDB_VERSION"
echo "#   extension_version= $EXT_VERSION"
echo "#   abi_type         = CPP"

# ----------------------------------------------------------------------------
# 1) Compile + link the shared library.
# ----------------------------------------------------------------------------

CXX="${CXX:-clang++}"
# Extra compile/link flags, word-split so shells pass each token cleanly
# to the compiler. Used by CI to cross-compile osx_amd64 on a macos-latest
# (arm64) runner via `-arch x86_64`. Empty string when unset — safe under
# `set -u` because ${VAR:-} always expands to at least the empty string.

set -x
"$CXX" \
	-std=c++17 \
	-O2 \
	-g \
	-fPIC \
	-shared \
	-Wall \
	-Wno-unused-parameter \
	-Wno-unused-function \
	-Wno-switch \
	${CXXFLAGS:-} \
	-I "$DUCKDB/src/include" \
	-I "$DUCKDB/third_party/yyjson/include" \
	"$HERE/decoder.cpp" \
	"$HERE/ripdb.cpp" \
	-o "$OUT" \
	-Wl,-undefined,dynamic_lookup
set +x

echo "built dylib: $OUT ($(wc -c < "$OUT") bytes)"

if [[ "${1:-}" == "--no-metadata" ]]; then
	exit 0
fi

# ----------------------------------------------------------------------------
# 2) Append the 532-byte metadata footer.
# ----------------------------------------------------------------------------

python3 - "$OUT" "$PLATFORM" "$FOOTER_DUCKDB_VERSION" "$EXT_VERSION" <<'PY'
import sys, struct, os

path, platform, duckdb_ver, ext_ver = sys.argv[1:]

def pad32(s):
    b = s.encode('utf-8')
    if len(b) > 32:
        raise SystemExit(f"metadata field too long: {s!r}")
    return b + b"\x00" * (32 - len(b))

# Per CMake script. Metadata fields written on-disk in REVERSE order:
# the extension loader reverses them back so that [0]="4", [1]=platform, etc.
META1 = "4"                # magic
META2 = platform
META3 = duckdb_ver
META4 = ext_ver
META5 = "CPP"
META6 = ""
META7 = ""
META8 = ""

footer  = b"\x00"                  # custom section marker
footer += b"\x93\x04"              # ULEB128 (531)
footer += bytes([16])              # name length
footer += b"duckdb_signature"      # 16 bytes
footer += b"\x80\x04"              # ULEB128 (512)

# Metadata in reverse order on disk:
footer += pad32(META8)
footer += pad32(META7)
footer += pad32(META6)
footer += pad32(META5)
footer += pad32(META4)
footer += pad32(META3)
footer += pad32(META2)
footer += pad32(META1)

footer += b"\x00" * 256            # zero signature (unsigned)

# 22 bytes of WASM custom-section prefix + 256 bytes metadata + 256 bytes signature.
# The parser only reads the final 512 bytes; the prefix is there so the file is
# also a valid WASM custom section when the extension is loaded under WASM.
assert len(footer) == 1 + 2 + 1 + 16 + 2 + (8 * 32) + 256 == 534, len(footer)

with open(path, 'ab') as f:
    f.write(footer)

print(f"appended {len(footer)}-byte metadata footer — final size {os.path.getsize(path)} bytes")
PY

echo "ok: $OUT"
