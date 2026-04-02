<!-- Context: project-intelligence/examples/code-patterns | Priority: critical | Version: 1.0 -->

# Code Patterns

**Purpose**: Working code examples for Pincer's architecture.

## RPC Method (Main Process)

```typescript
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

**Pattern**: RPC types in `src/bun/rpc/*.ts`. Always validate renderer inputs before processing.

## Component (Svelte 5 + Runes)

```svelte
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

**Pattern**: Props via `$props()`. Events: `onclick={handler}`. CSS via Tailwind + `cn()`.

## Import Order

```typescript
import { BrowserView } from "electrobun/bun"; // 1. External
import { eq } from "drizzle-orm";
import type { Agent } from "$shared/types";     // 2. Aliased
import { agentsTable } from "./schema";          // 3. Relative
```

**Reference**: See AGENTS.md § Code Style for full conventions.
