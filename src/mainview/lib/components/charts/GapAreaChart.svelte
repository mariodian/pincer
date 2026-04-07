<script lang="ts">
  import {
    buildAllSeriesGaps,
    buildGapPath,
    buildLineHighlightPointProps,
    computeGradientStops,
    computeXDomain,
    computeYDomain,
    getIsolatedPointIndices,
    getSeriesOpacity,
    type ChartSeries,
  } from "$lib/utils/chart.js";
  import { curveCatmullRom } from "d3-shape";
  import {
    Area,
    AreaChart,
    defaultChartPadding,
    LinearGradient,
    Path,
  } from "layerchart";
  import SeriesDot from "./SeriesDot.svelte";

  const DEFAULT_PADDING = 40;

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: ChartSeries[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    strokeWidth?: number;
    gaps?: boolean;
    colorGradient?: boolean;
    height?: number;
    padding?: { top?: number; right?: number; bottom?: number; left?: number };
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
  const gradientStops = $derived(computeGradientStops(series));
  const alonePointsMap = $derived(
    series.reduce(
      (acc, s) => {
        acc[s.key] = getIsolatedPointIndices(s.data ?? data, s.key);
        return acc;
      },
      {} as Record<string, number[]>,
    ),
  );
</script>

{#snippet areaSeries(
  s: ChartSeries,
  highlightKey: string | null,
  gradient: string | null,
)}
  {@const baseOpacity = getSeriesOpacity(highlightKey, s.key)}
  <Area
    data={s.data ?? data}
    y1={(d) => d[s.key]}
    line={{
      stroke: s.color,
      strokeWidth,
      opacity: baseOpacity,
    }}
    fill={gradient ?? s.color}
    fillOpacity={baseOpacity * 0.5}
    curve={curveCatmullRom}
  />
{/snippet}

{#snippet seriesMarks(s: ChartSeries, highlightKey: string | null)}
  {#if colorGradient}
    <LinearGradient
      stops={gradientStops[s.key]}
      units="userSpaceOnUse"
      vertical
    >
      {#snippet children({ gradient }: { gradient: string })}
        {@render areaSeries(s, highlightKey, gradient)}
      {/snippet}
    </LinearGradient>
  {:else}
    {@render areaSeries(s, highlightKey, null)}
  {/if}
{/snippet}

<AreaChart
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
    area: {
      line: {
        strokeWidth,
      },
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
    {@const xScale = args.context.xScale}
    {@const yScale = args.context.yScale}
    {@const xGet = args.context.x}
    {#if gaps}
      {#each visibleSeries as s, i (s.key)}
        {#each lineGaps[s.key] ?? [] as gapData, j (`${s.key}-${i}-${j}`)}
          {@const pathD = buildGapPath(gapData, s.key, xGet, xScale, yScale)}
          <Path
            d={pathD}
            stroke={s.color ?? "currentColor"}
            {strokeWidth}
            class="[stroke-dasharray:3,3]"
            opacity={highlightKey === null || highlightKey === s.key ? 1 : 0.1}
          />
        {/each}
      {/each}
    {/if}
  {/snippet}
  {#snippet marks(args)}
    {@const highlightKey = args.context.series.highlightKey}
    {@const visibleSeries = args.context.series.visibleSeries}
    {@const xScale = args.context.xScale}
    {@const yScale = args.context.yScale}
    {@const xGet = args.context.x}
    {#each visibleSeries as s (s.key)}
      {@render seriesMarks(s, highlightKey)}
      {@const aloneIndices = alonePointsMap[s.key] ?? []}
      {#if aloneIndices.length > 0}
        <SeriesDot
          series={s}
          {xScale}
          {yScale}
          {xGet}
          {highlightKey}
          {strokeWidth}
          {data}
          {aloneIndices}
        />
      {/if}
    {/each}
  {/snippet}
</AreaChart>
