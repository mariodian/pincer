<div align="center">
<h1>Pincer</h1>
</div>

Desktop monitoring app for local AI and LLM agents with tray-first controls,
status checks, and quick navigation.

![pincer-dashboard](https://github.com/user-attachments/assets/53ce0fa7-772e-4295-aaad-3a01ccf56f7d)

Pincer is built with Electrobun and Bun for desktop runtime, Svelte 5 for UI,
and SQLite with Drizzle for persistence.

## Installation

```bash
git clone https://github.com/mariodian/pincer.git
cd pincer
bun install
```

## Configuration

No required environment setup is needed for local development by default.

If you customize runtime behavior, keep these areas in sync:

- App constants in src/bun/config.ts
- Window behavior in src/bun/windowService.ts
- Database schema in src/bun/storage/sqlite/schema.ts

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

- bun run dev: Format, build native effects + renderer + app, then run Electrobun dev.
- bun run dev:hmr: Run Vite HMR and Electrobun dev concurrently.
- bun run hmr: Start Vite on port 5173.
- bun run build:native-effects: Compile macOS native dylib.
- bun run build: Format + build native effects + Vite + Electrobun.
- bun run build:canary: Rebuild native assets and renderer, then package the canary environment.
- bun run build:stable: Rebuild native assets and renderer, then package the stable environment.
- bun run db:generate: Generate Drizzle migrations.
- bun run db:push: Push schema to SQLite database.
- bun run db:studio: Open Drizzle Studio.

## Requirements

- Bun
- Supported desktop platform (macOS, Windows, or Linux)

## Known Limitations

- Native vibrancy/traffic-light customization is only available on macOS.
- On Windows and Linux, Pincer runs normally without native macOS effects.
- The custom-designed tray menu is currently macOS-only; Windows and Linux use
  the native tray menu fallback.
- HMR for secondary windows requires Vite URL routing in development.

## Development

### Type Checking

```bash
bun run typecheck
```

### Database Workflow

```bash
bun run db:generate
bun run db:push
bun run db:studio
```

### Native macOS Effects

```bash
bun run build:native-effects
```

If native libraries are missing, the app logs a warning and continues with
fallback behavior.

These effects are optional and do not affect normal app functionality on
Windows or Linux.

### Project Structure

- src/bun/: Main process, tray, window management, RPC, storage.
- src/mainview/: Svelte renderer app and pages.
- src/shared/: Shared types for main and renderer communication.
- native/macos/: Objective-C++ native window effects.
- scripts/: Build helper scripts.
- drizzle/: Migration files.

## Troubleshooting

- Native dylib missing:
  Run bun run build:native-effects.
- HMR not updating in secondary windows:
  Verify dev windows use http://localhost:5173/... URLs.
- Weak vibrancy:
  Check macOS Accessibility setting Reduce transparency.

## License

MIT. See [LICENSE](LICENSE).
