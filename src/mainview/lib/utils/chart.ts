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
