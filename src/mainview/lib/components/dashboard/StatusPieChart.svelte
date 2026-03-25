<script lang="ts">
  import { cn } from "$lib/utils.js";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import { PieChart } from "layerchart";
  import AgentToggle from "./AgentToggle.svelte";
  import type { AgentWithColor } from "$shared/rpc";
  import type { TimeSeriesPoint } from "$shared/rpc";

  interface Props {
    title: string;
    description?: string;
    /** Raw time series data */
    timeSeries: TimeSeriesPoint[];
    /** Agents to aggregate */
    agents: AgentWithColor[];
    /** Currently selected agent IDs */
    selectedIds: number[];
    /** Toggle an agent on/off */
    onToggleAgent: (id: number) => void;
    class?: string;
  }

  let {
    title,
    description,
    timeSeries,
    agents,
    selectedIds,
    onToggleAgent,
    class: className,
  }: Props = $props();

  // Aggregate status counts for selected agents
  const statusData = $derived.by(() => {
    let okTotal = 0;
    let offlineTotal = 0;
    let errorTotal = 0;

    const selectedSet = new Set(selectedIds);
    for (const point of timeSeries) {
      if (!selectedSet.has(point.agentId)) continue;
      okTotal += point.okCount;
      offlineTotal += point.offlineCount;
      errorTotal += point.errorCount;
    }

    return [
      { status: "ok", count: okTotal, color: "var(--chart-1)" },
      { status: "offline", count: offlineTotal, color: "var(--chart-7)" },
      { status: "error", count: errorTotal, color: "var(--chart-6)" },
    ].filter((d) => d.count > 0);
  });

  const totalCount = $derived(
    statusData.reduce((sum, d) => sum + d.count, 0),
  );

  const chartConfig = $derived.by(() => {
    const config: Record<string, { label: string; color: string }> = {};
    for (const agent of agents) {
      config[`agent_${agent.id}`] = { label: agent.name, color: agent.color };
    }
    return {
      ok: { label: "OK", color: "var(--chart-1)" },
      offline: { label: "Offline", color: "var(--chart-7)" },
      error: { label: "Error", color: "var(--chart-6)" },
      ...config,
    } satisfies Chart.ChartConfig;
  });
</script>

<div class={cn("rounded-lg border bg-card p-4 flex flex-col gap-3", className)}>
  <div>
    <h3 class="text-sm font-semibold">{title}</h3>
    {#if description}
      <p class="text-xs text-muted-foreground mt-0.5">{description}</p>
    {/if}
  </div>

  {#if totalCount === 0}
    <div
      class="flex aspect-video items-center justify-center text-sm text-muted-foreground"
    >
      No data for this period.
    </div>
  {:else}
    <Chart.Container config={chartConfig} class="min-h-[200px] w-full">
      <PieChart
        data={statusData}
        key="status"
        value="count"
        innerRadius={60}
        props={{
          pie: {
            padAngle: 3,
          },
        }}
      >
        {#snippet tooltip()}
          <Chart.Tooltip />
        {/snippet}
      </PieChart>
    </Chart.Container>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 justify-center">
      {#each statusData as item (item.status)}
        <div class="flex items-center gap-1.5 text-xs">
          <span
            class="size-2.5 rounded-[2px]"
            style="background-color: {item.color};"
          ></span>
          <span class="text-muted-foreground capitalize">{item.status}</span>
          <span class="font-mono font-medium">{item.count.toLocaleString()}</span>
        </div>
      {/each}
    </div>
  {/if}

  <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
</div>
