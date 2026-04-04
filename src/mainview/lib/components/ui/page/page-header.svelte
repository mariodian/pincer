<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Icon } from "$lib/components/ui/icon";
  import type { Snippet } from "svelte";

  let {
    title,
    description,
    prevPath = "/",
    currentPath = "/",
    showBack = false,
    onBack,
    actions,
    children,
    animationDuration = 300,
  }: {
    title: string;
    description?: string;
    prevPath?: string;
    currentPath?: string;
    showBack?: boolean;
    onBack?: () => void;
    actions?: Snippet;
    children?: Snippet;
    animationDuration?: number;
  } = $props();

  let animationClass = $derived.by(() => {
    // Helper: get path depth (number of segments)
    // Treat root / as depth 1 (main page like /agents or /settings)
    const getDepth = (path: string) => {
      if (path === "/") return 1;
      return path.replace(/\/$/, "").split("/").filter(Boolean).length;
    };

    const prevDepth = getDepth(prevPath);
    const currentDepth = getDepth(currentPath);

    // Going from main page to sub-page (depth increases from 1 to 2)
    // e.g., /agents -> /agents/add, /settings -> /agents/add, / -> /agents/add
    const isGoingToSubPage = prevDepth === 1 && currentDepth === 2;

    // Coming back from sub-page to main page (depth decreases from 2 to 1)
    // e.g., /agents/add -> /agents, /agents/123 -> /settings
    const isReturningFromSubPage = prevDepth === 2 && currentDepth === 1;

    if (isReturningFromSubPage) {
      return "animate-in slide-in-from-right-11";
    } else if (isGoingToSubPage) {
      return "animate-in slide-in-from-left-11";
    }
    return "";
  });
</script>

<div class="flex items-center justify-between mb-6">
  <div class="overflow-hidden">
    <div
      class={[
        "flex items-center gap-3 ",
        animationClass && `transition-all ${animationClass}`,
      ]}
      style="animation-duration: {animationDuration}ms;"
    >
      {#if showBack}
        <Button variant="ghost" size="icon-sm" onclick={onBack}>
          <Icon name="chevronLeft" strokeWidth={2} size={12} />
          <span class="sr-only">Back</span>
        </Button>
      {/if}
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
        {#if description}
          <p class="text-sm text-muted-foreground mt-1">{description}</p>
        {/if}
      </div>
    </div>
  </div>
  {#if actions}
    <div>
      {@render actions()}
    </div>
  {/if}
</div>
{@render children?.()}
