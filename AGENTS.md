# CrabControl Agent Guidelines

## Build, Lint, and Test Commands

### Development
- `bun run dev` - Build native dylib, run Vite build, and start Electrobun dev server
- `bun run dev:hmr` - Run Vite HMR (port 5173) + dev server concurrently for fast iteration
- `bun run hmr` - Start Vite HMR server only on port 5173

### Building
- `bun run build:native-effects` - Compile macOS native dylib with clang++ (required before dev)
- `bun run build` - Full production build: native dylib + Vite + electrobun
- `bun run build:prod` - Production build with release channel

### Running
- `bun run start` - Alias for dev mode

### Linting & Type Checking
> ⚠️ No ESLint configured. Consider adding ESLint for code quality checks.

### Testing
> ⚠️ No test framework configured. When adding tests:
> - Unit tests: Use Vitest or Bun test (`bun test`)
> - Run single test: `bun test <file>` or `bun test --grep "<pattern>"`

---

## Code Style Guidelines

### TypeScript/JavaScript
- Target ES2020, strict mode enabled (see `tsconfig.json`)
- Use ES modules (`import`/`export`), prefer `const`/`let` over `var`
- Handle promises with `async`/`await`, specify return types for functions
- `noUnusedLocals` and `noUnusedParameters` are enabled in tsconfig

### Imports
- Group: external libraries first, then internal modules
- Sort alphabetically within groups
- Use relative imports for local files: `import { fn } from "./utils"`
- Named exports preferred over default exports for utilities

### Formatting
- 2 spaces indentation, semicolons used consistently
- Aim for 80-100 character lines
- Use empty lines to separate logical blocks
- Trailing commas in multi-line object/array literals

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Constants | UPPER_SNAKE_CASE | `MAC_TRAFFIC_LIGHTS_X` |
| Variables/functions | camelCase | `isMacOS`, `applyMacOSWindowEffects` |
| Types/interfaces | PascalCase | `WindowEffects`, `AgentStatus` |
| Files | kebab-case (configs), PascalCase (components) | `windowService.ts`, `App.svelte` |
| Boolean vars | `is`/`has`/`can` prefixes | `isMacOS`, `hasFocus` |
| Event handlers | `handle` prefix | `handleClick`, `handleSubmit` |

### Error Handling
- Use `try`/`catch` for sync and async operations
- Log errors with context before rethrowing
- In native bridging, check library existence before loading
- Never ignore caught errors (at minimum, log them)
- Use `console.warn()` for recoverable issues, `console.error()` for unexpected

---

## macOS-Specific Guidelines
- Guard macOS code with `process.platform === "darwin"`
- Use Bun FFI (`bun:ffi`) for native library interactions
- Define FFI types explicitly when calling native functions
- Handle missing native libraries gracefully with fallback behavior
- Constants for UI positioning grouped at top of file
- Main thread required for most AppKit operations
- Objective-C++ with ARC enabled (`.mm` files)

---

## Svelte 5 Guidelines
- Use runes for reactivity: `$state`, `$derived`, `$effect`
- Keep components small, focused on single responsibility
- Props: `export let` (legacy-compatible) or runes syntax
- Event handling: `onclick={handler}` (no colon prefix in Svelte 5)
- Use `{#key}` blocks for efficient list rendering
- Tailwind CSS v4 used via `@tailwindcss/vite` plugin
- CSS scoped to component unless global styling needed

---

## RPC Communication
- RPC methods defined in `src/bun/rpc/*.ts` files
- Shared types in `src/shared/types.ts`
- Main process exposes RPC to renderer via `BrowserWindow` constructor
- Validate all RPC inputs from renderer before processing

---

## Agent Storage

### Architecture

Agent data is persisted through a storage abstraction layer (`src/bun/storage/`). The current implementation uses JSON files. A Libsql migration is planned.

```
agentService.ts
  └─ uses AgentStorage (injected via module)
       ├─ JsonAgentStorage    (current)
       └─ LibsqlAgentStorage  (future)
```

### Files

| File | Purpose |
|------|---------|
| `storage/types.ts` | `AgentStatusInfo` slim type |
| `storage/backend.ts` | `AgentStorage` interface |
| `storage/jsonStorage.ts` | JSON file implementation |
| `storage/index.ts` | Exports `createAgentStorage()` factory |

### AgentStatusInfo (localStorage only)

Statuses are only stored in renderer `localStorage`, never persisted to disk. The slim type avoids redundancy with `Agent` data:

```typescript
interface AgentStatusInfo {
  id: string;
  status: "ok" | "offline" | "error" | "warning";
  lastChecked: number;
  errorMessage?: string;
}
```

Synced to localStorage via `syncAgentData(agents, statuses)` in `utils/storage.ts`.

### Migrating to Libsql

When ready to switch from JSON to Libsql:

1. Create `src/bun/storage/libsqlStorage.ts` implementing `AgentStorage`:

```typescript
// libsqlStorage.ts
import type { AgentStorage } from "./backend";
import { Agent } from "../agentService";

export class LibsqlAgentStorage implements AgentStorage {
  // implement readAgents() and writeAgents(agents)
}
```

2. Update `src/bun/storage/index.ts` — swap the factory return:

```typescript
// Before
export function createAgentStorage(): AgentStorage {
  return new JsonAgentStorage();
}

// After
export function createAgentStorage(): AgentStorage {
  return new LibsqlAgentStorage();
}
```

No other files need to change — all storage access goes through the `AgentStorage` interface.

---

## Project Structure
```
/src
  /bun         - Main process (Electrobun, FFI, native integration)
    /rpc       - RPC method definitions
    /storage   - Storage abstraction layer (see Storage section)
    /utils     - Utility functions
  /mainview    - Svelte UI components, entry points, assets
    /ui        - Reusable UI components
  /shared      - Shared types for RPC communication
/native/macos  - Objective-C++ window effects implementation
/scripts       - Build scripts
```

### Key Config Files
- `electrobun.config.ts` - App packaging, copy targets, bundle settings
- `vite.config.js` - Vite config with 3 entry points (root: src/mainview)
- `tailwind.config.js` - Tailwind v4 config (content paths, dark mode)
- `tsconfig.json` - TypeScript (strict, ES2020 target)
- `svelte.config.js` - Svelte preprocessor config

### Entry Points
| File | Purpose |
|------|---------|
| `index.html` | Main window |
| `agent-config.html` | Agent configuration window |
| `tray-popover.html` | Tray popover window |

---

## Technology Stack
- Runtime: Electrobun with Bun
- UI: Svelte 5 (compiled to vanilla JS)
- Styling: Tailwind CSS v4
- Build: Vite
- Language: TypeScript
- Native: Objective-C++ via Bun FFI

---

## Cross-Platform Considerations
- All macOS-specific code guarded with `process.platform === "darwin"`
- Provide fallback implementations for non-macOS platforms
- Use `path.join()` instead of hardcoded separators

---

## Security Guidelines
- Validate all inputs from renderer before passing to native code
- Sanitize external data, be cautious with FFI
- Avoid `eval` and `Function` constructor
- Follow principle of least privilege in permissions
- Keep dependencies updated (`bun audit`, `bun update`)

---

## Debugging & Troubleshooting

### Common Issues
- **Native dylib not found**: Run `bun run build:native-effects` to compile
- **Port 5173 in use**: Kill existing Vite process or change port in `vite.config.js`
- **HMR not working**: Use `bun run dev:hmr` for concurrent Vite + Electrobun

### Debugging Tips
- Use `console.log` in main process; check terminal output
- Browser DevTools available in Electrobun windows
- Native crashes: check macOS Console app for crash logs
