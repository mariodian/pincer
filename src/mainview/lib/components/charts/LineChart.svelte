<script lang="ts">
  import { curveCatmullRom } from "d3-shape";
  import { Labels, LineChart, Spline } from "layerchart";

  interface Props {
    data: Record<string, unknown>[];
    x: string;
    series: any[];
    xAxis?: Record<string, unknown>;
    yAxis?: Record<string, unknown>;
    tooltip?: Record<string, unknown>;
    padding?: number;
    gaps?: boolean;
    // class?: string;
  }

  type LineSegments = Record<string, unknown>[][];

  // interface LineSegments {
  //   solid: Record<string, unknown>[][];
  //   dashed: Record<string, unknown>[][];
  // }

  // interface LineSegments {
  //   dashed: Record<string, unknown>[][];
  // }

  let {
    data,
    x,
    series,
    xAxis,
    yAxis,
    tooltip,
    padding = 24,
    gaps,
    // class: className,
  }: Props = $props();

  function toFiniteNumber(value: unknown): number | null {
    if (value === null || typeof value === "undefined") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function buildSeriesGaps(
    rows: Record<string, unknown>[],
    key: string,
  ): LineSegments {
    const dashed: LineSegments = [];
    const values = rows.map((row) => toFiniteNumber(row[key]));

    // Build dashed segments for null runs bounded by known values.
    let i = 0;
    while (i < rows.length) {
      if (values[i] !== null) {
        i += 1;
        continue;
      }

      const start = i;
      while (i < rows.length && values[i] === null) {
        i += 1;
      }
      const end = i - 1;

      const left = start - 1;
      const right = end + 1;
      if (
        left >= 0 &&
        right < rows.length &&
        values[left] !== null &&
        values[right] !== null
      ) {
        const y0 = values[left] as number;
        const y1 = values[right] as number;
        const span = right - left;

        const segment: Record<string, unknown>[] = [];
        for (let idx = left; idx <= right; idx++) {
          const t = (idx - left) / span;
          const interpolated = y0 + (y1 - y0) * t;
          segment.push({ ...rows[idx], [key]: interpolated });
        }

        if (segment.length >= 2) {
          dashed.push(segment);
        }
      }
    }

    return dashed;
  }

  const lineGaps = $derived.by<Record<string, LineSegments>>(() => {
    const out: Record<string, LineSegments> = {};
    if (gaps) {
      for (const s of series) {
        out[s.key] = buildSeriesGaps(data, s.key);
      }
    }

    return out;
  });

  // const domainMinMax = $derived.by(() => {
  //   let min = Infinity;
  //   let max = -Infinity;
  //   for (const d of data) {
  //     for (const s of series) {
  //       const val = Number(d[s.key]);
  //       if (isNaN(val)) continue;
  //       if (val < min) min = val;
  //       if (val > max) max = val;
  //     }
  //   }
  //   return [min - 1, max + 1];
  // });

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
  // xNice
  // yNice={6}
  // xNice
  yNice={4}
  // yDomain={domainMinMax}
  yDomain={[
    -2,
    data &&
      Math.max(
        ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)),
      ) * 1.1,
  ]}
  {series}
  {padding}
  height={400}
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
  {#snippet belowMarks()}
    {#if gaps}
      {#each series as s}
        {#each lineGaps[s.key] ?? [] as gapData}
          <Spline
            data={gapData}
            y={(d) => Number(d[s.key])}
            class="[stroke-dasharray:3,3]"
            stroke={s.color}
            strokeWidth={3}
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
