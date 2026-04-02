<!-- Context: project-intelligence/technical | Priority: critical | Version: 1.1 | Updated: 2026-03-29 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for Pincer.
**Last Updated**: 2026-03-29

## Quick Reference

**Update Triggers**: Tech stack changes | New patterns | Architecture decisions
**Audience**: Developers, AI agents

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

## Code Patterns

### RPC Method (Main Process)

```typescript
// src/bun/rpc/agentRPC.ts
import { BrowserView } from "electrobun/bun";
import { agentService } from "../services/agentService";

export const getAgents = BrowserView.defineRPC<() => Agent[]>(async () => {
  try {
    return await agentService.getAll();
  } catch (error) {
    logger.error("agentRPC", "Failed to fetch agents:", error);
    throw error;
  }
});
```

### Component (Svelte 5 + Runes)

```svelte
<!-- src/mainview/lib/components/dashboard/KpiCard.svelte -->
<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    title: string;
    value: string | number;
    class?: string;
  }

  let { title, value, class: className }: Props = $props();
</script>

<div class={cn("rounded-lg border p-4", className)}>
  <p class="text-sm text-muted-foreground">{title}</p>
  <p class="text-2xl font-bold">{value}</p>
</div>
```

## Naming Conventions

| Type                   | Convention        | Example                    |
| ---------------------- | ----------------- | -------------------------- |
| Files (services/utils) | kebab-case.ts     | windowService.ts           |
| Files (components)     | PascalCase.svelte | AgentForm.svelte           |
| Constants              | UPPER_SNAKE_CASE  | MAC_TRAFFIC_LIGHTS_X       |
| Variables/functions    | camelCase         | applyMacOSWindowEffects    |
| Types/interfaces       | PascalCase        | WindowEffects, AgentStatus |
| Booleans               | is/has/can prefix | isMacOS, hasFocus          |
| Event handlers         | handle prefix     | handleClick, handleSubmit  |
| Database tables        | snake_case        | settings_general           |

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

## 📂 Codebase References

**RPC Layer**: `src/bun/rpc/` — agentRPC.ts, statsRPC.ts, settingsRPC.ts, systemRPC.ts
**Services**: `src/bun/services/` — agentService.ts, loggerService.ts
**Components**: `src/mainview/lib/components/` — ui/ (shadcn), dashboard/, agents/
**Platform Utils**: `src/bun/utils/platform.ts` — isMacOS() helper
**Config**: package.json, tsconfig.json, electrobun.config.ts, drizzle.config.ts

## Related Files

- AGENTS.md (full coding standards reference)
- Business Domain (create with `/add-context --business`)
