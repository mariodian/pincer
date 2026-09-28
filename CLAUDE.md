# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: This is Electrobun 2, NOT Electron

Do not use Electron APIs or patterns. Electrobun 2 uses Hutch for builds and Bun as this app's main-process runtime (`build.mainProcess: "bun"`). Cottontail is the framework default, but this app needs the real Bun runtime for `bun:ffi` and `bun:sqlite`.

SDK imports: `electrobun/main` in the main process, `electrobun/view` in the renderer. `electrobun/bun` is a deprecated alias. Docs: https://framework.blackboard.sh/electrobun/

## Commands

| Command                     | Purpose                                                                 |
| --------------------------- | ----------------------------------------------------------------------- |
| `bun run dev`               | Dev server (devkit + setup + Vite + Electrobun)                         |
| `bun run devkit`            | Materialize `.hutch/devkit` and refresh TypeScript paths                |
| `bun run dev:hmr`           | HMR for renderer iteration (Vite on :5173 + desktop runtime)            |
| `bun run build`             | Production build (setup + Vite + Electrobun)                            |
| `bun run build:native-libs` | Compile macOS dylib — run if app crashes on startup                     |
| `bun run setup`             | Build native libs + push DB schema                                      |
| `bun run check`             | Run lint + typecheck + test                                             |
| `bun run format`            | Prettier on `src/` and `daemon/` files                                  |
| `bun run lint`              | Lint all code (backend + svelte + daemon + tests)                       |
| `bun run typecheck`         | Full typecheck (backend + svelte + daemon + tests)                      |
| `bun run typecheck:backend` | Fast TS check (`src/bun/`, `src/shared/`)                               |
| `bun run typecheck:svelte`  | Typecheck Svelte components                                             |
| `bun run test`              | Run test suite                                                          |
| `bun run test:watch`        | Run tests in watch mode                                                 |
| `bun run db:generate`       | Generate Drizzle migration after schema changes                         |
| `bun run db:push`           | Push schema changes directly to dev DB                                  |

## Architecture

### Process Model

- **Main process** (`src/bun/`): Bun runtime. Handles all business logic, system tray, RPC handlers, database, and status polling. Entry: `src/bun/index.ts`.
- **Renderer** (`src/mainview/`): Svelte 5 SPA. Dashboard, agents CRUD, incidents, reports, settings. Entry: `src/mainview/main.ts`.
- **Tray popover** (`src/mainview/tray-popover.html` + `TrayPopover.svelte`): Mini-dashboard in macOS tray popover. Shares RPC interface with main window.

All windows run in the Bun main process (`build.mainProcess: "bun"` in `electrobun.config.ts`).

### Inter-Process Communication

RPC via Electrobun's `BrowserView.defineRPC<T>()`. Shared types in `src/shared/`. Handler files in `src/bun/rpc/`. Main-process SDK imports come from `electrobun/main`.

### Service Layer

`src/bun/services/` — business logic between RPC handlers and storage:

- `agentService.ts` — health check polling with configurable interval (default 15s)
- `statusService.ts` — centralized status polling, notification batching
- `statusSyncService.ts` — broadcasts status to all windows
- `incidentService.ts` — state machine for incident tracking (open/close thresholds)
- `retentionService.ts` — data cleanup by retention policy

### Storage

SQLite via Drizzle ORM. Schema: `src/bun/storage/sqlite/schema.ts`. Repository pattern in `src/bun/storage/sqlite/` — one repo file per table (`checksRepo.ts`, `statsRepo.ts`, `incidentEventsRepo.ts`, `settingsRepo.ts`).

**Migration rules:**

- NEVER manually create migration files or edit `_journal.json`
- Run `bun run db:generate` after schema changes
- For data migrations: edit the generated `.sql` to add INSERT/UPDATE between CREATE/DROP with `WHERE EXISTS` guards

### Agent Types

Defined in `src/bun/agentTypes.ts` as a registry. Built-in: `custom`, `openclaw` (port 18789), `opencrabs` (18790), `hermes` (8642), `opencode` (4096). Each has a health endpoint config and status parser function.

### Native FFI (macOS)

Objective-C++ source in `native/macos/` (`window-effects.mm`, `system.mm`). Build script `scripts/build-macos-lib.sh` compiles to `src/bun/libs/libMacOS.dylib`. Loaded via Bun FFI (`bun:ffi`). Provides: window vibrancy, traffic light positioning, autostart (SMAppService). On non-macOS, a placeholder file is created.

## Path Aliases

Configured in `vite.config.js` and `tsconfig.json`:

| Alias        | Resolves to            |
| ------------ | ---------------------- |
| `$bun`       | `src/bun/`             |
| `$lib`       | `src/mainview/lib/`    |
| `$shared`    | `src/shared/`          |
| `$assets`    | `src/mainview/assets/` |
| `$resources` | `src/resources/`       |

## Conventions

- **Logging**: Use `logger` from `loggerService.ts` in main process, not `console.*`
- **Platform guards**: Wrap macOS-specific code with `if (process.platform === "darwin")` or `isMacOS()` from `utils/platform`
- **Svelte 5**: Reactivity via runes (`$state`, `$derived`, `$effect`). Props via `$props()`. Events: `onclick={handler}` (no colon syntax). Use `cn()` from `$lib/utils` for conditional classes
- **UI components**: shadcn-svelte in `src/mainview/shadcn-svelte/`. Charts: `layerchart`
- **Tray**: macOS uses custom popover; Windows/Linux use native menu. Linux tray has known limitations (see `docs/linux-tray-limitation.md`)
- **Testing**: See `docs/testing.md` for mock ordering, `mockReset` vs `mockClear`, circular import patterns, and fetch mocking

See `AGENTS.md` for full coding standards.
