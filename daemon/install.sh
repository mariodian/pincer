#!/usr/bin/env bash
set -euo pipefail

# Pincer Daemon Install/Update Script
# Usage: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash
# Usage with service: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- --service
# Usage with custom options: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- --service --secret=mysecret --port=7378 --user=pincer
# Uninstall: curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- --uninstall

INSTALL_DIR="/opt/pincerd"
TMP_DIR="/tmp"
REPO="mariodian/pincer"
INSTALL_SCRIPT="https://raw.githubusercontent.com/${REPO}/HEAD/daemon/install.sh"
BINARY_NAME="pincerd"

# Service identifiers
SYSTEMD_SERVICE_NAME="pincerd"
SYSTEMD_UNIT="/etc/systemd/system/${SYSTEMD_SERVICE_NAME}.service"
LAUNCHD_LABEL="com.mariodian.pincerd"
LAUNCHD_PLIST="/Library/LaunchDaemons/${LAUNCHD_LABEL}.plist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration variables (can be overridden via env or flags)
INSTALL_SERVICE=false
UNINSTALL=false
DAEMON_SECRET="${DAEMON_SECRET:-}"
DAEMON_PORT="${DAEMON_PORT:-7378}"
RUN_USER="${PINCERD_USER:-}"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --service)
      INSTALL_SERVICE=true
      ;;
    --systemd)
      INSTALL_SERVICE=true
      ;;
    --uninstall)
      UNINSTALL=true
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
  --service              Install and enable service (systemd on Linux, launchd on macOS)
  --systemd              Alias for --service (backward compatibility)
  --uninstall            Uninstall the daemon and remove service
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

  # Install with service
  curl -fsSL $INSTALL_SCRIPT | bash -s -- --service

  # Install with custom secret and port
  curl -fsSL $INSTALL_SCRIPT | bash -s -- --service --secret=my-secret --port=8080

  # Uninstall
  curl -fsSL $INSTALL_SCRIPT | bash -s -- --uninstall
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

# Detect platform
PLATFORM="$(uname -s)"
ARCH="$(uname -m)"

# Check for required commands
for cmd in curl tar sudo; do
  if ! command -v "$cmd" &> /dev/null; then
    echo -e "${RED}Error: '$cmd' is required but not installed.${NC}"
    exit 1
  fi
done

echo -e "${GREEN}=== Pincer Daemon Installer ===${NC}"

# Handle uninstall
if [[ "$UNINSTALL" == true ]]; then
  echo -e "${YELLOW}Uninstalling Pincer Daemon...${NC}"

  if [[ "$PLATFORM" == "Linux" ]]; then
    # Stop and remove systemd service
    if [[ -f "$SYSTEMD_UNIT" ]]; then
      echo "Stopping systemd service..."
      sudo systemctl stop "$SYSTEMD_SERVICE_NAME" 2>/dev/null || true
      sudo systemctl disable "$SYSTEMD_SERVICE_NAME" 2>/dev/null || true
      sudo rm -f "$SYSTEMD_UNIT"
      sudo systemctl daemon-reload
    fi
  elif [[ "$PLATFORM" == "Darwin" ]]; then
    # Stop and remove launchd service
    if [[ -f "$LAUNCHD_PLIST" ]]; then
      echo "Stopping launchd service..."
      sudo launchctl bootout system "$LAUNCHD_LABEL" 2>/dev/null || true
      sudo rm -f "$LAUNCHD_PLIST"
    fi
  fi

  # Remove installation directory
  if [[ -d "$INSTALL_DIR" ]]; then
    echo "Removing $INSTALL_DIR..."
    sudo rm -rf "$INSTALL_DIR"
  fi

  echo -e "${GREEN}Uninstall complete.${NC}"
  exit 0
fi

# Validate platform and architecture
if [[ "$PLATFORM" == "Linux" ]]; then
  if [[ "$ARCH" != "x86_64" ]]; then
    echo -e "${RED}Error: Only x86_64 architecture is supported on Linux. Detected: $ARCH${NC}"
    exit 1
  fi
  PLATFORM_SUFFIX="linux-x64"
elif [[ "$PLATFORM" == "Darwin" ]]; then
  if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${RED}Error: Only arm64 architecture is supported on macOS. Detected: $ARCH${NC}"
    exit 1
  fi
  PLATFORM_SUFFIX="macos-arm64"
else
  echo -e "${RED}Error: Unsupported platform: $PLATFORM. Supported: Linux, Darwin (macOS).${NC}"
  exit 1
fi

# Download latest release
echo "Downloading latest release..."
TAG=$(curl -s https://api.github.com/repos/${REPO}/releases/latest | grep -o '"tag_name": "[^"]*"' | grep -o 'v[^"]*')
PACKAGE="${BINARY_NAME}-${TAG}-${PLATFORM_SUFFIX}.tar.gz"
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

    if [[ "$PLATFORM" == "Linux" ]]; then
      sudo systemctl stop "$SYSTEMD_SERVICE_NAME" 2>/dev/null || sudo pkill -f "$INSTALL_DIR/$BINARY_NAME" || true
    elif [[ "$PLATFORM" == "Darwin" ]]; then
      sudo launchctl bootout system "$LAUNCHD_LABEL" 2>/dev/null || sudo pkill -f "$INSTALL_DIR/$BINARY_NAME" || true
    fi

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

# Remove quarantine on macOS
if [[ "$PLATFORM" == "Darwin" ]]; then
  sudo xattr -dr com.apple.quarantine "$INSTALL_DIR/$BINARY_NAME" 2>/dev/null || true
fi

# Verify installation
if [[ ! -f "$INSTALL_DIR/$BINARY_NAME" ]]; then
  echo -e "${RED}Error: Installation failed. Binary not found at $INSTALL_DIR/$BINARY_NAME${NC}"
  exit 1
fi

# Get installed version
VERSION="unknown"
if [[ -f "$INSTALL_DIR/version.json" ]]; then
  VERSION=$(grep -o '"version": "[^"]*"' "$INSTALL_DIR/version.json" | grep -o '[0-9][^"]*' || echo "unknown")
fi

echo -e "${GREEN}Successfully installed Pincer Daemon ${BLUE}$VERSION${GREEN} to $INSTALL_DIR${NC}"

# Handle service installation
if [[ "$INSTALL_SERVICE" == true ]]; then
  echo ""
  echo -e "${GREEN}=== Setting up service ===${NC}"

  # Get DAEMON_SECRET
  if [[ -z "$DAEMON_SECRET" ]]; then
    if [[ -t 0 ]]; then
      # Interactive — prompt as before
      echo -n "Enter DAEMON_SECRET: "
      read -s DAEMON_SECRET
      echo ""
    else
      # Non-interactive (curl | bash) — show guidance
      echo -e "${RED}Error: DAEMON_SECRET is required when using --service.${NC}"
      echo ""
      echo "Provide it via one of these methods:"
      echo "  curl -fsSL ... | bash -s -- --service --secret=your-secret-here"
      echo "  DAEMON_SECRET=your-secret-here curl -fsSL ... | bash -s -- --service"
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

  if [[ "$PLATFORM" == "Linux" ]]; then
    # Check if systemd is available
    if [[ ! -d "/run/systemd/system" ]] && [[ ! -d "/sys/fs/cgroup/systemd" ]]; then
      echo -e "${RED}Error: systemd is not available on this system.${NC}"
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
    sudo systemctl enable "$SYSTEMD_SERVICE_NAME"

    # Start or restart service
    if systemctl is-active --quiet "$SYSTEMD_SERVICE_NAME" 2>/dev/null; then
      sudo systemctl restart "$SYSTEMD_SERVICE_NAME"
    else
      sudo systemctl start "$SYSTEMD_SERVICE_NAME"
    fi

    # Verify service is running
    sleep 2
    if sudo systemctl is-active --quiet "$SYSTEMD_SERVICE_NAME"; then
      echo -e "${GREEN}Systemd service is running.${NC}"
      echo ""
      echo "Service management commands:"
      echo "  sudo systemctl status $SYSTEMD_SERVICE_NAME    # Check status"
      echo "  sudo systemctl stop $SYSTEMD_SERVICE_NAME      # Stop service"
      echo "  sudo systemctl restart $SYSTEMD_SERVICE_NAME   # Restart service"
      echo "  sudo journalctl -u $SYSTEMD_SERVICE_NAME -f    # View logs"
    else
      echo -e "${RED}Error: Service failed to start. Check logs with: sudo journalctl -u $SYSTEMD_SERVICE_NAME -e${NC}"
      exit 1
    fi

  elif [[ "$PLATFORM" == "Darwin" ]]; then
    # Create launchd plist
    echo "Creating launchd plist..."
    sudo tee "$LAUNCHD_PLIST" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LAUNCHD_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$INSTALL_DIR/$BINARY_NAME</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DAEMON_SECRET</key>
        <string>$DAEMON_SECRET</string>
        <key>DAEMON_PORT</key>
        <string>$DAEMON_PORT</string>
    </dict>
    <key>UserName</key>
    <string>$RUN_USER</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/pincerd.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/pincerd.log</string>
</dict>
</plist>
EOF

    # Set permissions on plist
    sudo chmod 644 "$LAUNCHD_PLIST"

    # Create log file with correct permissions
    sudo touch /var/log/pincerd.log
    sudo chown "$RUN_USER":staff /var/log/pincerd.log

    # Load and start service
    echo "Loading and starting service..."
    sudo launchctl bootstrap system "$LAUNCHD_PLIST"

    # Verify service is running
    sleep 2
    if launchctl print system/"$LAUNCHD_LABEL" &> /dev/null; then
      echo -e "${GREEN}Launchd service is running.${NC}"
      echo ""
      echo "Service management commands:"
      echo "  sudo launchctl print system/$LAUNCHD_LABEL     # Check status"
      echo "  sudo launchctl bootout system/$LAUNCHD_LABEL   # Stop and unload service"
      echo "  sudo launchctl bootstrap system $LAUNCHD_PLIST # Start service"
      echo "  tail -f /var/log/pincerd.log                   # View logs"
    else
      echo -e "${RED}Error: Service failed to start. Check logs with: tail /var/log/pincerd.log${NC}"
      exit 1
    fi
  fi
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
if [[ "$INSTALL_SERVICE" != true ]]; then
  echo ""
  echo "To start the daemon manually:"
  echo "  export DAEMON_SECRET=your-secret-here"
  echo "  $INSTALL_DIR/$BINARY_NAME"
  echo ""
  echo "To install as a service, run:"
  echo "  curl -fsSL $INSTALL_SCRIPT | bash -s -- --service --secret=your-secret-here"
fi
