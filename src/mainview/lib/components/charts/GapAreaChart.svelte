<script lang="ts">
  import {
    buildAllSeriesGaps,
    type ChartSeries,
    computeYDomain,
  } from "$lib/utils/chart.js";
  import { curveCatmullRom } from "d3-shape";
  import {
    Area,
    AreaChart,
    defaultChartPadding,
    LinearGradient,
    Spline,
  } from "layerchart";

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

  const fallbackGetAreaProps = (s: ChartSeries) => ({
    data: s?.data ?? data,
  });
</script>

<AreaChart
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
    highlight: { points: { r: 8, strokeWidth: 8 } },
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
    {#if gaps}
      {#each visibleSeries as s, i (s.key)}
        {#each lineGaps[s.key] ?? [] as gapData, j (`${s.key}-${i}-${j}`)}
          <Spline
            data={gapData}
            y={(d) => Number(d[s.key])}
            class="[stroke-dasharray:3,3]"
            stroke={s.color}
            {strokeWidth}
            opacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
            curve={curveCatmullRom}
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
        {@const { data: areaData } = fallbackGetAreaProps(s)}
        <LinearGradient
          stops={[
            [0, s.color ?? "currentColor"],
            [1, `color-mix(${s.color ?? "currentColor"} 50%, transparent)`],
          ]}
          vertical
        >
          {#snippet children({ gradient })}
            <Area
              data={areaData}
              y1={(d) => d[s.key]}
              line={{
                stroke: s.color,
                strokeWidth,
                opacity: highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1,
              }}
              fill={gradient}
              fillOpacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each visibleSeries as s (s.key)}
        {@const { data: areaData } = fallbackGetAreaProps(s)}
        <Area
          data={areaData}
          y1={(d) => d[s.key]}
          line={{
            stroke: s.color,
            strokeWidth,
            opacity: highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1,
          }}
          fill={s.color}
          fillOpacity={highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</AreaChart>
