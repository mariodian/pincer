# Pincer Agent Guidelines

> **Important:** This is an **Electrobun** desktop app (NOT Electron). Do not use Electron APIs or patterns.
> Full Electrobun API reference: https://blackboard.sh/electrobun/llms.txt

## Essential Commands

| Command                     | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `bun run dev`               | Dev server (builds native dylib + Vite)          |
| `bun run build:native-libs` | Compile macOS dylib (required before dev/build)  |
| `bun run build`             | Full production build                            |
| `bun run db:generate`       | Generate Drizzle migrations after schema changes |

> See `package.json` for full script list. Tests: `bun test` (Bun test or Vitest).

## Database Migrations (Drizzle + SQLite)

**Critical rules:**

- NEVER manually create migration files or edit `_journal.json`
- For data migrations: edit generated `.sql` — add INSERT/UPDATE between CREATE/DROP with `WHERE EXISTS` guards
- Re-sync `drizzle/dev.db` from real DB after every migration

> Full workflow: `.opencode/context/project-intelligence/lookup/database-migrations.md`

## Code Conventions

**Follow:** `.opencode/context/project-intelligence/lookup/code-standards.md` and `naming-conventions.md`

**Key reminders:**

- Use `logger` from `loggerService.ts` (not `console.*`) in main process
- Guard macOS code: `if (process.platform === "darwin")` or use `isMacOS()` from `utils/platform`

## Project Structure (Brief)

```
src/bun/          # Main process (RPC, services, storage, native FFI)
src/mainview/     # Svelte 5 renderer (lib/components, lib/pages)
src/shared/       # Shared types for main↔renderer
native/macos/     # Objective-C++ native code
```

> Full tree + config details: `.opencode/context/project-intelligence/navigation.md`

## Tech Stack

Electrobun+Bun · Svelte 5 (runes) · Tailwind v4 · shadcn-svelte · Drizzle+SQLite · Objective-C++ via Bun FFI

## RPC & Native Integration

- Validate all renderer inputs before passing to native code or storage
- RPC types: `src/bun/rpc/*.ts` via `BrowserView.defineRPC<T>()`; shared types in `src/shared/types.ts`
- Use Bun FFI (`bun:ffi`) with explicit `CString`/`ptr` types; handle missing native libs gracefully

## Svelte 5

- Reactivity via runes: `$state`, `$derived`, `$effect` (no stores unless cross-component)
- Props via `$props()` with typed interface; events: `onclick={handler}` (no colon)
- Components: small, single-responsibility; use `cn()` from `$lib/utils` for conditional classes

## Security

- Validate renderer inputs; avoid `eval`/`new Function()`; principle of least privilege; run `bun audit`

> Troubleshooting: `.opencode/context/project-intelligence/guides/getting-started.md`

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Pincer**

Desktop monitoring application for local AI agents. Lives in the system tray, providing instant visibility into agent health, status history, and usage charts — no context switching between terminals and browser tabs.

**Core Value:** Users can monitor their local AI agents' health and status at a glance from the system tray, without leaving their current workflow.

### Constraints

- **Platform**: macOS 13+, Windows 10+, Linux (GTK3)
- **Runtime**: Bun 1.16.0+ required
- **Stack**: Electrobun + Svelte 5 + Drizzle + SQLite
- **Scope**: Desktop app only, no mobile
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 6.0.2 - Core application code (src/bun/*, src/mainview/*, src/shared/*)
- Objective-C++ - Native macOS integrations (native/macos/*.mm)
- CSS - Styling (via Tailwind v4)
## Runtime
- Bun 1.16.0+ - JavaScript/TypeScript runtime and package manager
- Node.js compatibility via `node:*` imports (fs, path, child_process)
- Bun (native) - Lockfile: `bun.lock`
## Frameworks
- Electrobun 1.16.0 - Desktop app framework with Bun runtime
- Svelte 5.55.1 - UI framework with runes (`$state`, `$derived`, `$effect`)
- Svelte 5 is used for both renderer pages and components
- Tailwind CSS v4.2.2 - Utility-first CSS via `@tailwindcss/vite` plugin
- tailwind-merge 3.5.0 - Class merging utility
- tw-animate-css 1.4.0 - Tailwind animation utilities
- shadcn-svelte (bits-ui 2.17.2 based) - Reusable UI components
- Custom components in `src/mainview/lib/components/ui/*`
- layerchart 2.0.0-next.50 - Svelte chart library built on d3
- d3-array 3.2.2, d3-scale 4.0.9, d3-shape 3.1.8 - Data visualization
- @hugeicons/svelte 1.1.2 - Icon library
- @hugeicons/core-free-icons 4.1.1 - Core free icons
- @lucide/svelte 1.7.0 - Additional icons
- @internationalized/date 3.12.0 - Date handling for i18n
- @fontsource-variable/inter 5.2.8 - Inter variable font
## Build Tools
- Vite 8.0.0 - Frontend build tool
- svelte-check 4.4.6 - Type checking for Svelte
- prettier-plugin-svelte 3.5.1 - Prettier integration
- Prettier - Code formatter (run via `bunx prettier`)
- drizzle-kit 0.31.10 - Database schema migration tool
## Database & ORM
- SQLite (via `bun:sqlite`) - Embedded database
- WAL mode enabled for concurrent read performance
- Location: `{userData}/app.db`
- drizzle-orm 0.45.2 - Type-safe SQL query builder
- drizzle-kit 0.31.10 - Migration generation and studio
- `agents` - Agent configurations
- `settings_general` - General app settings
- `settings_advanced` - Advanced settings (polling interval, native tray, auto-update)
- `settings_notifications` - Notification preferences
- `app_state` - Ephemeral window/UI state
- `app_meta` - App metadata (versions, migration flags)
- `stats` - Hourly aggregated statistics
- `checks` - Raw health check results (7-day retention)
- `incident_events` - Incident lifecycle events
## Native Layer
- Objective-C++ compiled to `libMacOS.dylib`
- Build script: `scripts/build-macos-lib.sh`
- Frameworks: Cocoa, ServiceManagement
- `registerMainAppLoginItem()` / `unregisterMainAppLoginItem()` - Login item management
- `getMainAppLoginItemStatus()` - Check login item status
- `openLoginItemsSettings()` - Open System Settings
- `isSMAppServiceAvailable()` - Check SMAppService API availability
- `setWindowMinSize()` - Set minimum window size
- `enableWindowVibrancy()` - Add vibrancy effect to window
- `setWindowAppearance()` - Set light/dark/system appearance
- `ensureWindowShadow()` - Ensure window has shadow
- `setWindowTrafficLightsPosition()` - Position traffic light buttons
- `setTrafficLightsVisible()` - Show/hide traffic lights
- `setNativeWindowDragRegion()` - Set native drag region
- Uses `bun:ffi` for loading native dylib
- Explicit CString/ptr types for interop
## Key Dependencies
- drizzle-orm 0.45.2 - Database ORM
- electrobun 1.16.0 - Desktop framework
- svelte 5.55.1 - UI framework
- bits-ui 2.17.2 - UI component primitives
- tailwindcss 4.2.2 - CSS framework
- layerchart 2.0.0-next.50 - Charts
- svelte-sonner 1.1.0 - Toast notifications
- @bmlt-enabled/svelte-spa-router 5.0.8 - Svelte 5 SPA routing
- vite 8.0.0 - Bundler
- svelte-check 4.4.6 - Type checking
- drizzle-kit 0.31.10 - DB migrations
- @types/* packages - TypeScript definitions
## Path Aliases
- `$lib` → `src/mainview/lib`
- `$assets` → `src/mainview/assets`
- `$bun` → `src/bun`
- `$shared` → `src/shared`
- `$resources` → `src/resources`
## Environment Configuration
- `electrobun.config.ts` - App metadata, build config, release URL
- `vite.config.js` - Build configuration, aliases
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database migration config
- `tailwind.config.js` - Tailwind configuration
- `svelte.config.js` - Svelte preprocessor config
- `LOG_LEVEL` - Override log level (debug, info, warn, error)
- `LOG_TO_FILE` - Enable/disable file logging (true/false)
- `CHANNEL` - Release channel (stable, canary, dev)
- `BUILD_ENV` - Build environment (stable, canary)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Components: kebab-case (`AgentToggle.svelte`, `timeline-item.svelte`)
- Services/Utils: camelCase (`loggerService.ts`, `agentService.ts`)
- Schema: camelCase (`schema.ts`, `statsRepo.ts`)
- RPC handlers: camelCase (`agentRPC.ts`, `systemRPC.ts`)
- camelCase for all identifiers
- Descriptive names: `windowWidth`, `retentionDays`, `checkAgentStatus`
- Boolean prefix for booleans: `isMacOS()`, `enabledAgents`, `showDisabledAgents`
- PascalCase for types and interfaces: `Agent`, `AgentStatus`, `TimeRange`
- Suffix for variant types: `BadgeVariant`, `ChartType`
- UPPER_SNAKE_CASE for magic numbers defined at module level: `MAX_LOG_SIZE_BYTES`, `ONE_DAY_MS`
## TypeScript Patterns
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- Re-export shared types from `src/shared/types.ts`
- Export types from services: `export type { Agent, AgentStatus } from "../../shared/types";`
## Svelte 5 Patterns
## Import Organization
## Error Handling Patterns
## Logging Conventions
- `"app"` — application lifecycle
- `"agent"` — agent CRUD operations
- `"db"` — database operations
- `"native"` — native FFI/macOS effects
- `"systemRPC"` — RPC handlers
## Code Formatting
## Platform Guards
## Database Migration Conventions
- NEVER manually create migration files or edit `_journal.json`
- For data migrations: edit generated `.sql` — add INSERT/UPDATE between CREATE/DROP with `WHERE EXISTS` guards
- Re-sync `drizzle/dev.db` from real DB after every migration
## Component Patterns
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Main/renderer separation via Electrobun's BrowserView (native webview)
- Type-safe RPC communication between main process and renderer(s)
- Singleton services for centralized business logic
- Event-driven status polling with notification batching
- SQLite persistence via Drizzle ORM
- Native macOS integration via Objective-C++ FFI
## Layers
- Purpose: Desktop application lifecycle, native integrations, business logic
- Location: `src/bun/`
- Contains: Entry point (index.ts), RPC handlers, services, storage, utilities
- Depends on: electrobun, bun:sqlite, drizzle-orm
- Used by: Renderer via RPC, native libraries
- Purpose: UI rendering, user interaction
- Location: `src/mainview/`
- Contains: Svelte 5 components, pages, stores
- Depends on: Svelte 5, Tailwind v4, shadcn-svelte
- Used by: Main process (sends rendered HTML to BrowserView)
- Purpose: Canonical type definitions shared between main and renderer
- Location: `src/shared/`
- Contains: TypeScript interfaces, RPC type definitions, helper functions
- Used by: Both main and renderer processes
- Purpose: macOS-specific window effects (vibrancy, traffic lights, drag regions)
- Location: `native/macos/`
- Contains: Objective-C++ code compiled to `libMacOS.dylib`
- Used by: Main process via Bun FFI
## Data Flow
```
```
```
```
```
```
## Key Abstractions
- Purpose: Type-safe request/response and message passing between main and renderer
- Examples: `src/bun/rpc/systemRPC.ts`, `src/bun/rpc/agentRPC.ts`
- Pattern: `BrowserView.defineRPC<T>()` with typed handlers
- Request: Renderer → Main (await response)
- Message: Main → Renderer (fire-and-forget via `send`)
- Purpose: Business logic encapsulation
- Examples: `agentService.ts`, `statusService.ts`, `incidentService.ts`
- Pattern: Module-level singleton functions, some with class instances
- All services access logger via `import { logger } from "./loggerService"`
- Purpose: Centralized status state management across windows
- Location: `src/bun/services/statusSyncService.ts`
- Pattern: Class with `updateStatusMap()`, `sync()`, `pushKnownStatuses()`
- Broadcasts to all windows via `windowBroadcaster.ts`
- Purpose: Track incidents (failures → threshold → opened → recovered → threshold)
- Location: `src/bun/services/incidentService.ts`
- Pattern: In-memory state machine with DB persistence
- State machine: OK → consecutive failures → incident opened → consecutive OK → recovered
- Purpose: SQLite persistence via Drizzle ORM
- Location: `src/bun/storage/sqlite/`
- Pattern: Repository functions per entity (agents, settings, checks, stats)
- Agents: `src/bun/storage/sqlite/sqlStorage.ts`
- Settings: `src/bun/storage/sqlite/settingsRepo.ts`
- Purpose: Global access to BrowserWindow instances
- Location: `src/bun/rpc/windowRegistry.ts`
- Pattern: Module-level variables with getter/setter
- Tracks: `mainWindowRef`
- Purpose: Cross-window navigation coordination
- Location: `src/bun/utils/navigation.ts`
- Pattern: Store pending route, push via hash URLs
## Entry Points
- Location: `src/bun/index.ts`
- Triggers: Application startup
- Responsibilities: Logger init, DB init, tray init, window creation, status polling
- Location: `src/mainview/main.ts`
- Triggers: BrowserView loads index.html
- Responsibilities: Svelte app mounting, RPC initialization
- Location: `src/mainview/tray-popover.ts`
- Triggers: Tray icon click → popover window
- Responsibilities: Minimal agent list view
- Location: `native/macos/window-effects.mm`
- Exported functions: `setWindowMinSize`, `enableWindowVibrancy`, `setWindowAppearance`, etc.
- Called from: `src/bun/utils/macOSWindowEffects.ts`
## Error Handling
- Service layer: Try/catch with `logger.error()` + re-throw
- RPC handlers: Try/catch with `logger.error()` + throw (converted to RPC error)
- Renderer: Error boundaries in Svelte components
- Global: `before-quit` handler saves window bounds
- Errors thrown in handlers → RPC layer converts to rejected promise
- Renderer receives typed error via `Promise.reject()`
- On startup: Validate saved bounds against current displays
- If off-screen: Reset to center of primary display
- If corrupted: Null check → default values
## Cross-Cutting Concerns
- Levels: debug, info, warn, error
- Outputs: console (dev), file (`Utils.paths.userData/logs/app.log`)
- Renderer push: warn/error pushed to renderer via RPC
- Renderer inputs validated before RPC calls
- Agent URLs normalized via `normalizeUrl()`
- Window bounds validated against display geometry
- `src/bun/utils/platform.ts`: `isMacOS()`, `isWindows()`, `isLinux()`
- Guards macOS-specific code throughout
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| skill | Description | Path |
|-------|-------------|------|
| changelog-generator | Generate a CHANGELOG.md entry following the Keep a Changelog format. | `.github/skills/changelog-generator/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using edit, write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-OpenCode-profile` -- do not edit manually.
<!-- GSD:profile-end -->
