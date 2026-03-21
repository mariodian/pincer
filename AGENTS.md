# CrabControl Agent Guidelines

## Build, Lint, and Test Commands

### Development

- `bun run dev` - Build native dylib, run Vite build, and start Electrobun dev server
- `bun run dev:hmr` - Run Vite HMR (port 5173) + dev server concurrently for fast iteration
- `bun run hmr` - Start Vite HMR server only on port 5173
- `bun run dev:web` - Vite dev server only (no Electrobun)

### Building

- `bun run build:native-effects` - Compile macOS native dylib with clang++ (required before dev)
- `bun run build` - Full production build: native dylib + Vite + electrobun
- `bun run build:prod` - Production build with release channel

### Database (Drizzle + SQLite)

- `bun run db:generate` - Generate Drizzle migration files from schema changes
- `bun run db:push` - Push schema directly to SQLite DB (dev only)
- `bun run db:studio` - Open Drizzle Studio browser UI

### Linting & Type Checking

> No ESLint configured. TypeScript strict mode (`tsconfig.json`) provides compile-time checks.
> Run `bunx tsc --noEmit` for type checking.

### Testing

> No test framework configured. When adding tests:
>
> - Use Vitest or Bun test (`bun test`)
> - Run single test: `bun test <file>` or `bun test --grep "<pattern>"`

---

## Code Style Guidelines

### TypeScript

- Target ES2020, strict mode enabled, `noUnusedLocals` and `noUnusedParameters` on
- Use ES modules, `const`/`let` only, `async`/`await` for promises
- Specify return types on public functions; use `try`/`catch` with contextual logging

### Imports

- External libraries first, then internal modules; sort alphabetically within groups
- Use relative imports for local files: `import { fn } from "./utils"`
- Named exports preferred over default exports for utilities

### Formatting & Naming

- 2 spaces, semicolons, 80-100 char lines, trailing commas in multi-line literals

| Type                | Convention                                    | Example                              |
| ------------------- | --------------------------------------------- | ------------------------------------ |
| Constants           | UPPER_SNAKE_CASE                              | `MAC_TRAFFIC_LIGHTS_X`               |
| Variables/functions | camelCase                                     | `isMacOS`, `applyMacOSWindowEffects` |
| Types/interfaces    | PascalCase                                    | `WindowEffects`, `AgentStatus`       |
| Files               | kebab-case (configs), PascalCase (components) | `windowService.ts`, `App.svelte`     |
| Boolean vars        | `is`/`has`/`can` prefixes                     | `isMacOS`, `hasFocus`                |
| Event handlers      | `handle` prefix                               | `handleClick`, `handleSubmit`        |

### Error Handling

- Use `try`/`catch` for sync and async operations; log with context before rethrowing
- In native bridging, check library existence before loading; never ignore caught errors
- `console.warn()` for recoverable issues, `console.error()` for unexpected failures

---

## Project Structure

```
/src
  /bun         - Main process (Electrobun, FFI, native integration)
    /rpc       - RPC method definitions
    /storage   - Storage abstraction layer (JSON, future Libsql)
    /utils     - Utility functions
  /mainview    - Svelte UI components, entry points, assets
    /ui        - Reusable UI components
  /shared      - Shared types for RPC communication
/native/macos  - Objective-C++ window effects implementation
/scripts       - Build scripts
```

### Key Config Files

- `electrobun.config.ts` - App packaging, copy targets, bundle settings
- `vite.config.js` - Vite config with 3 entry points (root: `src/mainview`)
- `tailwind.config.js` - Tailwind v4 config (content paths, dark mode)
- `tsconfig.json` - TypeScript (strict, ES2020 target, path aliases: `$lib`, `$bun`)
- `svelte.config.js` - Svelte preprocessor config
- `drizzle.config.ts` - Drizzle Kit config (SQLite, schema at `src/bun/storage/sqlite/`)

### Entry Points

| File                | Purpose             |
| ------------------- | ------------------- |
| `index.html`        | Main window         |
| `tray-popover.html` | Tray popover window |

---

## Technology Stack

Runtime: Electrobun with Bun · UI: Svelte 5 · Styling: Tailwind CSS v4 · Build: Vite · Language: TypeScript · DB: Drizzle ORM + SQLite · Native: Objective-C++ via Bun FFI

---

## Agent Storage

Agent data is persisted through a storage abstraction layer (`src/bun/storage/`). The current implementation uses JSON files; a Libsql migration is planned.

```
agentService.ts
  └─ AgentStorage (interface in backend.ts)
       ├─ JsonAgentStorage (current - jsonStorage.ts)
       └─ LibsqlAgentStorage (future)
```

`AgentStatusInfo` (status, lastChecked, errorMessage) is stored in renderer `localStorage` only, synced via `syncAgentData()` in `utils/storage.ts`. To migrate to Libsql: implement `LibsqlAgentStorage` in `storage/libsqlStorage.ts` and swap the factory in `storage/index.ts`.

---

## Svelte 5 Guidelines

- Use runes for reactivity: `$state`, `$derived`, `$effect`
- Keep components small, single responsibility
- Props: `export let` (legacy-compatible) or runes syntax
- Event handling: `onclick={handler}` (no colon prefix in Svelte 5)
- Tailwind CSS v4 via `@tailwindcss/vite`; CSS scoped unless global

---

## RPC & Native Integration

- RPC methods in `src/bun/rpc/*.ts`; shared types in `src/shared/types.ts`
- Validate all RPC inputs from renderer before processing
- Guard macOS code with `process.platform === "darwin"`
- Use Bun FFI (`bun:ffi`) with explicit type definitions
- Handle missing native libraries gracefully with fallback behavior

---

## Security Guidelines

- Validate all inputs from renderer before passing to native code
- Avoid `eval` and `Function` constructor
- Follow principle of least privilege; keep dependencies updated (`bun audit`)

---

## Debugging

- **Native dylib not found**: Run `bun run build:native-effects`
- **Port 5173 in use**: Kill existing Vite process or change port in `vite.config.js`
- **HMR not working**: Use `bun run dev:hmr` for concurrent Vite + Electrobun
- Main process logs: check terminal output; renderer: use Browser DevTools in Electrobun windows
- Native crashes: check macOS Console app for crash logs
