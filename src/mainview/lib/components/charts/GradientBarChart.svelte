<script lang="ts">
  import { scaleBand } from "d3-scale";
  import { BarChart, Bars, LinearGradient } from "layerchart";

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    colorGradient?: boolean;
    strokeWidth?: number;
    height?: number;
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
    height = 300,
  }: Props = $props();
</script>

<BarChart
  {data}
  xScale={scaleBand().padding(0.15)}
  {x}
  {series}
  {height}
  axis="x"
  seriesLayout="group"
  props={{
    xAxis: xAxis,
    yAxis: yAxis,
    tooltip: tooltip,
  }}
>
  {#snippet marks({ getBarsProps })}
    {#each series as s, i}
      {#if colorGradient}
        <LinearGradient
          stops={[s.color, `color-mix(${s.color} 50%, transparent)`]}
          vertical
        >
          {#snippet children({ gradient })}
            <Bars
              {...getBarsProps(s, i)}
              fill={gradient}
              stroke={s.color}
              {strokeWidth}
            />
          {/snippet}
        </LinearGradient>
      {:else}
        <Bars {...getBarsProps(s, i)} fill={s.color} {strokeWidth} />
      {/if}
    {/each}
  {/snippet}
</BarChart>
