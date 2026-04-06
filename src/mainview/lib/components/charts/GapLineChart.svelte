<script lang="ts">
  import {
    buildAllSeriesGaps,
    buildLineHighlightPointProps,
    type ChartSeries,
    computeYDomain,
  } from "$lib/utils/chart.js";
  import { curveCatmullRom } from "d3-shape";
  import {
    defaultChartPadding,
    LinearGradient,
    LineChart,
    Spline,
  } from "layerchart";

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
  }: Props = $props();

  const lineGaps = $derived(buildAllSeriesGaps(data, series, gaps));
  const yDomain = $derived(computeYDomain(data, series));

  const fallbackGetSplineProps = (s: ChartSeries) => ({
    data: s?.data ?? data,
  });
</script>

<LineChart
  {data}
  {x}
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
          {@const { data: _ } = fallbackGetSplineProps(s)}
          <Spline
            data={gapData}
            y={(d) => Number(d[s.key])}
            class="[stroke-dasharray:3,3]"
            stroke={s.color}
            {strokeWidth}
            opacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
            curve={curveCatmullRom.alpha(0.5)}
          />
        {/each}
      {/each}
    {/if}
  {/snippet}
  {#snippet marks(args)}
    {@const highlightKey = args.context.series.highlightKey}
    {@const visibleSeries = args.context.series.visibleSeries}
    {#if colorGradient}
      {#each visibleSeries as s (s.key)}
        <LinearGradient
          stops={[
            [0, s.color ?? "currentColor"],
            [0.6, `color-mix(${s.color ?? "currentColor"} 85%, transparent)`],
            [1, `color-mix(${s.color ?? "currentColor"} 70%, transparent)`],
          ]}
          units="userSpaceOnUse"
          vertical
        >
          {#snippet children({ gradient })}
            {@const { data: _ } = fallbackGetSplineProps(s)}
            <Spline
              data={s.data ?? data}
              y={(d) => d[s.key]}
              stroke={gradient}
              opacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
              {strokeWidth}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each visibleSeries as s (s.key)}
        {@const { data: _ } = fallbackGetSplineProps(s)}
        <Spline
          data={s.data ?? data}
          y={(d) => d[s.key]}
          stroke={s.color}
          opacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
          {strokeWidth}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</LineChart>
