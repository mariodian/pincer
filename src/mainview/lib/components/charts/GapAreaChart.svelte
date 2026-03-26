<script lang="ts">
  import { curveCatmullRom } from "d3-shape";
  import { Area, AreaChart, Labels, LinearGradient, Spline } from "layerchart";
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

<AreaChart
  {data}
  {x}
  {yDomain}
  {series}
  {padding}
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
  {#snippet belowMarks({ highlightKey })}
    {#if gaps}
      {#each series as s}
        {#each lineGaps[s.key] ?? [] as gapData}
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

  {#snippet aboveMarks({ getLabelsProps, series, highlightKey, context })}
    {#if highlightKey}
      {@const activeSeriesIndex = series.findIndex(
        (s) => s.key === highlightKey,
      )}
      {#if activeSeriesIndex !== -1 && context?.tooltip?.data}
        <Labels
          {...getLabelsProps(
            { ...series[activeSeriesIndex], data: [context.tooltip.data] },
            activeSeriesIndex,
          )}
          offset={10}
        />
      {/if}
    {/if}
  {/snippet}

  {#snippet marks({ getAreaProps, highlightKey })}
    {#if colorGradient}
      {#each series as s, i}
        <LinearGradient
          stops={[
            s.color,
            // `color-mix(${s.color} 100%, transparent)`,
            // `color-mix(${s.color} 100%, transparent)`,
            // `color-mix(${s.color} 70%, transparent)`,
            `color-mix(${s.color} 50%, transparent)`,
          ]}
          // units="userSpaceOnUse"
          vertical
        >
          {#snippet children({ gradient })}
            <Area
              {...getAreaProps(s, i)}
              y1={(d) => d[s.key]}
              // line={{ class: "stroke-2 stroke-primary/50" }}
              line={{
                stroke: s.color,
                strokeWidth: strokeWidth,
                opacity: highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1,
              }}
              fill={gradient}
              // line={{ stroke: s.color, strokeWidth: 3 }}
              curve={curveCatmullRom}
            />
          {/snippet}
        </LinearGradient>
      {/each}
    {:else}
      {#each series as s, i}
        <Area
          {...getAreaProps(s, i)}
          y1={(d) => d[s.key]}
          fill={s.color}
          line={{
            stroke: s.color,
            strokeWidth: strokeWidth,
            opacity: highlightKey === s.key ? 1 : highlightKey ? 0.1 : 1,
          }}
          curve={curveCatmullRom}
        />
      {/each}
    {/if}
  {/snippet}
</AreaChart>
