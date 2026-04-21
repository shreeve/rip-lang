# Drop-in for misc/duckdb/extension/extension_config_local.cmake.
#
# Enables the in-tree autocomplete extension so the stock `duckdb -unsigned`
# built from misc/duckdb/ can exercise the four completion forms listed in
# packages/db/CLI.md (rip.<TAB>, rip.main.<TAB>, rip.table.<TAB>, column
# completion). Not strictly required to build or use the ripdb extension —
# only needed if you want to verify completion end-to-end.
#
# Install:
#   cp packages/db/extension/scripts/duckdb-extension-config.cmake \
#      misc/duckdb/extension/extension_config_local.cmake
#   (cd misc/duckdb && make release)
#
# Kept outside misc/duckdb/ because that subtree is .gitignored.

duckdb_extension_load(autocomplete)
