#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WINDOW_EFFECTS_FILE="$ROOT_DIR/native/macos/window-effects.mm"
SYSTEM_FILE="$ROOT_DIR/native/macos/system.mm"
OUT_FILE="$ROOT_DIR/src/bun/libs/libMacOS.dylib"

# On non-macOS, create a placeholder
if [[ "$(uname -s)" != "Darwin" ]]; then
	mkdir -p "$(dirname "$OUT_FILE")"
	: >"$OUT_FILE"
	echo "Created placeholder native macOS lib: $OUT_FILE"
	exit 0
fi

# Check source files exist
if [[ ! -f "$WINDOW_EFFECTS_FILE" ]]; then
	echo "Missing source file: $WINDOW_EFFECTS_FILE"
	exit 1
fi

if [[ ! -f "$SYSTEM_FILE" ]]; then
	echo "Missing source file: $SYSTEM_FILE"
	exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

# Compile both window-effects.mm and system.mm into a single dylib
# system.mm requires ServiceManagement framework for SMAppService API
xcrun clang++ -dynamiclib -fobjc-arc \
	-framework Cocoa \
	-framework ServiceManagement \
	"$WINDOW_EFFECTS_FILE" \
	"$SYSTEM_FILE" \
	-o "$OUT_FILE"

echo "Built native macOS lib: $OUT_FILE"
