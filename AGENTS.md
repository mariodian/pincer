# CrabControl Agent Guidelines

> **Important:** This is an **Electrobun** desktop app (NOT Electron). Do not use Electron APIs or patterns.
> Full Electrobun API reference: https://blackboard.sh/electrobun/llms.txt

## Build, Lint, and Test Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Build native dylib, Vite, and start Electrobun dev server |
| `bun run dev:hmr` | Vite HMR (port 5173) + dev server concurrently |
| `bun run dev:web` | Vite dev server only (no Electrobun) |
| `bun run build:native-effects` | Compile macOS native dylib (required before dev/build) |
| `bun run build` | Full production build: native dylib + Vite + electrobun |
| `bun run build:canary` / `build:stable` | Environment-specific production builds |
| `bun run db:generate` | Generate Drizzle migration files |
| `bun run db:push` | Push schema to SQLite (dev only) |
| `bun run db:studio` | Open Drizzle Studio UI |
| `bunx tsc --noEmit` | Type checking (strict mode; no ESLint configured) |
| `bun test <file>` | Run a single test file |
| `bun test --grep "<pattern>"` | Run tests matching a pattern |

> No test framework configured. Use **Vitest** or **Bun test** (`bun test`) when adding tests.

---

## Database Migrations

Uses **Drizzle ORM** with SQLite. `migrate()` runs on startup.

### Workflow

```bash
cp ~/Library/Application\ Support/com.mariodian.crabmonitor/dev/app.db ./drizzle/dev.db
# Edit src/bun/storage/sqlite/schema.ts
bun run db:generate   # drizzle-kit diffs schema.ts against dev.db
bun run dev           # applies pending migrations on startup
cp ~/Library/Application\ Support/com.mariodian.crabmonitor/dev/app.db ./drizzle/dev.db
```

### Rules

- NEVER manually create migration files or edit `_journal.json`
- Let `drizzle-kit generate` produce the base migration with correct hashes
- For data migrations: edit the generated `.sql` — add INSERT/UPDATE between CREATE and DROP with `WHERE EXISTS` guards for fresh-install compatibility
- `drizzle/dev.db` is in `.gitignore` — re-sync from real DB after every migration
- Test data migrations on a copy of the real database before deploying

### Settings tables

Settings use typed single-row tables named `settings_<category>` (e.g., `settings_general`). Single row (`id = 1`, enforced by app logic). Access via `src/bun/storage/sqlite/settingsRepo.ts` using `getSettings()`/`updateSettings()`.

---

## Code Style

### TypeScript

- Target ES2020, strict mode on (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- ES modules only; `const`/`let` (never `var`); `async`/`await` for promises
- Specify return types on public/exported functions
- Double quotes for strings; semicolons required
- Wrap I/O and native calls in `try`/`catch` with contextual logging before rethrowing

### Imports

Order: **(1)** external libraries, **(2)** path-aliased internal modules (`$lib`, `$bun`, `$shared`), **(3)** relative local imports. Sort alphabetically within each group. Use named exports for utilities; default exports only for Svelte components. Use `import type` inline for type-only imports. Add `.js` extensions in Svelte component imports (e.g., `"$lib/components/ui/button/index.js"`).

```ts
import { BrowserView } from "electrobun/bun";       // External
import { eq } from "drizzle-orm";
import type { Agent } from "$shared/types";           // Aliased
import { agentsTable } from "./schema";               // Relative
```

### Formatting & Naming

2-space indent, 80–100 char lines, trailing commas in multi-line literals/params.

| Type | Convention | Example |
| --- | --- | --- |
| Constants | `UPPER_SNAKE_CASE` | `MAC_TRAFFIC_LIGHTS_X` |
| Variables/functions | `camelCase` | `applyMacOSWindowEffects` |
| Types/interfaces | `PascalCase` | `WindowEffects`, `AgentStatus` |
| Files | `kebab-case.ts` (services/utils), `PascalCase.svelte` (components) | `windowService.ts`, `App.svelte` |
| Booleans | `is`/`has`/`can` prefix | `isMacOS`, `hasFocus` |
| Event handlers | `handle` prefix | `handleClick`, `handleSubmit` |

### Error Handling

- `try`/`catch` for all sync/async I/O; log context via `console.error()` before rethrowing
- `console.warn()` for recoverable issues only (e.g., missing native library → graceful fallback)
- In native FFI bridging: check library existence before loading; never swallow errors
- Use `error instanceof Error ? error.message : String(error)` for error messages

---

## Project Structure

```
src/
  bun/            Main process (Electrobun, FFI, native integration)
    rpc/          RPC method definitions & type maps
    services/     Business logic (agentService, statusService, statusSyncService)
    storage/      Storage abstraction → SQLite/Drizzle implementation
    utils/        Utilities (platform detection, native effects, window config)
  mainview/       Svelte UI renderer
    lib/
      components/ Reusable UI primitives (shadcn-style) + app-specific components
      pages/      Route-level pages (Dashboard, Agents, Settings)
      services/   Renderer-side RPC client
    ui/           Top-level wrappers (Window.svelte, Button.svelte)
  shared/         Shared types for main↔renderer (types.ts, rpc.ts, agent-helpers.ts)
native/macos/     Objective-C++ window effects (vibrancy, traffic-light positioning)
scripts/          Build scripts (build-macos-effects.sh)
```

Key configs: `electrobun.config.ts` (packaging), `vite.config.js` (3 entry points, root: `src/mainview`), `tsconfig.json` (strict, aliases), `drizzle.config.ts` (SQLite schema).

---

## Technology Stack

Runtime: **Electrobun + Bun** · UI: **Svelte 5** (runes: `$state`, `$derived`, `$effect`) · Styling: **Tailwind CSS v4** (`@tailwindcss/vite`) · Components: **shadcn-svelte** (via `bits-ui`) · Build: **Vite** · DB: **Drizzle ORM + SQLite** · Native: **Objective-C++ via Bun FFI**

---

## RPC & Native Integration

- RPC types defined in `src/bun/rpc/*.ts` using `BrowserView.defineRPC<T>()`; shared types in `src/shared/types.ts`
- Always validate RPC inputs from the renderer before processing or passing to native code
- Guard macOS-specific code with `process.platform === "darwin"`
- Use Bun FFI (`bun:ffi`) with explicit `CString`/`ptr` type definitions
- Handle missing native libraries gracefully — fall back, don't crash

---

## Svelte 5 Conventions

- Reactivity via runes: `$state`, `$derived`, `$effect` (no stores unless cross-component)
- Props via `$props()` with typed interface; destructure on declaration
- Events: `onclick={handler}` (no colon prefix — Svelte 5 syntax)
- Keep components small and single-responsibility; pages in `lib/pages/`, UI primitives in `lib/components/ui/`
- CSS scoped by default; Tailwind utility classes; use `cn()` from `$lib/utils` for conditional classes

---

## Security

- Validate all renderer inputs before passing to native code or storage
- Avoid `eval`, `new Function()`, and template-based code execution
- Principle of least privilege; run `bun audit` regularly

---

## Debugging

| Issue | Fix |
| --- | --- |
| Native dylib not found | `bun run build:native-effects` |
| Port 5173 in use | Kill existing Vite process or change port in `vite.config.js` |
| HMR not working | Use `bun run dev:hmr` for concurrent Vite + Electrobun |
| Main process logs | Terminal output |
| Renderer logs | Browser DevTools in Electrobun windows |
| Native crashes | macOS Console app → crash logs |
