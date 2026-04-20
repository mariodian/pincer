# Pincer Daemon

A lightweight, always-on Bun HTTP server that runs the same collection pipeline as Pincer and exposes a pull API so Pincer can sync the gap when it wakes up from sleep.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Pincer (GUI)  │         │  pincer-daemon   │
│                 │  sync   │                  │
│  - Agent list   │───────▶ │  - Dumb collector│
│  - Analyzer     │         │  - No LLM/No UI  │
│  - Source of    │◀─────── │  - SQLite + HTTP │
│    truth        │  pull   │                  │
└─────────────────┘         └──────────────────┘
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DAEMON_PORT` | `7378` | HTTP server port |
| `DAEMON_SECRET` | *required* | Bearer token for API auth |
| `DB_PATH` | `~/.pincer-daemon/db.sqlite` | SQLite database path |
| `POLLING_INTERVAL_MS` | `15000` | Health check interval |

## Deployment

### Using systemd (Linux)

```ini
# /etc/systemd/system/pincer-daemon.service
[Unit]
Description=Pincer Daemon
After=network.target

[Service]
Type=simple
User=pincer
WorkingDirectory=/opt/pincer-daemon
Environment=DAEMON_SECRET=your-secret-here
Environment=DAEMON_PORT=7378
ExecStart=/usr/local/bin/bun run index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pincer-daemon
sudo systemctl start pincer-daemon
```

### Using PM2

```bash
pm2 start daemon/index.ts --name pincer-daemon --interpreter bun
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
