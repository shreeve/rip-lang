cmake_minimum_required(VERSION 3.5...3.29)

set(TARGET_NAME ripdb)
project(${TARGET_NAME})

# Silence noisy warnings from DuckDB headers and yyjson that we can't fix
# here. Our own code is warning-clean.
if(NOT MSVC)
    add_compile_options(
        -Wno-unused-parameter
        -Wno-unused-function
        -Wno-switch
    )
endif()

# Our own headers sit next to the sources. yyjson is bundled with duckdb.
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../vendor/duckdb/third_party/yyjson/include
)

set(EXTENSION_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/decoder.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/ripdb.cpp
)

set(EXTENSION_NAME ${TARGET_NAME}_extension)
set(LOADABLE_EXTENSION_NAME ${TARGET_NAME}_loadable_extension)

# DuckDB's extension-build CMake macros. `build_static_extension` produces
# the archive that can be linked into duckdb itself; `build_loadable_extension`
# produces the .duckdb_extension shared object end-users download and LOAD.
build_static_extension(${TARGET_NAME} ${EXTENSION_SOURCES})
build_loadable_extension(${TARGET_NAME} "" ${EXTENSION_SOURCES})

# We rely on C++17 features — structured bindings, __has_include,
# std::for_each with lambdas, inline vars in ripdb.cpp.
set_property(TARGET ${EXTENSION_NAME}          PROPERTY CXX_STANDARD 17)
set_property(TARGET ${LOADABLE_EXTENSION_NAME} PROPERTY CXX_STANDARD 17)

install(
    TARGETS ${EXTENSION_NAME}
    EXPORT "${DUCKDB_EXPORT_SET}"
    LIBRARY DESTINATION "${INSTALL_LIB_DIR}"
    ARCHIVE DESTINATION "${INSTALL_LIB_DIR}"
)
