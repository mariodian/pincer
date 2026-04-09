import type { TimeRange } from "$shared/types";

const RANGE_SECONDS: Record<TimeRange, number> = {
  "24h": 24 * 3600,
  "7d": 7 * 24 * 3600,
  "30d": 30 * 24 * 3600,
  "90d": 90 * 24 * 3600,
};

export function getRangeTimestamps(range: TimeRange): {
  from: number;
  to: number;
} {
  const to = Math.floor(Date.now() / 1000);
  return { from: to - RANGE_SECONDS[range], to };
}
