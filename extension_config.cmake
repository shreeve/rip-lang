# Points DuckDB's build system at the ripdb extension. The sources live in
# packages/db/extension/ (monorepo layout), so SOURCE_DIR is that path
# relative to repo root.
#
# DONT_LINK = ship a loadable .duckdb_extension (end users INSTALL at runtime),
# not statically linked into the duckdb binary itself.
duckdb_extension_load(ripdb
    SOURCE_DIR ${CMAKE_CURRENT_LIST_DIR}/packages/db/extension
    DONT_LINK
)
