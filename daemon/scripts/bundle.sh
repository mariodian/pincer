#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${DAEMON_DIR}/dist"
BUNDLE_DIR="${DIST_DIR}/pincerd"
BINARY_PATH="${BUNDLE_DIR}/pincerd"

cleanup_bun_build_artifacts() {
	find "${DAEMON_DIR}" -maxdepth 1 \( -name '*.bun-build' -o -name '.*.bun-build' \) -exec rm -f {} +
}

mkdir -p "${DIST_DIR}"
rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}"

cleanup_bun_build_artifacts

bun build --compile "${DAEMON_DIR}/index.ts" --outfile "${BINARY_PATH}"
cleanup_bun_build_artifacts

cp -R "${DAEMON_DIR}/migrations" "${BUNDLE_DIR}/migrations"
cp "${DAEMON_DIR}/package.json" "${BUNDLE_DIR}/package.json"

cat > "${BUNDLE_DIR}/README.txt" <<'EOF'
Pincer Daemon Bundle

Contents:
- pincerd (standalone binary)
- migrations/ (required for DB migrations)
- package.json (used for version metadata)

Run example:
DAEMON_SECRET=your-secret ./pincerd
EOF

echo "Bundle created at: ${BUNDLE_DIR}"
ls -la "${BUNDLE_DIR}"
