<script lang="ts">
  import {
    type ChartSeries,
    getSeriesFiniteValue,
    sanitizeSeriesData,
  } from "$lib/utils/chart.js";
  import { scaleBand } from "d3-scale";
  import {
    BarChart,
    Bars,
    defaultChartPadding,
    LinearGradient,
  } from "layerchart";

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
    radius = 6,
    rounded = "edge",
    height,
    padding,
  }: Props = $props();

  const sanitizedData = $derived(sanitizeSeriesData(data, series));

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
    {@const getBarsProps = args?.getBarsProps ?? fallbackGetBarsProps}
    {@const visibleSeries = args?.visibleSeries ?? series}
    {#each visibleSeries as s, i (s.key)}
      {#if colorGradient}
        <LinearGradient
          stops={[
            [0, s.color ?? "currentColor"],
            [
              1,
              `color-mix(in srgb, ${s.color ?? "currentColor"} 30%, transparent)`,
            ],
          ]}
          vertical
        >
          {#snippet children({ gradient })}
            <Bars
              {...getBarsProps(s, i)}
              data={s?.data ?? sanitizedData}
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
          {...getBarsProps(s, i)}
          data={s?.data ?? sanitizedData}
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
