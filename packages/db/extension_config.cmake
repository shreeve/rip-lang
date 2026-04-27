# Points DuckDB's build system at the ripdb extension. This config file
# lives in the same directory as the Makefile and the duckdb/ submodule,
# so SOURCE_DIR is the sibling extension/ directory.
#
# DONT_LINK = ship a loadable .duckdb_extension (end users INSTALL at runtime),
# not statically linked into the duckdb binary itself.
duckdb_extension_load(ripdb
    SOURCE_DIR ${CMAKE_CURRENT_LIST_DIR}/extension
    DONT_LINK
)
