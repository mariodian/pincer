<!-- Context: project-intelligence/lookup/code-standards | Priority: critical | Version: 1.0 -->

# Code & Security Standards

**Purpose**: Rules all code must follow.

## Code Standards

1. TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
2. ES modules only; `const`/`let` (never `var`); `async`/`await` for promises
3. Svelte 5 runes: `$state`, `$derived`, `$effect` (no stores unless cross-component)
4. Wrap I/O and native calls in `try`/`catch` with contextual logging
5. Use `logger` from `loggerService.ts` (not raw `console.*`) in main process
6. shadcn-svelte component style via `bits-ui` + `cn()` utility
7. Import order: external → aliased (`$lib`, `$bun`, `$shared`) → relative
8. Double quotes, semicolons, 2-space indent, trailing commas

## Security Requirements

1. Validate all renderer inputs before passing to native code or storage
2. Avoid `eval`, `new Function()`, and template-based code execution
3. Principle of least privilege
4. Use `isMacOS()` from `utils/platform` for platform guards (not inline checks)
5. Handle missing native libraries gracefully — fall back, don't crash
6. Run `bun audit` regularly

**Reference**: See AGENTS.md § Code Style and § Security.
