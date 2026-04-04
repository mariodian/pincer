<script lang="ts">
  import { buildAllSeriesGaps, computeYDomain } from "$lib/utils/chart.js";
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
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    // padding?: ReturnType<typeof defaultChartPadding>;
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
    highlight: { points: { r: 8, strokeWidth: 8 } },
    spline: {
      strokeWidth: 3,
      curve: curveCatmullRom,
    },
    xAxis: xAxis,
    yAxis: yAxis,
    tooltip: tooltip,
  }}
>
  {#snippet belowMarks({ context })}
    {#if gaps}
      {#each context.series.visibleSeries as s (s.key)}
        {#each lineGaps[s.key] ?? [] as gapData, j (`${s.key}-${j}`)}
          <Spline
            data={gapData}
            y={(d) => Number(d[s.key])}
            class="[stroke-dasharray:3,3]"
            stroke={s.color}
            opacity={context.series.isHighlighted(s.key, true) ? 1 : 0.1}
            {strokeWidth}
            curve={curveCatmullRom.alpha(0.5)}
          />
        {/each}
      {/each}
    {/if}
  {/snippet}
  {#snippet marks({ context })}
    {#if colorGradient}
      {#each context.series.visibleSeries as s (s.key)}
        <LinearGradient
          stops={[
            [0, `color-mix(${s.color ?? "currentColor"} 80%, transparent)`],
            [0.6, `color-mix(${s.color ?? "currentColor"} 50%, transparent)`],
            [1, `color-mix(${s.color ?? "currentColor"} 40%, transparent)`],
          ]}
          units="userSpaceOnUse"
          vertical
        >
          {#snippet children({ gradient })}
            <Spline
              data={s.data ?? data}
              y={(d) => d[s.key]}
              stroke={gradient}
              opacity={context.series.isHighlighted(s.key, true) ? 1 : 0.1}
              {strokeWidth}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each context.series.visibleSeries as s (s.key)}
        <Spline
          data={s.data ?? data}
          y={(d) => d[s.key]}
          stroke={s.color}
          opacity={context.series.isHighlighted(s.key, true) ? 1 : 0.1}
          {strokeWidth}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</LineChart>
