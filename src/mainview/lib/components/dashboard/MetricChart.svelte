<script lang="ts">
  import { cn } from "$lib/utils.js";
  import * as Chart from "$lib/components/ui/chart/index.js";
  import { BarChart, LineChart, AreaChart } from "layerchart";
  import { scaleBand } from "d3-scale";
  import AgentToggle from "./AgentToggle.svelte";
  import type { AgentWithColor } from "$shared/rpc";
  import type { Snippet } from "svelte";

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
    /** Tooltip snippet */
    tooltip?: Snippet;
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
    tooltip,
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
    <Chart.Container
      config={chartConfig}
      class="min-h-[200px] w-full"
    >
      {#if chartType === "line"}
        <LineChart
          {data}
          x={xKey}
          {series}
          props={{
            xAxis: xFormat ? { format: xFormat } : {},
            yAxis: yFormat ? { format: yFormat } : {},
          }}
        >
          {#if tooltip}
            {@render tooltip()}
          {:else}
            {#snippet tooltip()}
              <Chart.Tooltip />
            {/snippet}
          {/if}
        </LineChart>
      {:else if chartType === "bar"}
        <BarChart
          {data}
          xScale={scaleBand().padding(0.15)}
          x={xKey}
          axis="x"
          seriesLayout="group"
          {series}
          props={{
            xAxis: xFormat
              ? { format: xFormat, tickSpacing: 60 }
              : { tickSpacing: 60 },
            yAxis: yFormat ? { format: yFormat } : {},
          }}
        >
          {#if tooltip}
            {@render tooltip()}
          {:else}
            {#snippet tooltip()}
              <Chart.Tooltip />
            {/snippet}
          {/if}
        </BarChart>
      {:else if chartType === "area"}
        <AreaChart
          {data}
          x={xKey}
          {series}
          props={{
            xAxis: xFormat ? { format: xFormat } : {},
            yAxis: yFormat ? { format: yFormat } : {},
          }}
        >
          {#if tooltip}
            {@render tooltip()}
          {:else}
            {#snippet tooltip()}
              <Chart.Tooltip />
            {/snippet}
          {/if}
        </AreaChart>
      {/if}
    </Chart.Container>
  {/if}

  <AgentToggle
    {agents}
    {selectedIds}
    onToggle={onToggleAgent}
  />
</div>
