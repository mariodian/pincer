#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="$(cd "${DAEMON_DIR}/.." && pwd)"
DIST_DIR="${DAEMON_DIR}/dist"
BUNDLE_DIR="${DIST_DIR}/pincerd"
BINARY_PATH="${BUNDLE_DIR}/pincerd"

cleanup_bun_build_artifacts() {
	# Clean up in both daemon dir and project root (where bun build puts them when run from root)
	find "${DAEMON_DIR}" -maxdepth 1 \( -name '*.bun-build' -o -name '.*.bun-build' \) -exec rm -f {} + 2>/dev/null || true
	find "${PROJECT_DIR}" -maxdepth 1 \( -name '*.bun-build' -o -name '.*.bun-build' \) -exec rm -f {} + 2>/dev/null || true
}

mkdir -p "${DIST_DIR}"
rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}"

cleanup_bun_build_artifacts

bun build --compile "${DAEMON_DIR}/index.ts" --outfile "${BINARY_PATH}"
cleanup_bun_build_artifacts

# Copy migrations
cp -R "${DAEMON_DIR}/migrations" "${BUNDLE_DIR}/migrations"

# Generate version.json from root package.json
VERSION=$(node -p "require('${PROJECT_DIR}/package.json').version")
echo "{\"version\": \"${VERSION}\"}" > "${BUNDLE_DIR}/version.json"

cat > "${BUNDLE_DIR}/README.txt" <<'EOF'
Pincer Daemon Bundle

Contents:
- pincerd (standalone binary)
- migrations/ (required for DB migrations)
- version.json (used for version metadata)

Run example:
DAEMON_SECRET=your-secret ./pincerd
EOF

echo "Bundle created at: ${BUNDLE_DIR}"
ls -la "${BUNDLE_DIR}"
