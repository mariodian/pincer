<script lang="ts">
  import { Spline } from "layerchart";
  import { curveCatmullRom } from "d3-shape";
  import { getSeriesOpacity, type ChartSeries } from "$lib/utils/chart.js";

  interface Props {
    series: ChartSeries;
    highlightKey: string | null;
    stroke: string;
    dashed?: boolean;
    strokeWidth: number;
    data?: Record<string, unknown>[];
  }

  let {
    series,
    highlightKey,
    stroke,
    dashed = false,
    strokeWidth,
    data,
  }: Props = $props();
</script>

<Spline
  data={series.data ?? data}
  y={(d) => d[series.key]}
  {stroke}
  opacity={getSeriesOpacity(highlightKey, series.key)}
  {strokeWidth}
  curve={dashed ? curveCatmullRom.alpha(0.5) : curveCatmullRom}
  class={dashed ? "[stroke-dasharray:3,3]" : ""}
/>
