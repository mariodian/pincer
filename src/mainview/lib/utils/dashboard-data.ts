import type { AgentWithColor, TimeSeriesPoint } from "$shared/rpc";

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
      (a.hourTimestamp as Date).getTime() -
      (b.hourTimestamp as Date).getTime(),
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

// ── Formatters ──────────────────────────────────────────────────────────

export function formatHour(val: unknown): string {
  const d = val instanceof Date ? val : new Date(Number(val) * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(val: unknown): string {
  const d = val instanceof Date ? val : new Date(Number(val) * 1000);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatUptime(val: unknown): string {
  return `${val}%`;
}

export function formatMs(val: unknown): string {
  return `${val}ms`;
}

export function formatUptimeKpi(val: number): string {
  return `${val.toFixed(1)}%`;
}

export function formatMsKpi(val: number): string {
  return `${Math.round(val)}ms`;
}
