<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor } from "$shared/rpc";
  import { scaleBand } from "d3-scale";
  import { AreaChart, BarChart, LineChart } from "layerchart";
  import AgentToggle from "./AgentToggle.svelte";

  export type ChartType = "line" | "bar" | "area";

  interface Props {
    chartType: ChartType;
    title: string;
    description?: string;
    /** Pivoted data: each row has [xKey] + a key per agent (e.g. "uptime_1") */
    data: Record<string, unknown>[];
    /** X-axis key in data */
    xKey: string;
    /** Agents to render as series */
    agents: AgentWithColor[];
    /** Currently selected agent IDs */
    selectedIds: number[];
    /** Toggle an agent on/off */
    onToggleAgent: (id: number) => void;
    /** Y-axis value prefix used in data keys (e.g. "uptime", "response") */
    yPrefix: string;
    /** Optional formatter for x-axis ticks */
    xFormat?: (val: unknown) => string;
    /** Optional formatter for y-axis ticks */
    yFormat?: (val: unknown) => string;
    /** Maximum number of x-axis labels to show */
    maxTicks?: number;
    /** Extra class on the chart card */
    class?: string;
  }

  let {
    chartType,
    title,
    description,
    data,
    xKey,
    agents,
    selectedIds,
    onToggleAgent,
    yPrefix,
    xFormat,
    yFormat,
    maxTicks = 8,
    class: className,
  }: Props = $props();

  // Build chart config from agents
  const chartConfig = $derived.by(() => {
    const config: Record<string, { label: string; color: string }> = {};
    for (const agent of agents) {
      const key = `${yPrefix}_${agent.id}`;
      config[key] = { label: agent.name, color: agent.color };
    }
    return config;
  });

  // Build series from selected agents
  const series = $derived.by(() => {
    return agents
      .filter((a) => selectedIds.includes(a.id))
      .map((agent) => {
        const key = `${yPrefix}_${agent.id}`;
        return {
          key,
          label: chartConfig[key]?.label ?? agent.name,
          color: chartConfig[key]?.color ?? agent.color,
        };
      });
  });

  // X-axis config with tick limit to prevent crowding
  // For band scales, layerchart's `ticks` means "show every Nth value",
  // so we convert maxTicks (desired label count) to the correct step
  const xAxisConfig = $derived({
    ...(xFormat ? { format: xFormat } : {}),
    ticks: data.length > 0 ? Math.max(1, Math.ceil(data.length / maxTicks)) : 1,
  });

  // Tooltip config — format x-axis values in tooltip header
  const tooltipConfig = $derived(
    xFormat ? { header: { format: xFormat } } : {},
  );
</script>

<div class={cn("rounded-lg border bg-card p-4 flex flex-col gap-3", className)}>
  <div class="flex items-start justify-between gap-4">
    <div>
      <h3 class="text-sm font-semibold">{title}</h3>
      {#if description}
        <p class="text-xs text-muted-foreground mt-0.5">{description}</p>
      {/if}
    </div>
  </div>

  {#if data.length === 0}
    <div
      class="flex aspect-video items-center justify-center text-sm text-muted-foreground"
    >
      No data for this period.
    </div>
  {:else}
    <div class="min-h-[200px] w-full">
      {#if chartType === "line"}
        <LineChart
          {data}
          x={xKey}
          {series}
          props={{
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        />
      {:else if chartType === "bar"}
        <BarChart
          {data}
          xScale={scaleBand().padding(0.15)}
          x={xKey}
          axis="x"
          seriesLayout="group"
          {series}
          props={{
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        />
      {:else if chartType === "area"}
        <AreaChart
          {data}
          x={xKey}
          {series}
          props={{
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        />
      {/if}
    </div>
  {/if}

  <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
</div>
