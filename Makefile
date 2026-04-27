# Top-level forwarding Makefile.
#
# The actual ripdb DuckDB extension build lives in packages/db/ — that
# directory matches the standard DuckDB extension-repo layout (Makefile,
# extension_config.cmake, vcpkg.json, duckdb/ submodule, extension-ci-tools/
# submodule). To keep rip-lang's root clean while staying compatible with
# DuckDB's upstream reusable GitHub workflow (which runs `make ...` at the
# repo root and offers no working-directory override), this file forwards
# every target to packages/db/.
#
# Both `make release` from repo root and `cd packages/db && make release`
# do the same thing.

.DEFAULT_GOAL := all

%:
	@$(MAKE) -C packages/db $@
