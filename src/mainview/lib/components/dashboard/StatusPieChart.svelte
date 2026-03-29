<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";
  import { format } from "@layerstack/utils";
  import { defaultChartPadding, PieChart, Text } from "layerchart";
  import AgentToggle from "./AgentToggle.svelte";

  const DEFAULT_PADDING = 24;

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
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
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
    padding,
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
  const chartHeight = $derived(Math.max(160, height));
  // Scale font size with chart height, between 20 and 48
  const fontSize = $derived(Math.min(Math.max(20, chartHeight / 8), 48));
  const textPosition = $derived(fontSize * 1.1);

  /*
   * Calculate inner and outer radius based on chart height to maintain good proportions.
   * Inner radius is a small fraction of the chart height, while outer radius is larger but capped.
   */
  const innerRadius = $derived(
    Math.min(Math.max(-20, 0 - chartHeight / 12), -10),
  );
  const outerRadius = $derived(Math.min(Math.max(100, chartHeight / 1.7), 180));
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
      class={[
        "min-h-50",
        "flex flex-1 items-center justify-center",
        "text-sm text-muted-foreground",
      ]}
    >
      No data for this period.
    </div>
  {:else}
    <div class="w-full h-50 lg:h-60">
      <PieChart
        data={statusData}
        key="status"
        value="count"
        cRange={[colors.ok, colors.offline, colors.error]}
        // height={chartHeight}
        range={[-90, 90]}
        {outerRadius}
        {innerRadius}
        cornerRadius={chartHeight / 20}
        padAngle={0.02}
        props={{ group: { y: chartHeight / 4 + 25 } }}
        padding={{
          ...defaultChartPadding({
            top: DEFAULT_PADDING,
            right: DEFAULT_PADDING,
            bottom: DEFAULT_PADDING,
            left: DEFAULT_PADDING,
          }),
          ...padding,
        }}
        // padding={{ right: 80, top: 40, bottom: 40 }}
        legend={{
          placement: "right",
          orientation: "vertical",
          variant: "swatches",
        }}
      >
        {#snippet aboveMarks()}
          <Text
            value={format(totalCount, "metric")}
            textAnchor="middle"
            verticalAnchor="middle"
            class="font-semibold"
            font-size={fontSize}
            dy={textPosition}
          />
          <Text
            value="Total"
            textAnchor="middle"
            verticalAnchor="middle"
            class="text-sm font-medium text-muted-foreground"
            dy={textPosition * 1.8}
          />
        {/snippet}
      </PieChart>
    </div>
  {/if}

  <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
</div>
