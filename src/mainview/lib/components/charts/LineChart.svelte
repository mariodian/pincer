<script lang="ts">
  import { curveCatmullRom } from "d3-shape";
  import { Labels, LinearGradient, LineChart, Spline } from "layerchart";
  import type { LineSegments } from "$lib/utils/chart.js";
  import { buildSeriesGaps, toFiniteNumber } from "$lib/utils/chart.js";

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    padding?: number;
    strokeWidth?: number;
    gaps?: boolean;
    colorGradient?: boolean;
    height?: number;
    // class?: string;
  }

  let {
    data,
    x,
    series,
    xAxis,
    yAxis,
    tooltip,
    padding = 24,
    gaps = false,
    colorGradient = false,
    strokeWidth = 3,
    height = 300,
    // class: className,
  }: Props = $props();

  const lineGaps = $derived.by<Record<string, LineSegments>>(() => {
    const out: Record<string, LineSegments> = {};
    if (gaps) {
      for (const s of series) {
        out[s.key] = buildSeriesGaps(data, s.key);
      }
    }

    return out;
  });

  const yDomain = $derived.by<[number, number]>(() => {
    const values = data.flatMap((d) =>
      series
        .map((s) => toFiniteNumber(d[s.key]))
        .filter((v): v is number => v !== null),
    );

    const dataMin = values.length > 0 ? Math.min(...values) : 0;
    const dataMax = values.length > 0 ? Math.max(...values) : 100;

    return [Math.min(0, dataMin) - 5, Math.max(100, dataMax) + 5];
  });
</script>

<LineChart
  {data}
  {x}
  {yDomain}
  {series}
  {padding}
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
  {#snippet belowMarks({ getSplineProps })}
    {#if gaps}
      {#each series as s, i}
        {#each lineGaps[s.key] ?? [] as gapData}
          <Spline
            {...getSplineProps(s, i)}
            data={gapData}
            y={(d) => Number(d[s.key])}
            class="[stroke-dasharray:3,3]"
            stroke={s.color}
            {strokeWidth}
            curve={curveCatmullRom.alpha(0.5)}
          />
        {/each}
      {/each}
    {/if}
  {/snippet}

  {#snippet aboveMarks({ getLabelsProps, series, highlightKey })}
    {#if highlightKey}
      {@const activeSeriesIndex = series.findIndex(
        (s) => s.key === highlightKey,
      )}
      {#if activeSeriesIndex !== -1}
        <Labels
          {...getLabelsProps(series[activeSeriesIndex], activeSeriesIndex)}
          offset={10}
        />
      {/if}
    {/if}
  {/snippet}
  {#snippet marks({ getSplineProps })}
    {#if colorGradient}
      {#each series as s, i}
        <LinearGradient
          stops={[
            `color-mix(${s.color} 80%, transparent)`,
            `color-mix(${s.color} 50%, transparent)`,
            `color-mix(${s.color} 40%, transparent)`,
          ]}
          units="userSpaceOnUse"
          vertical
        >
          {#snippet children({ gradient })}
            <Spline
              {...getSplineProps(s, i)}
              y={(d) => d[s.key]}
              stroke={gradient}
              {strokeWidth}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each series as s, i}
        <Spline
          {...getSplineProps(s, i)}
          y={(d) => d[s.key]}
          stroke={s.color}
          {strokeWidth}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</LineChart>
