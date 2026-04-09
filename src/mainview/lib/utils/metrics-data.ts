import { formatMs, formatUptime } from "$shared/format-helpers";
import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";
import type { TimeRange } from "$shared/types";

/**
 * Pivot flat time-series rows into one row per hour with per-agent columns.
 *
 * @param series   Raw TimeSeriesPoint[] from the RPC layer
 * @param agents   Agents whose columns should appear in every row
 * @param valueKey Which metric to extract ("uptimePct" | "avgResponseMs")
 * @returns        Sorted array of { hourTimestamp: Date, [prefix_agentId]: number | null }
 */
export function pivotTimeSeries(
  series: TimeSeriesPoint[],
  agents: AgentWithColor[],
  valueKey: "uptimePct" | "avgResponseMs",
): Record<string, unknown>[] {
  const prefix = valueKey === "uptimePct" ? "uptime" : "response";
  const byHour = new Map<number, Record<string, unknown>>();

  for (const point of series) {
    if (!byHour.has(point.hourTimestamp)) {
      byHour.set(point.hourTimestamp, {
        hourTimestamp: new Date(point.hourTimestamp * 1000),
      });
    }
    const row = byHour.get(point.hourTimestamp)!;
    row[`${prefix}_${point.agentId}`] = point[valueKey];
  }

  // Fill missing agents with null
  for (const row of byHour.values()) {
    for (const agent of agents) {
      const key = `${prefix}_${agent.id}`;
      if (!(key in row)) {
        row[key] = null;
      }
    }
  }

  return Array.from(byHour.values()).sort(
    (a, b) =>
      (a.hourTimestamp as Date).getTime() - (b.hourTimestamp as Date).getTime(),
  );
}

/**
 * Insert null rows for missing hours between the first and last data point
 * so charts render visible gaps instead of interpolating across missing hours.
 */
export function fillHourlySlots(
  rows: Record<string, unknown>[],
  agents: AgentWithColor[],
  yPrefix: string,
): Record<string, unknown>[] {
  if (rows.length <= 1) return rows;

  const HOUR = 3600000;
  const first = (rows[0].hourTimestamp as Date).getTime();
  const last = (rows[rows.length - 1].hourTimestamp as Date).getTime();

  const existing = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    existing.set((row.hourTimestamp as Date).getTime(), row);
  }

  const filled: Record<string, unknown>[] = [];
  for (let ts = first; ts <= last; ts += HOUR) {
    if (existing.has(ts)) {
      filled.push(existing.get(ts)!);
    } else {
      const row: Record<string, unknown> = { hourTimestamp: new Date(ts) };
      for (const agent of agents) {
        row[`${yPrefix}_${agent.id}`] = null;
      }
      filled.push(row);
    }
  }

  return filled;
}

/**
 * Aggregate hourly pivoted data to daily averages.
 * Groups rows by local midnight and computes the mean of each numeric column.
 */
export function aggregateByDay(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byDay = new Map<
    number,
    { values: Record<string, number[]>; ts: number }
  >();

  for (const row of rows) {
    const d = row.hourTimestamp as Date;
    const localMidnight = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    if (!byDay.has(localMidnight)) {
      byDay.set(localMidnight, { values: {}, ts: localMidnight });
    }
    const bucket = byDay.get(localMidnight)!;
    for (const [key, val] of Object.entries(row)) {
      if (key === "hourTimestamp") continue;
      if (typeof val === "number") {
        if (!bucket.values[key]) bucket.values[key] = [];
        bucket.values[key].push(val);
      }
    }
  }

  return Array.from(byDay.values())
    .map(({ values, ts }) => {
      const row: Record<string, unknown> = { hourTimestamp: new Date(ts) };
      for (const [key, vals] of Object.entries(values)) {
        row[key] =
          Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
          100;
      }
      return row;
    })
    .sort(
      (a, b) =>
        (a.hourTimestamp as Date).getTime() -
        (b.hourTimestamp as Date).getTime(),
    );
}

/**
 * Pad daily aggregated data to cover the full time range from the start.
 * Inserts null rows for missing days before the first data point so bar charts
 * show the full range (7/30 days) even when data doesn't exist yet.
 */
export function padToFullRange(
  rows: Record<string, unknown>[],
  agents: AgentWithColor[],
  yPrefix: string,
  timeRange: TimeRange,
): Record<string, unknown>[] {
  if (rows.length === 0) return rows;

  const DAY_MS = 24 * 3600 * 1000;
  const days = timeRange === "7d" ? 7 : 30;

  // Calculate expected start (now - days)
  const now = Date.now();
  const expectedStart = new Date(now - days * DAY_MS);
  const expectedStartMidnight = new Date(
    expectedStart.getFullYear(),
    expectedStart.getMonth(),
    expectedStart.getDate(),
  ).getTime();

  // Get actual first date in data
  const firstDataDate = rows[0].hourTimestamp as Date;
  const firstDataMidnight = new Date(
    firstDataDate.getFullYear(),
    firstDataDate.getMonth(),
    firstDataDate.getDate(),
  ).getTime();

  // If data starts on or before expected start, no padding needed
  if (firstDataMidnight <= expectedStartMidnight) {
    return rows;
  }

  // Build map of existing days
  const existing = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const d = row.hourTimestamp as Date;
    const midnight = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    existing.set(midnight, row);
  }

  // Generate padded rows from expected start to last data point
  const padded: Record<string, unknown>[] = [];
  const lastDataDate = rows[rows.length - 1].hourTimestamp as Date;
  const lastMidnight = new Date(
    lastDataDate.getFullYear(),
    lastDataDate.getMonth(),
    lastDataDate.getDate(),
  ).getTime();

  for (let ts = expectedStartMidnight; ts <= lastMidnight; ts += DAY_MS) {
    if (existing.has(ts)) {
      padded.push(existing.get(ts)!);
    } else {
      const row: Record<string, unknown> = { hourTimestamp: new Date(ts) };
      for (const agent of agents) {
        row[`${yPrefix}_${agent.id}`] = null;
      }
      padded.push(row);
    }
  }

  return padded;
}

// ── Formatters ──────────────────────────────────────────────────────────

export function formatHour(val: unknown): string {
  const d = val instanceof Date ? val : new Date(Number(val) * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(val: unknown): string {
  const d = val instanceof Date ? val : new Date(Number(val) * 1000);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export { formatMs, formatUptime };
