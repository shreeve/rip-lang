PROJ_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Configuration of the ripdb DuckDB extension.
EXT_NAME=ripdb
EXT_CONFIG=${PROJ_DIR}extension_config.cmake

# Include the reusable makefile shipped by DuckDB's extension-ci-tools.
# This drives the in-tree build (against the pinned duckdb submodule) that
# produces a properly-linked .duckdb_extension on every platform — the
# supported path for extensions that subclass internal C++ catalog classes.
#
# Submodules live under vendor/ (see .gitmodules); both upstream paths
# referenced by extension-ci-tools (`./duckdb` and `./extension-ci-tools`)
# need to be findable from the Makefile's resolve roots, which the
# DUCKDB_PLATFORM / DUCKDB_GIT_VERSION variables and the included Makefile
# walk relative to PROJ_DIR. Set them explicitly so the included Makefile
# stops looking at the (now-empty) top-level paths.
DUCKDB_SRCDIR ?= ${PROJ_DIR}vendor/duckdb
EXT_CI_TOOLS  ?= ${PROJ_DIR}vendor/extension-ci-tools
include ${EXT_CI_TOOLS}/makefiles/duckdb_extension.Makefile
