# CrabControl Agent Guidelines

## Build, Lint, and Test Commands

### Development
- `bun run dev` - Build and start Electrobun dev server
- `bun run dev:hmr` - Run Vite HMR + dev server concurrently
- `bun run hmr` - Start Vite HMR server on port 5173

### Building
- `bun run build:native-effects` - Compile macOS native dylib (clang++)
- `bun run build` - Full production build (native + Vite + electrobun)
- `bun run build:prod` - Production build for release channel

### Running
- `bun run start` - Alias for dev mode

### Testing
> ⚠️ No test framework configured. When adding tests:
> - Unit tests: Use Vitest or Bun test (`bun test`)
> - Run single test: `bun test <file>` or `bun test --grep "<pattern>"`
> - E2E tests: Consider Playwright

---

## Code Style Guidelines

### TypeScript/JavaScript
- Target ES2020, strict mode enabled (see `tsconfig.json`)
- Use ES modules (`import`/`export`), prefer `const`/`let` over `var`
- Handle promises with `async`/`await`, specify return types for functions

### Imports
- Group: external libraries first, then internal modules
- Sort alphabetically within groups
- Use relative imports for local files: `import { fn } from "./utils"`

### Formatting
- 2 spaces indentation, semicolons used consistently
- Aim for 80-100 character lines
- Use empty lines to separate logical blocks

### Naming Conventions
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAC_TRAFFIC_LIGHTS_X`)
- Variables/functions: `camelCase` (e.g., `isMacOS`, `applyMacOSWindowEffects`)
- Types/interfaces: `PascalCase` (e.g., `WindowEffects`, `AppProps`)
- Files: kebab-case for configs, PascalCase for components (`App.svelte`)
- Boolean vars: `is`/`has`/`can` prefixes
- Event handlers: `handle` prefix (e.g., `handleClick`)

### Error Handling
- Use `try`/`catch` for sync and async operations
- Log errors with context before rethrowing
- In native bridging, check library existence before loading
- Never ignore caught errors (at minimum, log them)
- Use `console.warn()` for recoverable issues, `console.error()` for unexpected errors

---

## macOS-Specific Guidelines
- Guard macOS code with `process.platform === "darwin"`
- Use Bun FFI (`bun:ffi`) for native library interactions
- Define FFI types explicitly when calling native functions
- Handle missing native libraries gracefully with fallback behavior
- Constants for UI positioning grouped at top of file
- Remember main thread required for most AppKit operations
- Use proper memory management with Objective-C++ (ARC enabled)

---

## Svelte Guidelines
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactivity
- Keep components small, focused on single responsibility
- Use `export let` for props, `createEventDispatcher()` for events
- Use `bind:this` for DOM element references
- Prevent default form handling with `on:submit|preventDefault`
- Use `{#key}` blocks for efficient list rendering
- Scope CSS to component unless global styling is needed
- Use `class:` directive for conditional classes

---

## Project Structure
```
/src
  /bun         - Main process (Electrobun, FFI, native integration)
  /mainview    - Svelte UI components, entry points, assets
/native/macos  - Objective-C++ window effects
/scripts       - Build scripts (e.g., build-macos-effects.sh)
```

### Key Config Files
- `electrobun.config.ts` - App packaging config
- `vite.config.js` - Build tool config (root: src/mainview)
- `tailwind.config.js` - CSS framework config
- `tsconfig.json` - TypeScript config (strict mode, ES2020)

---

## Technology Stack
- Runtime: Electrobun with Bun
- UI: Svelte 5 (compiled to vanilla JS)
- Styling: Tailwind CSS
- Build: Vite
- Language: TypeScript
- Native: Objective-C++ via Bun FFI

---

## Cross-Platform Considerations
- All macOS-specific code guarded with `process.platform === "darwin"`
- Provide fallback implementations for non-macOS platforms
- Use `path.join()` instead of hardcoded separators
- Test UI on different screen sizes

---

## Security Guidelines
- Validate all inputs from renderer before passing to native code
- Sanitize external data, be cautious with FFI
- Avoid `eval` and `Function` constructor
- Follow principle of least privilege in permissions
- Keep dependencies updated (`bun audit`, `bun update`)

---

## Dependencies
- Prefer exact versions in package.json for reproducibility
- Use `bun add --dev` for development dependencies
- Document why specific versions are chosen when not using latest
