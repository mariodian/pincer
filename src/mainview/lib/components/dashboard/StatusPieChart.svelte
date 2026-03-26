<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";
  import { format } from "@layerstack/utils";
  import { PieChart, Text } from "layerchart";
  import AgentToggle from "./AgentToggle.svelte";

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
    height: number;
    class?: string;
  }

  let {
    title,
    description,
    timeSeries,
    agents,
    selectedIds,
    onToggleAgent,
    height = 300,
    class: className,
  }: Props = $props();

  const colors = {
    ok: "var(--color-green-500)",
    offline: "var(--color-yellow-400)",
    error: "color-mix(var(--secondary) 30%, var(--primary) 40%)",
  };

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
      { status: "OK", count: okTotal, color: colors.ok },
      { status: "Offline", count: offlineTotal, color: colors.offline },
      { status: "Error", count: errorTotal, color: colors.error },
    ].filter((d) => d.count > 0);
  });

  const totalCount = $derived(statusData.reduce((sum, d) => sum + d.count, 0));
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
    <!-- <Chart.Container config={chartConfig} class="min-h-50 w-full"> -->
    <PieChart
      data={statusData}
      key="status"
      value="count"
      cRange={[colors.ok, colors.offline, colors.error]}
      {height}
      range={[-90, 90]}
      outerRadius={160}
      innerRadius={-20}
      cornerRadius={10}
      padAngle={0.02}
      props={{ group: { y: 160 / 2 } }}
      padding={{ right: 80, top: 40, bottom: 40 }}
      legend={{
        placement: "right",
        orientation: "vertical",
        variant: "swatches",
      }}
      // height={300}
    >
      {#snippet aboveMarks()}
        <Text
          value={format(totalCount)}
          textAnchor="middle"
          verticalAnchor="middle"
          class="text-4xl font-semibold"
          dy={8}
        />
        <Text
          value="Total"
          textAnchor="middle"
          verticalAnchor="middle"
          class="text-sm font-medium text-muted-foreground"
          dy={32}
        />
      {/snippet}
    </PieChart>
  {/if}

  <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
</div>
