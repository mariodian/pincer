<script lang="ts">
  import { Circle } from "layerchart";
  import {
    buildLinePointProps,
    getSeriesOpacity,
    getSingleValidDataPoint,
    type ChartSeries,
  } from "$lib/utils/chart.js";

  interface Props {
    series: ChartSeries;
    xScale: (d: Date) => number;
    yScale: (n: number) => number;
    xGet: (d: Record<string, unknown>) => Date;
    highlightKey: string | null;
    strokeWidth: number;
    data: Record<string, unknown>[];
  }

  let { series, xScale, yScale, xGet, highlightKey, strokeWidth, data }: Props =
    $props();

  const pointProps = $derived(buildLinePointProps(strokeWidth, series.color));
  const singlePoint = $derived(
    getSingleValidDataPoint(series.data ?? data, series.key),
  );
</script>

{#if singlePoint}
  {@const cx = xScale(xGet(singlePoint))}
  {@const cy = yScale(Number(singlePoint[series.key]))}
  <Circle
    {cx}
    {cy}
    r={pointProps.r}
    fill={series.color}
    stroke={pointProps.stroke}
    stroke-width={pointProps.strokeWidth}
    opacity={getSeriesOpacity(highlightKey, series.key)}
  />
{/if}
