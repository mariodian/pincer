import { formatMs, formatUptime } from "$shared/format-helpers";
import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";
import type { TimeRange } from "$shared/types";

/**
 * A pivoted row containing an hour timestamp and per-agent metric columns.
 * Column names are dynamic based on agent IDs (e.g., "uptime_1", "response_2").
 */
export interface PivotedRow extends Record<string, unknown> {
  hourTimestamp: Date;
}

/**
 * Pivot flat time-series rows into one row per hour with per-agent columns.
 *
 * @param series   Raw TimeSeriesPoint[] from the RPC layer
 * @param agents   Agents whose columns should appear in every row
 * @param valueKey Which metric to extract ("uptimePct" | "avgResponseMs")
 * @returns        Sorted array of pivoted rows
 */
export function pivotTimeSeries(
  series: TimeSeriesPoint[],
  agents: AgentWithColor[],
  valueKey: "uptimePct" | "avgResponseMs",
): PivotedRow[] {
  const prefix = valueKey === "uptimePct" ? "uptime" : "response";
  const byHour = new Map<number, PivotedRow>();

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
    (a, b) => a.hourTimestamp.getTime() - b.hourTimestamp.getTime(),
  );
}

/**
 * Insert null rows for missing hours between the first and last data point
 * so charts render visible gaps instead of interpolating across missing hours.
 */
export function fillHourlySlots(
  rows: PivotedRow[],
  agents: AgentWithColor[],
  yPrefix: "uptime" | "response",
): PivotedRow[] {
  if (rows.length <= 1) return rows;

  const HOUR = 3600000;
  const first = rows[0].hourTimestamp.getTime();
  const last = rows[rows.length - 1].hourTimestamp.getTime();

  const existing = new Map<number, PivotedRow>();
  for (const row of rows) {
    existing.set(row.hourTimestamp.getTime(), row);
  }

  const filled: PivotedRow[] = [];
  for (let ts = first; ts <= last; ts += HOUR) {
    if (existing.has(ts)) {
      filled.push(existing.get(ts)!);
    } else {
      const row: PivotedRow = { hourTimestamp: new Date(ts) };
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
export function aggregateByDay(rows: PivotedRow[]): PivotedRow[] {
  const byDay = new Map<
    number,
    { values: Record<string, number[]>; ts: number }
  >();

  for (const row of rows) {
    const d = row.hourTimestamp;
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
      const row: PivotedRow = { hourTimestamp: new Date(ts) };
      for (const [key, vals] of Object.entries(values)) {
        row[key] =
          Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
          100;
      }
      return row;
    })
    .sort((a, b) => a.hourTimestamp.getTime() - b.hourTimestamp.getTime());
}

/**
 * Pad daily aggregated data to cover the full time range from the start.
 * Inserts null rows for missing days before the first data point so bar charts
 * show the full range (7/30 days) even when data doesn't exist yet.
 */
export function padToFullRange(
  rows: PivotedRow[],
  agents: AgentWithColor[],
  yPrefix: "uptime" | "response",
  timeRange: TimeRange,
): PivotedRow[] {
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
  const firstDataMidnight = new Date(
    rows[0].hourTimestamp.getFullYear(),
    rows[0].hourTimestamp.getMonth(),
    rows[0].hourTimestamp.getDate(),
  ).getTime();

  // If data starts on or before expected start, no padding needed
  if (firstDataMidnight <= expectedStartMidnight) {
    return rows;
  }

  // Build map of existing days
  const existing = new Map<number, PivotedRow>();
  for (const row of rows) {
    const d = row.hourTimestamp;
    const midnight = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    existing.set(midnight, row);
  }

  // Generate padded rows from expected start to last data point
  const padded: PivotedRow[] = [];
  const lastDataDate = rows[rows.length - 1].hourTimestamp;
  const lastMidnight = new Date(
    lastDataDate.getFullYear(),
    lastDataDate.getMonth(),
    lastDataDate.getDate(),
  ).getTime();

  for (let ts = expectedStartMidnight; ts <= lastMidnight; ts += DAY_MS) {
    if (existing.has(ts)) {
      padded.push(existing.get(ts)!);
    } else {
      const row: PivotedRow = { hourTimestamp: new Date(ts) };
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
