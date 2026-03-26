<script lang="ts">
  import { curveLinear } from "d3-shape";
  import { Labels, LineChart, Spline } from "layerchart";

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    padding?: number;
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
    // class: className,
  }: Props = $props();

  const domainMinMax = $derived.by(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      for (const s of series) {
        const val = Number(d[s.key]);
        if (isNaN(val)) continue;
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    return [min - 1, max + 1];
  });

  // brush={true}
  // {padding}
  // height={300}
  // props={{
  //   highlight: { points: { r: 8, strokeWidth: 4 } },
  //   spline: {
  //     strokeWidth: 3,
  //     curve: curveLinear,
  //   },
  //   xAxis: xAxis,
  //   yAxis: yAxis,
  //   tooltip: tooltip,
  // }}
</script>

<LineChart
  {data}
  {x}
  // yNice={6}
  // xNice
  // yNice={4}
  // yDomain={domainMinMax}
  // yDomain={[
  //   -2,
  //   Math.max(...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))) *
  //     1.1,
  // ]}
  {series}
  {padding}
  height={400}
  props={{
    highlight: { points: { r: 8, strokeWidth: 8 } },
    spline: {
      strokeWidth: 3,
      curve: curveLinear,
    },
    xAxis: xAxis,
    yAxis: yAxis,
    tooltip: tooltip,
  }}
>
  {#snippet belowMarks()}
    {#each series as s}
      <Spline
        data={data.filter(function (d) {
          console.log(s.key, d[s.key]);
          return typeof d[s.key] !== "undefined";
        })}
        y={(d) => d[s.key]}
        class="[stroke-dasharray:3,3]"
        stroke={s.color}
        strokeWidth={3}
        curve={curveLinear}
      />
      <!-- {@const segments = lineSegments[s.key]}

              {#each segments?.dashed ?? [] as segmentData}
                <Spline
                  data={segmentData}
                  y={(d) => Number(d[s.key])}
                  class="[stroke-dasharray:3,3]"
                  // curve={curveCatmullRom}
                  stroke={s.color}
                  strokeWidth={3}
                />
              {/each} -->
    {/each}
  {/snippet}
  {#snippet aboveMarks({ getLabelsProps, series, highlightKey })}
    {#if highlightKey}
      {@const activeSeriesIndex = series.findIndex(
        (s) => s.key === highlightKey,
      )}
      <Labels
        {...getLabelsProps(series[activeSeriesIndex], activeSeriesIndex)}
        offset={10}
      />
    {/if}
  {/snippet}
  <!-- {#snippet marks({})}
            <LinearGradient
              // stops={ticks(1, 0, 10).map(temperatureColor.interpolator())}
              stops={[
                [200, "var(--color-red-500)"],
                // [8, "color-mix(var(--color-red-500) 80%, white)"],
                // [6, "color-mix(var(--color-yellow-500) 60%, white)"],
                // [4, "color-mix(var(--color-green-500) 40%, white)"],
                [200, "var(--color-green-500)"],
              ]}
              class="from-red-500 to-green-500"
              units="userSpaceOnUse"
              vertical
            >
              {#snippet children({ gradient })}
                {#each series as s}
                  <Spline
                    y={(d) => d[s.key]}
                    // Add a line for each series with a gradient stroke
                    stroke={gradient}
                    strokeWidth={3}
                    curve={curveCatmullRom}
                  />
                {/each}
              {/snippet}
            </LinearGradient>
          {/snippet} -->
</LineChart>
