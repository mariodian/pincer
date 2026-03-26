export type LineSegments = Record<string, unknown>[][];

export function toFiniteNumber(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
