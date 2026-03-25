<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { AgentWithColor } from "$shared/rpc";
  import { scaleBand } from "d3-scale";
  import { curveCatmullRom } from "d3-shape";
  import {
    Area,
    AreaChart,
    BarChart,
    LinearGradient,
    LineChart,
    Spline,
  } from "layerchart";
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

  // X-axis config — use explicit tickValues array for reliable tick count
  // across both band and time scales
  const xAxisConfig = $derived.by(() => {
    const base: Record<string, unknown> = {};
    if (xFormat) base.format = xFormat;
    if (data.length > maxTicks) {
      const step = Math.ceil(data.length / maxTicks);
      base.tickValues = data
        .filter((_, i) => i % step === 0)
        .map((d) => d[xKey]);
    }
    return base;
  });

  // Tooltip config — format x-axis values in tooltip header
  const tooltipConfig = $derived(
    xFormat
      ? { header: { format: xFormat }, mode: "voronoi" }
      : { mode: "voronoi" },
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
    <div class="min-h-70 w-full">
      {#if chartType === "line"}
        <LineChart
          {data}
          x={xKey}
          yNice={4}
          yDomain={[
            -10,
            Math.max(
              ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
            ) * 1.1,
          ]}
          {series}
          brush={true}
          props={{
            spline: {
              strokeWidth: 3,
              curve: curveCatmullRom,
            },
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        >
          <!-- {#snippet marks({})}
            <LinearGradient
              // stops={ticks(1, 0, 10).map(temperatureColor.interpolator())}
              stops={[
                [200, "var(--color-red-500)"],
                // [8, "color-mix(var(--color-red-500) 80%, white)"],
                // [6, "color-mix(var(--color-yellow-500) 60%, white)"],
                // [4, "color-mix(var(--color-green-500) 40%, white)"],
                [200, "var(--color-green-500)"],
              ]}
              class="from-red-500 to-green-500"
              units="userSpaceOnUse"
              vertical
            >
              {#snippet children({ gradient })}
                {#each series as s}
                  <Spline
                    y={(d) => d[s.key]}
                    // Add a line for each series with a gradient stroke
                    stroke={gradient}
                    strokeWidth={3}
                    curve={curveCatmullRom}
                  />
                {/each}
              {/snippet}
            </LinearGradient>
          {/snippet} -->
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
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        />
      {:else if chartType === "area"}
        <AreaChart
          {data}
          // yNice={4}
          // yNice={4}
          xNice={3600}
          // Round x-axis to nearest hour for better label formatting
          yDomain={[-10, 110]}
          // yDomain={[
          //   -10,
          //   Math.max(
          //     ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
          //   ) * 1.05,
          // ]}
          padding={{ left: 20, bottom: 24 }}
          x={xKey}
          {series}
          // radial
          props={{
            area: {
              line: { strokeWidth: 3 },
              curve: curveCatmullRom,
            },
            xAxis: xAxisConfig,
            yAxis: yFormat ? { format: yFormat } : {},
            tooltip: tooltipConfig,
          }}
        >
          {#snippet marks({})}
            {#each series as s}
              <LinearGradient
                // stops={ticks(1, 0, 10).map(temperatureColor.interpolator())}
                // stops={[series.map((s) => `white ${s.color}`)]}
                stops={[
                  // [10, `${s.color}`],
                  // s.color,
                  `color-mix(${s.color} 80%, transparent)`,
                  `color-mix(${s.color} 50%, transparent)`,
                  `color-mix(${s.color} 40%, transparent)`,
                  // `color-mix(${s.color} 75%, transparent)`,
                  // `color-mix(${s.color} 60%, transparent)`,
                  // `color-mix(${s.color} 50%, transparent)`,
                  // "transparent",
                  // [7, `color-mix(${s.color} 80%, transparent)`],
                  // [5, `color-mix(var(--color-yellow-500) 60%, black)`],
                  // [2, `color-mix(${s.color} 30%, transparent)`],
                ]}
                // class={`from-[${s.color}] to-primary/10`}
                units="userSpaceOnUse"
                vertical
              >
                {#snippet children({ gradient })}
                  <Area
                    y1={(d) => d[s.key]}
                    // line={{ class: "stroke-2 stroke-primary/50" }}
                    line={{ stroke: s.color, strokeWidth: 3 }}
                    curve={curveCatmullRom}
                    fill={gradient}
                  />
                {/snippet}
              </LinearGradient>
            {/each}
          {/snippet}
        </AreaChart>
      {/if}
    </div>
  {/if}

  <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
</div>
