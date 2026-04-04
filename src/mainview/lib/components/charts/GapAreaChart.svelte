<script lang="ts">
  import { buildAllSeriesGaps, computeYDomain } from "$lib/utils/chart.js";
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
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    // padding?: ReturnType<typeof defaultChartPadding>;
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
      line: { strokeWidth: 3 },
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
            {strokeWidth}
            opacity={context.series.isHighlighted(s.key, true) ? 1 : 0.1}
            curve={curveCatmullRom}
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
            [0, s.color ?? "currentColor"],
            [1, `color-mix(${s.color ?? "currentColor"} 50%, transparent)`],
          ]}
          vertical
        >
          {#snippet children({ gradient })}
            <Area
              data={s.data ?? data}
              y1={(d) => d[s.key]}
              line={{
                stroke: s.color,
                strokeWidth: strokeWidth,
                opacity: context.series.isHighlighted(s.key, true) ? 1 : 0.1,
              }}
              fill={gradient}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each context.series.visibleSeries as s (s.key)}
        <Area
          data={s.data ?? data}
          y1={(d) => d[s.key]}
          fill={s.color}
          line={{
            stroke: s.color,
            strokeWidth: strokeWidth,
            opacity: context.series.isHighlighted(s.key, true) ? 1 : 0.1,
          }}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</AreaChart>
