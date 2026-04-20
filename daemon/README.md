# Pincer Daemon

A lightweight, always-on Bun HTTP server that runs the same collection pipeline as Pincer and exposes a pull API so Pincer can sync the gap when it wakes up from sleep.

> Current support: Linux deployment is supported. Other platforms are not yet officially supported.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Pincer (GUI)  │         │   pincerd        │
│                 │  sync   │                  │
│  - Agent list   │───────▶ │  - Dumb collector│
│  - Analyzer     │         │  - No LLM/No UI  │
│  - Source of    │◀─────── │  - SQLite + HTTP │
│    truth        │  pull   │                  │
└─────────────────┘         └──────────────────┘
```

## Environment Variables

| Variable              | Default                                         | Description                                                           |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `DAEMON_PORT`         | `7378`                                          | HTTP server port                                                      |
| `DAEMON_SECRET`       | _required_                                      | Bearer token for API auth                                             |
| `DAEMON_CHANNEL`      | auto-detected (`stable` fallback)               | Storage channel override (`stable`, `dev`, `canary`, or custom)       |
| `DB_PATH`             | `<app-data>/<app-id>/<channel>/daemon.db`       | SQLite database path (sits next to app DB in channel data directory)  |
| `POLLING_INTERVAL_MS` | `15000`                                         | Health check interval                                                 |
| `DAEMON_LOG_LEVEL`    | `info`                                          | Console log level (`debug`, `info`, `warn`, `error`)                  |
| `DAEMON_FILE_LOGGING` | `true` in development, `false` in production    | Enable/disable file logging (`true/false`, `1/0`, `yes/no`, `on/off`) |
| `LOG_FILE_PATH`       | `<app-data>/<app-id>/<channel>/logs/daemon.log` | File path for daemon logs (used when file logging is enabled)         |

Channel resolution order:

1. `DAEMON_CHANNEL` (explicit override)
2. Daemon version with prerelease suffix (`-...`) -> `canary` (for example `0.3.4-dev`, `0.3.4-alpha.1`)
3. Auto-detection from runtime context (for example Bun/source run -> `dev`, channel directory hints like `/canary/` -> `canary`)
4. Fallback to `stable`

### Logging presets

Development (console info + file logging on):

```bash
export NODE_ENV=development
export DAEMON_LOG_LEVEL=info
export DAEMON_FILE_LOGGING=true
```

Production (console warn + file logging off):

```bash
export NODE_ENV=production
export DAEMON_LOG_LEVEL=warn
export DAEMON_FILE_LOGGING=false
```

Production with file logging enabled:

```bash
export NODE_ENV=production
export DAEMON_LOG_LEVEL=info
export DAEMON_FILE_LOGGING=true
export LOG_FILE_PATH=/var/log/pincerd/daemon.log
```

## Deployment

### 1) Install the daemon bundle

Install the daemon bundle in `/opt/pincerd` using one of these options. This is required for both `systemd` and PM2.

#### Option A: Build locally

```bash
sudo mkdir -p /opt

# Local build output example
sudo cp -R daemon/dist/pincerd /opt/

# The installed directory must contain: pincerd and migrations/
```

#### Option B: Download the release tarball from GitHub

```bash
VERSION="v0.3.4" # change to the version you want
curl -L -o /tmp/pincerd.tar.gz \
	"https://github.com/mariodian/pincer/releases/download/${VERSION}/pincerd-${VERSION}-linux-x64.tar.gz"

sudo mkdir -p /opt
sudo tar -xzf /tmp/pincerd.tar.gz -C /opt

# The installed directory must contain: /opt/pincerd/pincerd and /opt/pincerd/migrations/
```

### 2) Run with systemd (Linux)

```ini
# /etc/systemd/system/pincerd.service
[Unit]
Description=Pincer Daemon
After=network.target

[Service]
Type=simple
User=<your user>
WorkingDirectory=/opt/pincerd
Environment=DAEMON_SECRET=your-secret-here
Environment=DAEMON_PORT=7378
ExecStart=/opt/pincerd/pincerd
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable pincerd
sudo systemctl start pincerd
```

### 3) Run with PM2

```bash
export DAEMON_SECRET=your-secret-here
export DAEMON_PORT=7378
pm2 start /opt/pincerd/pincerd --name pincerd
pm2 save
```

## API Endpoints

All endpoints require Bearer token authentication: `Authorization: Bearer <DAEMON_SECRET>`

### GET /health

Returns daemon status and uptime.

### GET /agents

Returns list of all agents.

### PUT /agents

Replaces the entire agent list with the provided array.

### GET /checks?since=<ms>&limit=<n>

Returns health checks since the given timestamp (with pagination).

### GET /stats?since=<ms>

Returns hourly statistics since the given timestamp.

### GET /incident-events?since=<ms>

Returns incident events since the given timestamp.
