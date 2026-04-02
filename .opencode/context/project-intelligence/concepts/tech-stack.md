<!-- Context: project-intelligence/concepts/tech-stack | Priority: critical | Version: 1.0 -->

# Tech Stack

**Purpose**: Primary technologies and versions for Pincer desktop app.

## Primary Stack

| Layer        | Technology              | Version | Rationale                                     |
| ------------ | ----------------------- | ------- | --------------------------------------------- |
| Runtime      | Electrobun + Bun        | 1.16.0  | Ultra-fast TypeScript desktop framework       |
| UI Framework | Svelte 5 (runes)        | ^5.0.0  | Reactive UI with fine-grained reactivity      |
| Language     | TypeScript (strict)     | ES2020  | Type safety, strict mode enforced             |
| Database     | Drizzle ORM + SQLite    | ^0.45.1 | Type-safe queries, local-first storage        |
| Styling      | Tailwind CSS v4         | ^4.2.0  | Utility-first, @tailwindcss/vite plugin       |
| Components   | shadcn-svelte (bits-ui) | ^2.16.3 | Accessible primitives, cn() utility           |
| Build        | Vite                    | latest  | HMR, 3 entry points (main/background/preload) |
| Native       | Objective-C++ (Bun FFI) | —       | macOS window effects, vibrancy                |

## Key Configs

- `electrobun.config.ts` — packaging and distribution
- `vite.config.js` — 3 entry points, root: `src/mainview`
- `tsconfig.json` — strict, path aliases (`$lib`, `$bun`, `$shared`)
- `drizzle.config.ts` — SQLite schema location

**Reference**: See AGENTS.md for full build commands.
