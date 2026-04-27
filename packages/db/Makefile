PROJ_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Configuration of the ripdb DuckDB extension.
EXT_NAME=ripdb
EXT_CONFIG=${PROJ_DIR}extension_config.cmake

# Include the reusable makefile shipped by DuckDB's extension-ci-tools.
# This drives the in-tree build (against the pinned duckdb submodule) that
# produces a properly-linked .duckdb_extension on every platform — the
# supported path for extensions that subclass internal C++ catalog classes.
#
# Submodules live next to this Makefile (matches DuckDB's standard
# extension-repo layout), so default paths in the included makefile —
# `./duckdb/` for DUCKDB_SRCDIR and `./extension-ci-tools/` for the
# include — resolve correctly without overrides.
include extension-ci-tools/makefiles/duckdb_extension.Makefile
