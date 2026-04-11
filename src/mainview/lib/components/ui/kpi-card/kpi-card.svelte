<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { cn } from "$lib/utils.js";
  import {
    kpiCardVariants,
    type KpiCardColor,
    type KpiCardGradient,
  } from "./kpi-card-variants.js";

  let {
    title,
    value,
    subtitle,
    loading = false,
    color = "default",
    gradient = false,
    class: className,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    loading?: boolean;
    color?: KpiCardColor;
    gradient?: KpiCardGradient;
    class?: string;
  } = $props();
</script>

<div class={cn(kpiCardVariants({ color, gradient }), className)}>
  {#if loading}
    <Skeleton class="h-4 w-20 text-white" />
    <Skeleton class="h-7 w-20" />
    {#if subtitle}
      <Skeleton class="h-3 w-24 mt-0.5" />
    {/if}
  {:else}
    <span class="text-xs font-medium uppercase tracking-wide opacity-80">
      {title}
    </span>
    <span class="text-2xl font-semibold tracking-tight">{value}</span>
    {#if subtitle}
      <span class="text-xs opacity-75">{subtitle}</span>
    {/if}
  {/if}
</div>
