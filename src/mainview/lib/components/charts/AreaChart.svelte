<script lang="ts">
  import { curveCatmullRom } from "d3-shape";
  import { Area, AreaChart, Labels, LinearGradient, Spline } from "layerchart";

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
    // class?: string;
  }

  type LineSegments = Record<string, unknown>[][];

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
  brush
  height={400}
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

  {#snippet marks({ getAreaProps, highlightKey })}
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
