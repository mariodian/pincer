# CrabControl Agent Guidelines

## 📦 Build, Lint, and Test Commands

### Development
- `bun run dev` - Standard development mode
- `bun run dev:hmr` - Development with Vite HMR
- `bun run hmr` - Start Vite HMR server on port 5173

### Building
- `bun run build:native-effects` - Compiles macOS native effects library
- `bun run build` - Full production build
- `bun run build:prod` - Production build for release channel

### Running
- `bun run start` - Alias for dev mode

### Testing
> ⚠️ No test framework configured. Suggested approaches:
> - Unit tests: Vitest or Bun test with Svelte Testing Library
> - E2E tests: Consider Playwright
> - Native code: Manual testing or CI with macOS runners

### Scripts Reference
- `scripts/build-macos-effects.sh`: Builds native dylib using clang++

## 🔧 Code Style Guidelines

### TypeScript/JavaScript
- Based on `tsconfig.json`: Target ES2020, strict mode enabled
- Use ES modules (`import`/`export`)
- Prefer const/let over var
- Use arrow functions for concise callbacks
- Handle promises with async/await
- Enable strict null checking
- Always specify return types for function declarations

### File Organization
- Main process: `src/bun/index.ts` - Electrobun/Bun FFI integration
- UI layer: `src/mainview/` - Svelte components and assets
- Native code: `native/macos/window-effects.mm` (referenced)
- Build scripts: `scripts/`
- Configuration: `electrobun.config.ts`, `vite.config.js`, `tailwind.config.js`

### Imports
- Group imports: external libraries first, then internal modules
- Within groups, sort alphabetically
- Use relative imports for local files: `import { fn } from "./utils"`

### Formatting
- No explicit formatter configured
- Follow existing code patterns in the repository
- Consistent indentation (2 spaces)
- Semicolons used consistently
- Max line length: Aim for 80-100 characters
- Empty lines: Use to separate logical blocks

### Naming Conventions
- Constants: UPPER_SNAKE_CASE (e.g., `MAC_TRAFFIC_LIGHTS_X`)
- Variables and functions: camelCase (e.g., `isMacOS`, `applyMacOSWindowEffects`)
- Type names and interfaces: PascalCase (e.g., `WindowEffects`, `AppProps`)
- Files: kebab-case for config/utils, PascalCase for components (App.svelte)
- Private members: prefix with underscore if needed
- Boolean variables: Use is/has/can prefixes
- Event handlers: Use handlePrefix (handleClick, handleSubmit)
- Async functions: Consider suffix with Async or verb prefix (loadData)

### Error Handling
- Use try/catch for synchronous and asynchronous operations
- Log errors with context before rethrowing or handling gracefully
- In native bridging code, check for existence of libraries before loading
- Provide fallback behavior when native features unavailable
- Never ignore caught errors; at minimum log them
- For async operations, either use try/catch or .catch() handlers
- Validate inputs at function boundaries
- Use console.warn() for recoverable issues, console.error() for unexpected errors

### macOS Specific Guidelines
- Guard macOS-specific code with `process.platform === "darwin"` checks
- Use Bun FFI (`bun:ffi`) for native library interactions
- Define FFI types explicitly when calling native functions
- Handle missing native libraries gracefully with fallback behavior
- Constants for UI positioning should be clearly named and grouped at top of file
- Consider using NSView coordinate system conventions (origin at bottom-left)
- Remember that main thread is required for most AppKit operations
- Use proper memory management with Objective-C++ (ARC is enabled in build)
- Test on multiple macOS versions if possible (consider deployment target)

### Comments and Documentation
- Use JSDoc for public APIs and complex functions (`/** ... */`)
- Explain why, not what, in comments
- Reference constants with explanations of their purpose
- Document platform-specific behavior and limitations
- Use TODO: comments for technical debt with target resolution if possible
- Avoid commenting out code; use version control instead
- For complex logic, add inline comments explaining the reasoning
- Document function parameters and return values in JSDoc
- Keep comments up-to-date when modifying code

## 📁 Project Structure
```
/src
  /bun
    index.ts          # Main process with Electrobun setup, FFI loading, macOS integration
    libMacWindowEffects.dylib  # Built native library (generated during build)
  /mainview
    App.svelte        # Main UI component (Svelte)
    main.ts           # Entry point for Svelte app (hydration)
    index.html        # HTML template
    index.css         # Global styles (Tailwind base)
/native
  /macos
    window-effects.mm # Objective-C++ native implementation (window effects)
/scripts
  build-macos-effects.sh  # Builds native dylib using clang++
```

## ⚙️ Technology Stack
- Runtime: Electrobun with Bun (Node.js compatible)
- UI: Svelte (compiled to vanilla JavaScript)
- Styling: Tailwind CSS (utility-first CSS framework)
- Build Tool: Vite (ES modules, fast HMR)
- Language: TypeScript (with JSX for Svelte components)
- Native: Objective-C++ via Bun FFI (for macOS-specific window effects)
- Packaging: Electrobun (creates native desktop applications)

## 🧩 Svelte Specific Guidelines
- Use Svelte 5 runes ($state, $derived, $effect) for reactivity
- Keep components small and focused on single responsibility
- Use `export let` for props with default values when appropriate
- Dispatch events using `createEventDispatcher()` for component communication
- Use `bind:this` for DOM element references when needed
- Prevent default form handling with `on:submit|preventDefault`
- Use `{#key}` blocks for efficient list rendering when item order changes
- Scope CSS to component unless global styling is intentionally needed
- Use `class:` directive for conditional class application
- Leverage Svelte stores for state that needs to be shared across components
- Implement loading states and error boundaries in components
- Use transitions and animations sparingly for enhanced UX
- Follow Svelte accessibility best practices (aria-labels, semantic elements)

## 📱 Cross-Platform Considerations
- All macOS-specific code must be guarded with `process.platform === "darwin"`
- Provide fallback implementations for non-macOS platforms
- Test UI on different screen sizes and resolutions
- Consider different window management behaviors across platforms
- Be aware of varying default fonts and UI metrics between operating systems
- Use path joining functions (`path.join`) instead of hardcoded separators
- Consider timezone and locale differences in date/time handling
- Remember that menu bar conventions differ (macOS vs Windows/Linux)

## 🔍 Debugging and Development Tips
- Use `console.log` judiciously; consider debug levels for production
- For native debugging, inspect Xcode console output
- Use Electron DevTools for renderer process inspection (Cmd+Option+I)
- Check Bun process logs for main process issues
- When FFI calls fail, verify library existence and function signatures
- Use `bun run dev:hmr` for rapid UI iteration during development
- Monitor memory usage, especially when dealing with native resources
- Consider using `--inspect` flag for debugging Bun processes
- Verify native library loading with `dlopen` error handling
- Test window resizing behavior to ensure effects persist correctly

## 🔒 Security Guidelines
- Validate all inputs from renderer process before passing to native code
- Sanitize any data loaded from external sources
- Be cautious with FFI; ensure proper type checking to prevent memory corruption
- Follow principle of least privilege in Electron/electrobun permissions
- Keep dependencies updated to address security vulnerabilities
- Consider implementing CSP (Content Security Policy) for renderer
- Avoid evaluating strings as code (eval, Function constructor)
- Be mindful of prototype pollution when merging objects
- Use secure random functions for cryptographic purposes
- Consider implementing update authentication for production builds

## 📦 Dependencies Management
- Prefer exact versions in package.json for reproducible builds
- Regularly run `bun update` to get latest compatible versions
- Audit dependencies with `bun audit` periodically
- Consider using `bun add --dev` for development dependencies
- Keep peer dependencies in mind when adding new packages
- Avoid duplicating functionality that already exists in dependencies
- When adding new native dependencies, consider build time and size impact
- Document why specific versions are chosen when using non-latest