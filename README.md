<div align="center">
<img width="128" height="128" alt="Pincer Icon" src="icons/icon.iconset/icon_128x128@2x.png" />
<h1>Pincer</h1>

![Status](https://img.shields.io/badge/status-alpha-red)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

<p>Desktop monitoring app for local AI and LLM agents. Gives you tray-first visibility into agent health, real-time status, and historical charts — all without leaving your workflow.</p>

## Why Pincer?

Running multiple local AI agents means constantly switching between terminals and browser tabs just to check what's healthy and what's not. Pincer lives in your system tray and gives you instant visibility into agent health, status history, and usage charts — no context switching required.

![pincer-dashboard](media/pincer-screenshot.webp)

<!-- ![pincer-dashboard](https://github.com/user-attachments/assets/30b3deb8-c5d4-4ceb-b7d2-6a121e787df0) -->

## Features

- **Tray-first visibility** — check agent health at a glance from your system tray
- **Health monitoring** — real-time status indicators for each running agent
- **Charts & history** — visualize agent activity and health trends over time
- **Persistent storage** — activity logged locally with SQLite via Drizzle ORM
- **Cross-platform** — runs on macOS, Windows, and Linux (native effects on macOS)

## Supported Agents

Pincer is tested with the following local AI agent runtimes:

- [OpenClaw](https://github.com/openclaw/openclaw)
- [OpenCrabs](https://github.com/adolfousier/opencrabs)

It also supports custom agents that expose HTTP endpoints for health and activity data.

> If you've tested Pincer with another agent, feel free to open a PR to add it here.

## Tech Stack

Pincer is built with Electrobun and Bun for desktop runtime, Svelte 5 for UI, and SQLite with Drizzle for persistence.

## Installation

```bash
git clone https://github.com/mariodian/pincer.git
cd pincer
bun install
```

## Requirements

- [Bun](https://bun.sh) v1.0+
- macOS 13+, Windows 10+, or Linux (GTK3)
- Xcode Command Line Tools (macOS only, required for native vibrancy effects)

## Configuration

No required environment setup is needed for local development by default.

If you customize runtime behavior, keep these areas in sync:

- App constants in `src/bun/config.ts`
- Window behavior in `src/bun/windowService.ts`
- Database schema in `src/bun/storage/sqlite/schema.ts`

After schema changes:

```bash
bun run db:generate
bun run db:push
```

## Usage

```bash
# Full desktop dev flow
bun run dev

# Fast renderer iteration with HMR + desktop runtime
bun run dev:hmr
```

In development, non-main windows should load Vite URLs for HMR updates.

## Build

```bash
# Production build
bun run build

# Environment-based builds
bun run build:canary
bun run build:stable
```

## Scripts

| Command                        | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `bun run dev`                  | Format, build native effects + renderer + app, then run Electrobun dev |
| `bun run dev:hmr`              | Run Vite HMR and Electrobun dev concurrently                           |
| `bun run hmr`                  | Start Vite on port 5173                                                |
| `bun run build`                | Format + build native effects + Vite + Electrobun                      |
| `bun run build:canary`         | Rebuild native assets and renderer, then package canary                |
| `bun run build:stable`         | Rebuild native assets and renderer, then package stable                |
| `bun run build:native-effects` | Compile macOS native dylib                                             |
| `bun run db:generate`          | Generate Drizzle migrations                                            |
| `bun run db:push`              | Push schema to SQLite database                                         |
| `bun run db:studio`            | Open Drizzle Studio                                                    |
| `bun run typecheck`            | Run TypeScript type checking                                           |

## Project Structure

src/bun/ # Main process, tray, window management, RPC, storage
src/mainview/ # Svelte renderer app and pages
src/shared/ # Shared types for main and renderer communication
native/macos/ # Objective-C++ native window effects
scripts/ # Build helper scripts
drizzle/ # Migration files

## Known Limitations

- Native vibrancy and traffic-light customization is macOS-only
- The custom tray menu is macOS-only; Windows and Linux fall back to the native tray
- HMR for secondary windows requires Vite URL routing in development

## Troubleshooting

**Native dylib missing**

```bash
bun run build:native-effects
```

**HMR not updating in secondary windows**
Verify dev windows use `http://localhost:5173/...` URLs.

**Weak vibrancy on macOS**
Check _System Settings → Accessibility → Reduce transparency_ and ensure it is disabled.

## Contributing

Issues and PRs are welcome. For larger changes, open an issue first to discuss the approach.

## License

MIT. See [LICENSE](LICENSE).
