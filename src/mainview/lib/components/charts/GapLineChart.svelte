<script lang="ts">
  import {
    buildAllSeriesGaps,
    buildLineHighlightPointProps,
    computeGradientStops,
    computeXDomain,
    computeYDomain,
    countValidDataPoints,
    type ChartSeries,
  } from "$lib/utils/chart.js";
  import { curveCatmullRom } from "d3-shape";
  import { defaultChartPadding, LinearGradient, LineChart } from "layerchart";
  import SeriesDot from "./SeriesDot.svelte";
  import LineSpline from "./LineSpline.svelte";

  const DEFAULT_PADDING = 24;

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: ChartSeries[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
    strokeWidth?: number;
    gaps?: boolean;
    colorGradient?: boolean;
    height?: number;
    xDomainPadding?: number;
  }

  let {
    data,
    x,
    series,
    xAxis,
    yAxis,
    tooltip,
    padding,
    gaps = false,
    colorGradient = false,
    strokeWidth = 3,
    height,
    xDomainPadding = 0.05,
  }: Props = $props();

  const lineGaps = $derived(buildAllSeriesGaps(data, series, gaps));
  const xDomain = $derived(computeXDomain(data, x, xDomainPadding));
  const yDomain = $derived(computeYDomain(data, series));
  const singlePointKeys = $derived(
    new Set(
      series
        .filter((s) => countValidDataPoints(s.data ?? data, s.key) === 1)
        .map((s) => s.key),
    ),
  );

  const gradientStops = $derived(computeGradientStops(series));
</script>

{#snippet seriesLine(s: ChartSeries, highlightKey: string | null)}
  {#if colorGradient}
    <LinearGradient
      stops={gradientStops[s.key]}
      units="userSpaceOnUse"
      vertical
    >
      {#snippet children({ gradient }: { gradient: string })}
        <LineSpline
          series={s}
          {highlightKey}
          stroke={gradient}
          {strokeWidth}
          {data}
        />
      {/snippet}
    </LinearGradient>
  {:else}
    <LineSpline
      series={s}
      {highlightKey}
      stroke={s.color ?? "currentColor"}
      {strokeWidth}
      {data}
    />
  {/if}
{/snippet}

{#snippet chartMarks(args: {
  context: {
    series: { highlightKey: string | null; visibleSeries: ChartSeries[] };
    xScale: (d: Date) => number;
    yScale: (n: number) => number;
    x: (d: Record<string, unknown>) => Date;
  };
})}
  {@const highlightKey = args.context.series.highlightKey}
  {@const visibleSeries = args.context.series.visibleSeries}
  {@const xScale = args.context.xScale}
  {@const yScale = args.context.yScale}
  {@const xGet = args.context.x}
  {#each visibleSeries as s (s.key)}
    {#if singlePointKeys.has(s.key)}
      <SeriesDot
        series={s}
        {xScale}
        {yScale}
        {xGet}
        {highlightKey}
        {strokeWidth}
        {data}
      />
    {:else}
      {@render seriesLine(s, highlightKey)}
    {/if}
  {/each}
{/snippet}

<LineChart
  {data}
  {x}
  {xDomain}
  {yDomain}
  {series}
  padding={{
    ...defaultChartPadding({
      top: DEFAULT_PADDING,
      right: DEFAULT_PADDING,
      bottom: DEFAULT_PADDING,
      left: DEFAULT_PADDING,
    }),
    ...padding,
  }}
  {height}
  brush
  props={{
    highlight: {
      points: buildLineHighlightPointProps(strokeWidth, "var(--background)"),
    },
    spline: {
      strokeWidth,
      curve: curveCatmullRom,
    },
    xAxis,
    yAxis,
    tooltip,
  }}
>
  {#snippet belowMarks(args)}
    {@const highlightKey = args.context.series.highlightKey}
    {@const visibleSeries = args.context.series.visibleSeries}
    {#if gaps}
      {#each visibleSeries as s, i (s.key)}
        {#each lineGaps[s.key] ?? [] as gapData, j (`${s.key}-${i}-${j}`)}
          <LineSpline
            series={{ ...s, data: gapData }}
            {highlightKey}
            stroke={s.color ?? "currentColor"}
            dashed
            {strokeWidth}
            {data}
          />
        {/each}
      {/each}
    {/if}
  {/snippet}
  {#snippet marks(args)}
    {@render chartMarks(args)}
  {/snippet}
</LineChart>
