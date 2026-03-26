<script lang="ts">
  import { cn } from "$lib/utils.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";

  interface Props {
    title: string;
    value: string | number;
    subtitle?: string;
    loading?: boolean;
    class?: string;
  }

  let {
    title,
    value,
    subtitle,
    loading = false,
    class: className,
  }: Props = $props();
</script>

<div class={cn("rounded-lg border bg-card p-4 flex flex-col gap-1", className)}>
  <span
    class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
  >
    {title}
  </span>
  {#if loading}
    <Skeleton class="h-7 w-20" />
    {#if subtitle}
      <Skeleton class="h-3 w-24 mt-0.5" />
    {/if}
  {:else}
    <span class="text-2xl font-semibold tracking-tight">{value}</span>
    {#if subtitle}
      <span class="text-xs text-muted-foreground">{subtitle}</span>
    {/if}
  {/if}
</div>
