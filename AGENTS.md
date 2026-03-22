# CrabControl Agent Guidelines

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

> No test framework is currently configured. Use **Vitest** or **Bun test** (`bun test`) when adding tests.

---

## Database Migrations

The project uses **Drizzle ORM** with SQLite. The app runs `migrate()` on startup, applying any pending migration files automatically.

### Creating a new migration

```bash
# 1. Sync dev.db baseline (copy real DB if dev.db is stale or missing)
cp ~/Library/Application\ Support/com.mariodian.crabmonitor/dev/app.db ./drizzle/dev.db

# 2. Make schema changes to src/bun/storage/sqlite/schema.ts

# 3. Generate migration (drizzle-kit diffs schema.ts against dev.db)
bun run db:generate

# 4. Apply to real DB (run the app)
bun run dev

# 5. Re-sync dev.db for next round
cp ~/Library/Application\ Support/com.mariodian.crabmonitor/dev/app.db ./drizzle/dev.db
```

`drizzle/dev.db` is in `.gitignore` — it's a local artifact used only for generating migrations.

### Data migrations (moving data between tables)

`drizzle-kit generate` only produces DDL (CREATE/DROP/ALTER). If a migration
needs to move data between tables (e.g. replacing a KV table with typed columns):

1. Let `drizzle-kit generate` create the migration (correct hashes + journal)
2. Edit the generated `.sql` file:
   - Add INSERT/UPDATE statements for data migration (between CREATE and DROP)
   - Use `WHERE EXISTS` guards so the migration works on both upgrade and fresh install
3. Test on a copy of the real database before deploying

Example pattern (replacing a key-value `config` table with typed `settings_general`):

```sql
CREATE TABLE `settings_general` (...);
--> statement-breakpoint
INSERT INTO `settings_general` (`id`)
  SELECT 1 WHERE EXISTS (SELECT 1 FROM `config`);
--> statement-breakpoint
UPDATE `settings_general` SET
  `polling_interval` = COALESCE((SELECT CAST(`value` AS INTEGER) FROM `config` WHERE `key` = 'pollingInterval'), 30000)
  WHERE EXISTS (SELECT 1 FROM `config`);
--> statement-breakpoint
DROP TABLE IF EXISTS `config`;
```

### Rules

- NEVER manually create migration files or edit `_journal.json` by hand
- Let `drizzle-kit generate` produce the base migration with correct hashes
- Data migrations go in the generated `.sql` file, not in app code
- `drizzle/dev.db` is in `.gitignore` — it's a local artifact, not committed
- After every migration, re-sync dev.db from the real database
- Test data migrations on a copy of the real database before running the app

### Settings tables

Settings are stored in typed single-row tables named `settings_<category>`:
- `settings_general` — polling interval, retention days, open on startup
- Future categories: `settings_privacy`, `settings_shortcuts`, etc.

Each table has a single row (`id = 1`, enforced by app logic). Access via
`src/bun/storage/sqlite/settingsRepo.ts` using typed `getSettings()`/`updateSettings()`.

---

## Code Style

### TypeScript

- Target ES2020, strict mode on (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- ES modules only; `const`/`let` (never `var`); `async`/`await` for promises
- Specify return types on public/exported functions
- Wrap I/O and native calls in `try`/`catch` with contextual logging before rethrowing

### Imports

Order: **(1)** external libraries, **(2)** path-aliased internal modules, **(3)** relative local imports. Sort alphabetically within each group. Use named exports for utilities; default exports only for Svelte components.

```ts
// External
import { BrowserView } from "electrobun/bun";
import { eq } from "drizzle-orm";

// Aliased internal
import type { Agent } from "$shared/types";

// Relative
import { agentsTable } from "./schema";
```

Path aliases (tsconfig + vite): `$lib` → `src/mainview/lib`, `$bun` → `src/bun`, `$shared` → `src/shared`.

### Formatting & Naming

2-space indent, semicolons, 80–100 char lines, trailing commas in multi-line literals/params.

| Type | Convention | Example |
| --- | --- | --- |
| Constants | `UPPER_SNAKE_CASE` | `MAC_TRAFFIC_LIGHTS_X` |
| Variables/functions | `camelCase` | `applyMacOSWindowEffects` |
| Types/interfaces | `PascalCase` | `WindowEffects`, `AgentStatus` |
| Files | `kebab-case.ts` (services/configs), `PascalCase.svelte` (components) | `windowService.ts`, `App.svelte` |
| Booleans | `is`/`has`/`can` prefix | `isMacOS`, `hasFocus` |
| Event handlers | `handle` prefix | `handleClick`, `handleSubmit` |

### Error Handling

- `try`/`catch` for all sync/async I/O; log context via `console.error()` before rethrowing
- `console.warn()` for recoverable issues only
- In native FFI bridging: check library existence before loading; never swallow errors

---

## Project Structure

```
src/
  bun/            Main process (Electrobun, FFI, native integration)
    rpc/          RPC method definitions & type maps
    storage/      Storage abstraction (AgentStorage interface → JSON impl, future Libsql)
    utils/        Utility functions
  mainview/       Svelte UI — entry points, pages, assets
    lib/
      components/ Reusable UI primitives (shadcn-style) + app-specific components
      pages/      Route-level page components
    ui/           Top-level wrappers (Window.svelte, Button.svelte)
  shared/         Shared types for RPC communication (types.ts, rpc.ts, agent-helpers.ts)
  resources/      Static assets
native/macos/     Objective-C++ window effects implementation
scripts/          Build scripts
```

Key configs: `electrobun.config.ts` (packaging), `vite.config.js` (3 entry points, root: `src/mainview`), `tsconfig.json` (strict, aliases), `drizzle.config.ts` (SQLite schema).

---

## Technology Stack

Runtime: **Electrobun + Bun** · UI: **Svelte 5** (runes: `$state`, `$derived`, `$effect`; event syntax: `onclick={handler}`) · Styling: **Tailwind CSS v4** (`@tailwindcss/vite`, scoped by default) · Build: **Vite** · DB: **Drizzle ORM + SQLite** · Native: **Objective-C++ via Bun FFI**

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
- Props via `export let` (legacy-compatible) or runes `$props()` syntax
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
