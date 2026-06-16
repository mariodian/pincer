# Pincer Daemon

A lightweight, always-on Bun HTTP server that runs the same collection pipeline as Pincer and exposes a pull API so Pincer can sync the gap when it wakes up from sleep.

> **Platform support:** macOS arm64 and Linux x86_64 are supported.

## Quick Start

```bash
# One-line install (macOS arm64 / Linux x86_64)
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash

# Install with service (recommended for production)
# Note: DON'T forget to set your own secret here!
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- \
  --service --secret=your-secret-here

# Start manually
export DAEMON_SECRET=your-secret-here
/opt/pincerd/pincerd
```

## Installation

### Option A: One-Line Installer (Recommended)

The install script handles downloading, extracting, and optionally setting up a service (systemd on Linux, launchd on macOS):

```bash
# Install only
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash

# Install with service
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- \
  --service --secret=your-secret-here

# Install with custom port and user
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- \
  --service --secret=my-secret --port=8080 --user=pincer

# Uninstall
curl -fsSL https://raw.githubusercontent.com/mariodian/pincer/HEAD/daemon/install.sh | bash -s -- \
  --uninstall
```

**Script options:**

| Flag                | Description                                   |
| ------------------- | --------------------------------------------- |
| `--service`         | Install and enable service (systemd on Linux, launchd on macOS) |
| `--uninstall`       | Uninstall the daemon and remove service       |
| `--secret=<token>`  | Set DAEMON_SECRET (Bearer token for API auth) |
| `--port=<number>`   | Set DAEMON_PORT (default: 7378)               |
| `--user=<username>` | User to run daemon as (default: current user) |
| `--help, -h`        | Show help message                             |

**Environment variables** (alternative to flags):

| Variable        | Description        |
| --------------- | ------------------ |
| `DAEMON_SECRET` | Same as `--secret` |
| `DAEMON_PORT`   | Same as `--port`   |
| `PINCERD_USER`  | Same as `--user`   |

**Requirements:** macOS arm64 or Linux x86_64, `curl`, `tar`, `sudo`.

### Option B: Download from GitHub Releases

```bash
VERSION="v0.3.4"  # Change to desired version

# macOS arm64
curl -L -o /tmp/pincerd.tar.gz \
  "https://github.com/mariodian/pincer/releases/download/${VERSION}/pincerd-${VERSION}-macos-arm64.tar.gz"

# Linux x86_64
curl -L -o /tmp/pincerd.tar.gz \
  "https://github.com/mariodian/pincer/releases/download/${VERSION}/pincerd-${VERSION}-linux-x64.tar.gz"

sudo mkdir -p /opt
sudo tar -xzf /tmp/pincerd.tar.gz -C /opt

# macOS: remove quarantine
sudo xattr -dr com.apple.quarantine /opt/pincerd/pincerd

# The installed directory contains:
# - /opt/pincerd/pincerd (binary)
# - /opt/pincerd/drizzle/migrations/ (database migrations)
# - /opt/pincerd/version.json (version metadata)
```

### Option C: Homebrew (macOS)

```bash
brew tap mariodian/tap
brew install pincerd

# Start the service after setting DAEMON_SECRET
brew services edit pincerd   # add DAEMON_SECRET to environment
brew services start pincerd
```

### Option D: Build from Source

If you have the Pincer source repository:

```bash
# From the project root
bun run daemon:bundle

# Install to /opt
sudo cp -R daemon/dist/pincerd /opt/
```

## Configuration

The daemon is configured via environment variables:

| Variable              | Default                                | Description                                  |
| --------------------- | -------------------------------------- | -------------------------------------------- |
| `DAEMON_SECRET`       | _required_                             | Bearer token for API authentication          |
| `DAEMON_PORT`         | `7378`                                 | HTTP server port                             |
| `DAEMON_CHANNEL`      | auto-detected                          | Storage channel (`stable`, `dev`, `canary`)  |
| `DB_PATH`             | `<app-data>/<channel>/daemon.db`       | SQLite database path                         |
| `POLLING_INTERVAL_MS` | `15000`                                | Health check interval                        |
| `DAEMON_LOG_LEVEL`    | `info`                                 | Log level (`debug`, `info`, `warn`, `error`) |
| `DAEMON_FILE_LOGGING` | `false` (prod), `true` (dev)           | Enable file logging                          |
| `LOG_FILE_PATH`       | `<app-data>/<channel>/logs/daemon.log` | Log file path                                |

Channel is resolved in this order:

1. `DAEMON_CHANNEL` environment variable
2. Version suffix (e.g., `0.3.4-dev` → `canary`)
3. Auto-detection from runtime context
4. Fallback to `stable`

### Logging Presets

**Production (minimal logging):**

```bash
export NODE_ENV=production
export DAEMON_LOG_LEVEL=warn
export DAEMON_FILE_LOGGING=false
```

**Production with file logging:**

```bash
export NODE_ENV=production
export DAEMON_LOG_LEVEL=info
export DAEMON_FILE_LOGGING=true
export LOG_FILE_PATH=/var/log/pincerd/daemon.log
```

## Running the Daemon

### With launchd (macOS)

Create `/Library/LaunchDaemons/com.mariodian.pincerd.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mariodian.pincerd</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/pincerd/pincerd</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/opt/pincerd</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DAEMON_SECRET</key>
        <string>your-secret-here</string>
        <key>DAEMON_PORT</key>
        <string>7378</string>
    </dict>
    <key>UserName</key>
    <string>your-user</string>
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
```

Load and start:

```bash
sudo launchctl bootstrap system /Library/LaunchDaemons/com.mariodian.pincerd.plist
```

Manage:

```bash
# Check status
sudo launchctl print system/com.mariodian.pincerd

# Stop and unload
sudo launchctl bootout system/com.mariodian.pincerd

# View logs
tail -f /var/log/pincerd.log
```

### With systemd (Linux)

Create `/etc/systemd/system/pincerd.service`:

```ini
[Unit]
Description=Pincer Daemon
After=network.target

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/opt/pincerd
Environment=DAEMON_SECRET=your-secret-here
Environment=DAEMON_PORT=7378
ExecStart=/opt/pincerd/pincerd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pincerd
sudo systemctl start pincerd
```

### With PM2

```bash
export DAEMON_SECRET=your-secret-here
export DAEMON_PORT=7378
pm2 start /opt/pincerd/pincerd --name pincerd
pm2 save
```

## API Reference

All endpoints require Bearer token authentication: `Authorization: Bearer <DAEMON_SECRET>`

### GET /health

Returns daemon status and uptime.

**Response:**

```json
{
  "status": "ok",
  "version": "0.3.4",
  "uptime": 3600
}
```

### GET /agents

Returns list of all configured agents.

### PUT /agents

Replaces the entire agent list.

**Body:** Array of agent objects

### GET /checks?since=&lt;ms&gt;&limit=&lt;n&gt;

Returns health checks since the given timestamp (milliseconds since epoch).

### GET /stats?since=&lt;ms&gt;

Returns hourly statistics since the given timestamp.

### GET /incident-events?since=&lt;ms&gt;

Returns incident events since the given timestamp.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Pincer (GUI)  │         │   pincerd        │
│                 │  sync   │                  │
│  - Agent list   │───────▶│  - Collector     │
│  - Analyzer     │         │  - No UI/LLM     │
│  - Source of    │◀───────│  - SQLite + HTTP │
│    truth        │  pull   │                  │
└─────────────────┘         └──────────────────┘
```

The daemon runs the same health check pipeline as the desktop app but without any UI. It stores checks and stats in its own SQLite database and exposes an HTTP API for the Pincer app to sync data when it connects.

## Development

If you're working on the daemon source code, see [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup. The daemon uses dependencies from the root `package.json`:

```bash
# Run daemon in development
bun run daemon:start

# Build daemon binary
bun run daemon:bundle
```
