<script lang="ts">
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();

  const colors = [
    "var(--heatmap)",
    "var(--heatmap-1)",
    "var(--heatmap-2)",
    "var(--heatmap-3)",
    "var(--heatmap-4)",
    "var(--heatmap-5)",
  ];
</script>

<div class={cn("flex items-center gap-1", className)}>
  <span class="text-muted-foreground text-xs">Less</span>
  {#each colors as color, i (i)}
    <div class="size-3 rounded-xs" style="background-color: {color}"></div>
  {/each}
  <span class="text-muted-foreground text-xs">More</span>
</div>
