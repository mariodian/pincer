#!/usr/bin/env bash
set -euo pipefail

# Pincer Daemon Install/Update Script
# Usage: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash
# Usage with systemd: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- --systemd
# Usage with custom options: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- --systemd --secret=mysecret --port=7378 --user=pincer

INSTALL_DIR="/opt/pincerd"
TMP_DIR="/tmp"
REPO="mariodian/pincer"
INSTALL_SCRIPT="https://raw.githubusercontent.com/${REPO}/HEAD/daemon/install.sh"
BINARY_NAME="pincerd"
SERVICE_NAME="pincerd"
SYSTEMD_UNIT="/etc/systemd/system/${SERVICE_NAME}.service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables (can be overridden via env or flags)
INSTALL_SYSTEMD=false
DAEMON_SECRET="${DAEMON_SECRET:-}"
DAEMON_PORT="${DAEMON_PORT:-7378}"
RUN_USER="${PINCERD_USER:-}"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --systemd)
      INSTALL_SYSTEMD=true
      ;;
    --secret=*)
      DAEMON_SECRET="${arg#*=}"
      ;;
    --port=*)
      DAEMON_PORT="${arg#*=}"
      ;;
    --user=*)
      RUN_USER="${arg#*=}"
      ;;
    --help|-h)
      cat << EOF
Usage: install.sh [OPTIONS]

Install or update Pincer Daemon to /opt/pincerd.

Options:
  --systemd              Install and enable systemd service
  --secret=<token>       Set DAEMON_SECRET (Bearer token for API auth)
  --port=<number>        Set DAEMON_PORT (default: 7378)
  --user=<username>      User to run daemon as (default: current user)
  --help, -h             Show this help message

Environment variables:
  DAEMON_SECRET          Same as --secret
  DAEMON_PORT            Same as --port
  PINCERD_USER           Same as --user

Examples:
  # Install only
  curl -fsSL $INSTALL_SCRIPT | bash

  # Install with systemd service
  curl -fsSL $INSTALL_SCRIPT | bash -s -- --systemd

  # Install with custom secret and port
  curl -fsSL $INSTALL_SCRIPT | bash -s -- --systemd --secret=my-secret --port=8080
EOF
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check if running on Linux
if [[ "$(uname -s)" != "Linux" ]]; then
  echo -e "${RED}Error: This script only supports Linux.${NC}"
  exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" ]]; then
  echo -e "${RED}Error: Only x86_64 architecture is supported. Detected: $ARCH${NC}"
  exit 1
fi

# Check for required commands
for cmd in curl tar sudo; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}Error: '$cmd' is required but not installed.${NC}"
    exit 1
  fi
done

echo -e "${GREEN}=== Pincer Daemon Installer ===${NC}"

# Download latest release
echo "Downloading latest release..."
TAG=$(curl -s https://api.github.com/repos/${REPO}/releases/latest | grep -o '"tag_name": "[^"]*"' | grep -o 'v[^"]*')
PACKAGE="${BINARY_NAME}-${TAG}-linux-x64.tar.gz"
RELEASE_URL="https://github.com/${REPO}/releases/download/${TAG}/${PACKAGE}"

TARBALL="$TMP_DIR/${PACKAGE}"
if ! curl -fsSL -o "$TARBALL" "$RELEASE_URL"; then
  echo -e "${RED}Error: Failed to download release from $RELEASE_URL${NC}"
  exit 1
fi

# Extract to temp location first
EXTRACT_DIR="$TMP_DIR/pincerd-extract-$$"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"

if ! tar -xzf "$TARBALL" -C "$EXTRACT_DIR"; then
  echo -e "${RED}Error: Failed to extract tarball.${NC}"
  rm -f "$TARBALL"
  exit 1
fi

# Determine if this is an install or update
IS_UPDATE=false
if [[ -d "$INSTALL_DIR" && -f "$INSTALL_DIR/$BINARY_NAME" ]]; then
  IS_UPDATE=true
  echo -e "${YELLOW}Existing installation detected. Updating...${NC}"

  # Check if daemon is currently running
  if pgrep -f "$INSTALL_DIR/$BINARY_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}Daemon is running. Stopping before update...${NC}"
    sudo pkill -f "$INSTALL_DIR/$BINARY_NAME" || true
    sleep 2

    # Verify it stopped
    if pgrep -f "$INSTALL_DIR/$BINARY_NAME" > /dev/null 2>&1; then
      echo -e "${RED}Error: Failed to stop running daemon. Please stop it manually and try again.${NC}"
      exit 1
    fi
  fi
fi

# Install to /opt
echo "Installing to $INSTALL_DIR..."
sudo mkdir -p "$(dirname "$INSTALL_DIR")"

# Remove old installation if exists
if [[ -d "$INSTALL_DIR" ]]; then
  sudo rm -rf "$INSTALL_DIR"
fi

# Move extracted files to install location
# The tarball contains a 'pincerd' directory
if [[ -d "$EXTRACT_DIR/$BINARY_NAME" ]]; then
  sudo mv "$EXTRACT_DIR/$BINARY_NAME" "$INSTALL_DIR"
else
  # Fallback: if tarball doesn't contain directory, create it
  sudo mkdir -p "$INSTALL_DIR"
  sudo mv "$EXTRACT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || true
fi

# Clean up
rm -f "$TARBALL"
rm -rf "$EXTRACT_DIR"

# Set permissions
sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Verify installation
if [[ ! -f "$INSTALL_DIR/$BINARY_NAME" ]]; then
  echo -e "${RED}Error: Installation failed. Binary not found at $INSTALL_DIR/$BINARY_NAME${NC}"
  exit 1
fi

# Get installed version
VERSION="unknown"
if [[ -f "$INSTALL_DIR/version.json" ]]; then
  VERSION=$( grep -o '"version": "[^"]*"' "$INSTALL_DIR/version.json" | grep -o '[0-9][^"]*' || echo "unknown")
fi

echo -e "${GREEN}Successfully installed Pincer Daemon ${BLUE}$VERSION${GREEN} to $INSTALL_DIR${NC}"

# Handle systemd installation
if [[ "$INSTALL_SYSTEMD" == true ]]; then
  echo ""
  echo -e "${GREEN}=== Setting up systemd service ===${NC}"

  # Check if systemd is available
  if [[ ! -d "/run/systemd/system" ]] && [[ ! -d "/sys/fs/cgroup/systemd" ]]; then
    echo -e "${RED}Error: systemd is not available on this system.${NC}"
    exit 1
  fi

  # Get DAEMON_SECRET
  if [[ -z "$DAEMON_SECRET" ]]; then
    if [[ -t 0 ]]; then
      # Interactive — prompt as before
      echo -n "Enter DAEMON_SECRET: "
      read -s DAEMON_SECRET
      echo ""
    else
      # Non-interactive (curl | bash) — show guidance
      echo -e "${RED}Error: DAEMON_SECRET is required when using --systemd.${NC}"
      echo ""
      echo "Provide it via one of these methods:"
      echo "  curl -fsSL ... | bash -s -- --systemd --secret=your-secret-here"
      echo "  DAEMON_SECRET=your-secret-here curl -fsSL ... | bash -s -- --systemd"
      exit 1
    fi

    # Validate after either path
    if [[ -z "$DAEMON_SECRET" ]]; then
      echo -e "${RED}Error: DAEMON_SECRET is required.${NC}"
      exit 1
    fi
  fi

  # Get running user
  if [[ -z "$RUN_USER" ]]; then
    RUN_USER="$USER"
  fi

  if [[ "$RUN_USER" == "root" ]]; then
    echo -e "${YELLOW}Warning: Running as root. Consider creating a dedicated user for the daemon.${NC}"
  fi

  # Check if user exists
  if ! id "$RUN_USER" &> /dev/null; then
    echo -e "${RED}Error: User '$RUN_USER' does not exist.${NC}"
    exit 1
  fi

  # Create systemd service file
  echo "Creating systemd service file..."
  sudo tee "$SYSTEMD_UNIT" > /dev/null << EOF
[Unit]
Description=Pincer Daemon
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$INSTALL_DIR
Environment=DAEMON_SECRET=$DAEMON_SECRET
Environment=DAEMON_PORT=$DAEMON_PORT
ExecStart=$INSTALL_DIR/$BINARY_NAME
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  # Reload systemd and enable service
  echo "Enabling and starting service..."
  sudo systemctl daemon-reload
  sudo systemctl enable "$SERVICE_NAME"

  # Start or restart service
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    sudo systemctl restart "$SERVICE_NAME"
  else
    sudo systemctl start "$SERVICE_NAME"
  fi

  # Verify service is running
  sleep 2
  if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}Systemd service is running.${NC}"
    echo ""
    echo "Service management commands:"
    echo "  sudo systemctl status $SERVICE_NAME    # Check status"
    echo "  sudo systemctl stop $SERVICE_NAME      # Stop service"
    echo "  sudo systemctl restart $SERVICE_NAME   # Restart service"
    echo "  sudo journalctl -u $SERVICE_NAME -f    # View logs"
  else
    echo -e "${RED}Error: Service failed to start. Check logs with: sudo journalctl -u $SERVICE_NAME -e${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
if [[ "$INSTALL_SYSTEMD" != true ]]; then
  echo ""
  echo "To start the daemon manually:"
  echo "  export DAEMON_SECRET=your-secret-here"
  echo "  $INSTALL_DIR/$BINARY_NAME"
  echo ""
  echo "To install as a systemd service, run:"
  echo "  curl -fsSL $INSTALL_SCRIPT | bash -s -- --systemd --secret=your-secret-here"
fi
