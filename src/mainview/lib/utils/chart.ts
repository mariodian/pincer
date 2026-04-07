export type LineSegments = Record<string, unknown>[][];

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
  data?: Record<string, unknown>[];
}

export function buildLinePointProps(
  strokeWidth: number,
  stroke = "var(--background)",
) {
  return {
    r: Math.min(Math.max(strokeWidth * 0.45, 3), 6),
    stroke,
    strokeWidth: 2,
  };
}

export function buildLineHighlightPointProps(
  strokeWidth: number,
  stroke = "var(--background)",
) {
  return {
    r: Math.min(Math.max(strokeWidth * 1.2, 3), 10),
    strokeWidth: Math.min(Math.max(2.4 * strokeWidth, 6), 16),
    stroke,
    strokeOpacity: 0,
  };
}

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function countValidDataPoints(
  data: Record<string, unknown>[],
  key: string,
): number {
  return data.filter((row) => toFiniteNumber(row[key]) !== null).length;
}

export function getSingleValidDataPoint(
  data: Record<string, unknown>[],
  key: string,
): Record<string, unknown> | null {
  for (const row of data) {
    if (toFiniteNumber(row[key]) !== null) {
      return row;
    }
  }
  return null;
}

/**
 * Returns indices of data points that are "isolated" - valid values with no
 * solid-line connection possible on either side (both neighbors are gaps/null).
 *
 * A point is isolated when:
 * - It has a valid (non-null) value
 * - Left neighbor is null or out of bounds
 * - Right neighbor is null or out of bounds
 */
export function getIsolatedPointIndices(
  data: Record<string, unknown>[],
  key: string,
): number[] {
  const indices: number[] = [];
  const values = data.map((row) => toFiniteNumber(row[key]));

  for (let i = 0; i < values.length; i++) {
    if (values[i] === null) continue;

    const left = i > 0 ? values[i - 1] : null;
    const right = i < values.length - 1 ? values[i + 1] : null;

    // Point is isolated if both sides cannot form a solid line
    if (left === null && right === null) {
      indices.push(i);
    }
  }

  return indices;
}

export function buildSeriesGaps(
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

export function buildAllSeriesGaps(
  data: Record<string, unknown>[],
  series: ChartSeries[],
  gaps: boolean,
): Record<string, LineSegments> {
  const out: Record<string, LineSegments> = {};
  if (gaps) {
    for (const s of series) {
      out[s.key] = buildSeriesGaps(data, s.key);
    }
  }
  return out;
}

export function computeYDomain(
  data: Record<string, unknown>[],
  series: ChartSeries[],
): [number, number] {
  const values = data.flatMap((d) =>
    series
      .map((s) => toFiniteNumber(d[s.key]))
      .filter((v): v is number => v !== null),
  );

  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 100;

  return [dataMin - 5, dataMax + 5];
}

export function computeXDomain(
  data: Record<string, unknown>[],
  xKey: string,
  paddingRatio = 0.05,
): [Date, Date] {
  const dates = data
    .map((d) => d[xKey])
    .filter((d): d is Date => d instanceof Date);

  if (dates.length === 0) {
    const now = new Date();
    return [new Date(now.getTime() - 86400000), now];
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Add padding on each side to prevent dots from being clipped at edges
  const range = maxDate.getTime() - minDate.getTime();
  const padding = range * paddingRatio || 3600000; // paddingRatio or 1 hour default

  return [
    new Date(minDate.getTime() - padding),
    new Date(maxDate.getTime() + padding),
  ];
}

export function toFiniteNumberOrZero(value: unknown): number {
  return toFiniteNumber(value) ?? 0;
}

export function sanitizeSeriesData(
  data: Record<string, unknown>[],
  series: ChartSeries[],
): Record<string, unknown>[] {
  return data.map((row) => {
    const sanitizedRow: Record<string, unknown> = { ...row };

    for (const s of series) {
      const key = typeof s?.key === "string" ? s.key : null;
      if (!key) continue;
      sanitizedRow[key] = toFiniteNumberOrZero(row[key]);
    }

    return sanitizedRow;
  });
}

export function getSeriesFiniteValue(
  row: Record<string, unknown>,
  key: unknown,
): number {
  if (typeof key !== "string") return 0;
  return toFiniteNumberOrZero(row[key]);
}

export function getSeriesOpacity(
  highlightKey: string | null,
  seriesKey: string,
): number {
  if (highlightKey === null) return 1;
  return highlightKey === seriesKey ? 1 : 0.1;
}

export function computeGradientStops(
  series: ChartSeries[],
): Record<string, [number, string][]> {
  return series.reduce(
    (acc, s) => {
      const color = s.color ?? "currentColor";
      acc[s.key] = [
        [0, color],
        [0.6, `color-mix(${color} 55%, transparent)`],
        [1, `color-mix(${color} 30%, transparent)`],
      ];
      return acc;
    },
    {} as Record<string, [number, string][]>,
  );
}

/**
 * Builds an SVG path string for gap data that bypasses layerchart's
 * tooltip registration. Used for dashed gap lines where we don't want
 * interpolated values to appear in tooltips.
 */
export function buildGapPath(
  gapData: Record<string, unknown>[],
  key: string,
  xGet: (d: Record<string, unknown>) => Date,
  xScale: (d: Date) => number,
  yScale: (n: number) => number,
): string {
  if (gapData.length === 0) return "";

  // Build path commands: M (move to) first point, then L (line to) subsequent points
  const commands: string[] = [];

  for (let i = 0; i < gapData.length; i++) {
    const d = gapData[i];
    const x = xScale(xGet(d));
    const yVal = d[key];
    const y = yScale(Number(yVal));

    if (i === 0) {
      commands.push(`M ${x} ${y}`);
    } else {
      commands.push(`L ${x} ${y}`);
    }
  }

  return commands.join(" ");
}
