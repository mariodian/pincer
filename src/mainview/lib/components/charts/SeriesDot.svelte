<script lang="ts">
  import {
    buildLinePointProps,
    getSeriesOpacity,
    type ChartSeries,
  } from "$lib/utils/chart.js";
  import { Circle } from "layerchart";

  interface Props {
    series: ChartSeries;
    xScale: (d: Date) => number;
    yScale: (n: number) => number;
    xGet: (d: Record<string, unknown>) => Date;
    highlightKey: string | null;
    strokeWidth: number;
    data: Record<string, unknown>[];
    aloneIndices: number[];
  }

  let {
    series,
    xScale,
    yScale,
    xGet,
    highlightKey,
    strokeWidth,
    data,
    aloneIndices,
  }: Props = $props();

  const pointProps = $derived(buildLinePointProps(strokeWidth, series.color));
</script>

{#each aloneIndices as idx (idx)}
  {@const point = data[idx]}
  {@const cx = xScale(xGet(point))}
  {@const cy = yScale(Number(point[series.key]))}
  <Circle
    {cx}
    {cy}
    r={pointProps.r}
    fill={series.color}
    stroke={pointProps.stroke}
    strokeWidth={pointProps.strokeWidth}
    opacity={getSeriesOpacity(highlightKey, series.key)}
  />
{/each}
