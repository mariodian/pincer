<script lang="ts">
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  interface Props {
    title: string;
    description?: string;
    class?: string;
    icon?: Snippet;
    cta?: Snippet;
  }

  let {
    title,
    description,
    class: className,
    icon,
    cta,
  }: Props = $props();
</script>

<div
  class={cn(
    "flex flex-col items-center justify-center text-center",
    className,
  )}
>
  {#if icon}
    <div class="rounded-full bg-destructive/10 p-4 mb-4">
      {@render icon()}
    </div>
  {/if}
  <h3 class="text-lg font-medium mb-1">{title}</h3>
  {#if description}
    <p class="text-sm text-muted-foreground mb-4 max-w-sm">
      {description}
    </p>
  {/if}
  {#if cta}
    {@render cta()}
  {/if}
</div>
