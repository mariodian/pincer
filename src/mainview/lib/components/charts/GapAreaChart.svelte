<script lang="ts">
  import { curveCatmullRom } from "d3-shape";
  import { Area, AreaChart, LinearGradient, Spline } from "layerchart";
  import { buildAllSeriesGaps, computeYDomain } from "$lib/utils/chart.js";

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

  const lineGaps = $derived(buildAllSeriesGaps(data, series, gaps));
  const yDomain = $derived(computeYDomain(data, series));
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
