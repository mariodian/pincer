<script lang="ts">
  import { scaleBand } from "d3-scale";
  import {
    BarChart,
    Bars,
    defaultChartPadding,
    LinearGradient,
  } from "layerchart";

  import {
    computeGradientStops,
    getSeriesFiniteValue,
    sanitizeSeriesData,
    type ChartSeries,
  } from "$lib/utils/chart.js";

  const DEFAULT_PADDING = 24;

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: ChartSeries[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    colorGradient?: boolean;
    strokeWidth?: number;
    radius?: number;
    rounded?:
      | "all"
      | "none"
      | "edge"
      | "top"
      | "bottom"
      | "left"
      | "right"
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right";
    height?: number;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
  }

  let {
    data,
    x,
    series,
    xAxis,
    yAxis,
    tooltip,
    colorGradient = false,
    strokeWidth = 0,
    radius = 4,
    rounded = "edge",
    height,
    padding,
  }: Props = $props();

  const sanitizedData = $derived(sanitizeSeriesData(data, series));

  const gradientStops = $derived(computeGradientStops(series));

  const fallbackGetBarsProps = (s: ChartSeries) => ({
    data: s?.data ?? sanitizedData,
  });
</script>

<BarChart
  data={sanitizedData}
  xScale={scaleBand().padding(0.15)}
  {x}
  {series}
  {height}
  padding={{
    ...defaultChartPadding({
      top: DEFAULT_PADDING,
      right: DEFAULT_PADDING,
      bottom: DEFAULT_PADDING,
      left: DEFAULT_PADDING,
    }),
    ...padding,
  }}
  axis="x"
  seriesLayout="group"
  props={{
    xAxis: xAxis,
    yAxis: yAxis,
    tooltip: tooltip,
  }}
>
  {#snippet marks(args)}
    {@const visibleSeries = args.context.series.visibleSeries}
    {#each visibleSeries as s (s.key)}
      {@const { data: barData } = fallbackGetBarsProps(s)}
      {#if colorGradient}
        <LinearGradient stops={gradientStops[s.key]} vertical>
          {#snippet children({ gradient })}
            <Bars
              seriesKey={s.key}
              data={barData}
              x1={() => s.key}
              y={(d) => getSeriesFiniteValue(d, s?.key)}
              fill={gradient}
              stroke={s.color ?? "currentColor"}
              {radius}
              {rounded}
              {strokeWidth}
            />
          {/snippet}
        </LinearGradient>
      {:else}
        <Bars
          seriesKey={s.key}
          data={barData}
          x1={() => s.key}
          y={(d) => getSeriesFiniteValue(d, s?.key)}
          fill={s.color ?? "currentColor"}
          stroke={s.color ?? "currentColor"}
          {radius}
          {rounded}
          {strokeWidth}
        />
      {/if}
    {/each}
  {/snippet}
</BarChart>
