<div align="center">
<img width="128" height="128" alt="Pincer Icon" src="icons/icon.iconset/icon_128x128@2x.png" />
<h1>Pincer</h1>

Desktop monitoring app for local AI and LLM agents.<br />Check agent health, status, and historical charts right from your system tray, without leaving your workflow.

[Changelog](./CHANGELOG.md) · [Report Bug](https://github.com/mariodian/pincer/issues/new?template=bug-report.md) · [Request Feature](https://github.com/mariodian/pincer/issues/new?template=feature-request.md)

![Status](https://img.shields.io/badge/status-alpha-red)
![Release](https://img.shields.io/github/v/release/mariodian/pincer)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

## ⚡ Quick Start

```bash
git clone https://github.com/mariodian/pincer.git
cd pincer
bun install && bun run dev
```

Done. Pincer will appear in your system tray.

## 📋 Table of Contents

- [⚡ Quick Start](#-quick-start)
- [🤔 Why Pincer?](#-why-pincer)
- [✨ Features](#-features)
- [📥 Installation](#-installation)
  - [✅ Requirements](#-requirements)
- [🚀 Usage](#-usage)
- [⚠️ Known Limitations](#-known-limitations)
- [🔧 Troubleshooting](#-troubleshooting)
- [💬 Contributing](#-contributing)
- [📜 License](#-license)

## 🤔 Why Pincer?

Running multiple local AI agents means constantly switching between terminals and browser tabs just to check what's healthy and what's not. Pincer lives in your system tray and gives you instant visibility into agent health, status history, and usage charts — no context switching required.

![pincer-dashboard](media/pincer-screenshot.webp)

## ✨ Features

- **Tray-first visibility**: check agent health at a glance from your system tray
- **Health monitoring**: real-time status indicators for each running agent
- **Charts & history**: visualize agent activity and health trends over time
- **Persistent storage**: activity logged locally with SQLite via Drizzle ORM
- **Minimal resource usage**: local-first, no cloud dependency
- **Cross-platform**: runs on macOS, Windows, and Linux (native effects on macOS)
- **Light/dark mode**: automatic system theme detection with manual override
- **Agent support**: tested with [OpenClaw](https://github.com/openclaw/openclaw) and [OpenCrabs](https://github.com/adolfousier/opencrabs); also supports custom agents exposing HTTP health endpoints

## 📥 Installation

```bash
git clone https://github.com/mariodian/pincer.git
cd pincer
bun install
```

### ✅ Requirements

- [Bun](https://bun.sh) v1.0+
- macOS 13+, Windows 10+, or Linux (GTK3)
- Xcode Command Line Tools (macOS only, required for native vibrancy effects)

## 🚀 Usage

```bash
# Full desktop dev flow
bun run dev

# Fast renderer iteration with HMR + desktop runtime
bun run dev:hmr

# Production build
bun run build

# Environment-based builds
bun run build:canary
bun run build:stable
```

In development, non-main windows should load Vite URLs for HMR updates.

## ⚠️ Known Limitations

- Native vibrancy and traffic-light customization is macOS-only
- The custom tray menu is macOS-only; Windows and Linux fall back to the native tray
- HMR for secondary windows requires Vite URL routing in development

## 🔧 Troubleshooting

### App won't launch on macOS

If the app is blocked by macOS security, run:

```bash
xattr -cr /path/to/Pincer.app
```

### HMR not updating in secondary windows

Verify dev windows use `http://localhost:5173/...` URLs.

### Weak vibrancy on macOS

Window blur effects may appear weak if transparency is enabled in system settings. Check _System Settings → Accessibility → Reduce transparency_ and disable it for full vibrancy effects.

## 💬 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## 📜 License

MIT. See [LICENSE](LICENSE).
