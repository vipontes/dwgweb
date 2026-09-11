#!/usr/bin/env bash
# Builds the DXF/DWG parser (dwgviewer's Qt-free model: libdxfrw +
# dwg_document.h/.cpp) to WebAssembly via Emscripten. No Qt anywhere in this
# build -- only the parsing/document layer, plus bindings.cpp's embind glue.
#
# native/dwg_document.{h,cpp} and third_party/libdxfrw are vendored straight
# into this repo (originally from the sibling dwgviewer project) so this
# package has no external checkout dependency -- everything needed to
# rebuild the WASM parser lives under this directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_DIR="${SCRIPT_DIR}/../native"
LIBDXFRW_DIR="${SCRIPT_DIR}/../third_party/libdxfrw"
OUT_DIR="${SCRIPT_DIR}/../src/wasm"

if ! command -v em++ >/dev/null 2>&1; then
    echo "error: em++ not found on PATH -- source emsdk_env.sh first" >&2
    exit 1
fi
if [ ! -f "${NATIVE_DIR}/dwg_document.cpp" ]; then
    echo "error: dwg_document.cpp not found under ${NATIVE_DIR}" >&2
    exit 1
fi

mkdir -p "${OUT_DIR}"

BUILD_MODE="${1:-release}" # release (default) or debug
OPT_FLAGS=(-O3)
if [ "${BUILD_MODE}" = "debug" ]; then
    OPT_FLAGS=(-O0 -g -s ASSERTIONS=1 -s SAFE_HEAP=1)
fi

# shellcheck disable=SC2046
em++ \
    "${NATIVE_DIR}/dwg_document.cpp" \
    "${SCRIPT_DIR}/bindings.cpp" \
    $(find "${LIBDXFRW_DIR}/src" -name '*.cpp') \
    -I "${NATIVE_DIR}" \
    -I "${LIBDXFRW_DIR}/src" \
    -std=c++17 \
    -fexceptions \
    "${OPT_FLAGS[@]}" \
    --bind \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME=createDwgParserModule \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT=web \
    -s EXPORTED_RUNTIME_METHODS='["FS"]' \
    -o "${OUT_DIR}/dwgparser.js"

echo "wrote ${OUT_DIR}/dwgparser.js + dwgparser.wasm"
