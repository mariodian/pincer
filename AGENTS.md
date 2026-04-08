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
