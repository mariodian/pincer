<script lang="ts">
  import type { AgentWithColor } from "$shared/rpc";
  import type { TimeRange } from "$shared/types";

  import * as Card from "$lib/components/ui/card";
  import { cn } from "$lib/utils";
  import { padToFullRange, type PivotedRow } from "$lib/utils/metrics-data";
  import GapAreaChart from "../charts/GapAreaChart.svelte";
  import GapLineChart from "../charts/GapLineChart.svelte";
  import GradientBarChart from "../charts/GradientBarChart.svelte";
  import AgentToggle from "./AgentToggle.svelte";

  export type ChartType = "line" | "bar" | "area";

  interface Props {
    chartType: ChartType;
    title: string;
    description?: string;
    /** Pivoted data: each row has [xKey] + a key per agent (e.g. "uptime_1") */
    data: PivotedRow[];
    /** X-axis key in data */
    xKey: string;
    /** Agents to render as series */
    agents: AgentWithColor[];
    /** Currently selected agent IDs */
    selectedIds: number[];
    /** Toggle an agent on/off */
    onToggleAgent: (id: number) => void;
    /** Y-axis value prefix used in data keys (e.g. "uptime", "response") */
    yPrefix: "uptime" | "response";
    /** Optional formatter for x-axis ticks */
    xFormat?: (val: unknown) => string;
    /** Optional formatter for y-axis ticks */
    yFormat?: (val: unknown) => string;
    /** Maximum number of x-axis labels to show */
    maxTicks?: number;
    /** Extra class on the chart card */
    class?: string;
    gaps?: boolean;
    gradient?: boolean;
    strokeWidth?: number;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    height?: number;
    /** Time range for full-range padding (pads to 7/30 days when set) */
    timeRange?: TimeRange;
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
    gaps,
    gradient,
    strokeWidth,
    padding,
    height,
    timeRange,
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

  // X-axis config — limit tick density for all chart types to prevent
  // overcrowding. For 24h charts with ~24 data points, this caps at ~8 labels.
  // Note: band scales (bar) use `ticks`, time scales (line/area) use `tickValues`.
  const xAxisConfig = $derived.by(() => {
    const base: Record<string, unknown> = {};
    if (xFormat) base.format = xFormat;
    if (data.length > maxTicks) {
      const step = Math.ceil(data.length / maxTicks);
      const tickData = data
        .filter((_, i) => i % step === 0)
        .map((d) => d[xKey]);
      if (chartType === "bar") {
        base.ticks = tickData;
      } else {
        base.tickValues = tickData;
      }
    }
    return base;
  });

  // Tooltip config — format x-axis values in tooltip header, round values to integers
  const tooltipConfig = $derived({
    ...(xFormat ? { header: { format: xFormat } } : {}),
    item: { format: "integer" as const },
  });

  // Apply full-range padding when timeRange is set (and not 24h)
  const chartData = $derived.by(() => {
    if (!timeRange || timeRange === "24h") return data;
    return padToFullRange(data, agents, yPrefix, timeRange);
  });

  // Common props shared by all chart types
  const commonChartProps = $derived({
    data: chartData,
    series,
    x: xKey,
    xAxis: xAxisConfig,
    yAxis: yFormat ? { format: yFormat } : {},
    tooltip: tooltipConfig,
    strokeWidth,
    padding,
    height,
  });
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-sm font-semibold">{title}</Card.Title>
    {#if description}
      <Card.Description class="text-sm">{description}</Card.Description>
    {/if}
  </Card.Header>
  <Card.Content class={cn("flex flex-col", className)}>
    {#if data.length === 0 || series.length === 0}
      <div
        class={[
          "min-h-50",
          "flex flex-1 items-center justify-center",
          "text-muted-foreground text-sm",
        ]}
      >
        No data for this period.
      </div>
    {:else}
      <div class="min-h-50 w-full lg:h-60">
        {#if chartType === "line"}
          <GapLineChart
            {...commonChartProps}
            {gaps}
            colorGradient={gradient}
            xDomainPadding={0.025}
          />
        {:else if chartType === "bar"}
          <GradientBarChart {...commonChartProps} colorGradient={gradient} />
        {:else if chartType === "area"}
          <GapAreaChart
            {...commonChartProps}
            {gaps}
            colorGradient={gradient}
            xDomainPadding={0.025}
          />
        {/if}
      </div>
    {/if}
  </Card.Content>
  <Card.Footer>
    <AgentToggle {agents} {selectedIds} onToggle={onToggleAgent} />
  </Card.Footer>
</Card.Root>
