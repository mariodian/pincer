import type { Status } from "$shared/types";
import { sql } from "drizzle-orm";
import { getDatabase } from "./db";
import { stats } from "./schema";

/**
 * Row structure returned from stats queries.
 * Exported for reuse in RPC type definitions.
 */
export interface AgentStatRow {
  agentId: number;
  hourTimestamp: number;
  totalChecks: number;
  okCount: number;
  offlineCount: number;
  errorCount: number;
  uptimePct: number;
  avgResponseMs: number;
}

/**
 * Truncate a unix timestamp (seconds) to the start of the hour.
 */
function truncateToHour(timestampSecs: number): number {
  return Math.floor(timestampSecs / 3600) * 3600;
}

/**
 * Upsert a single status check result into the hourly aggregate.
 */
export function upsertHourlyStat(
  agentId: number,
  status: Status | "degraded",
  responseMs: number,
): void {
  const { db } = getDatabase();
  const hourTimestamp = truncateToHour(Math.floor(Date.now() / 1000));

  const isOk = status === "ok" ? 1 : 0;
  const isOffline = status === "offline" ? 1 : 0;
  const isError = status === "error" ? 1 : 0;

  db.insert(stats)
    .values({
      agentId,
      hourTimestamp,
      totalChecks: 1,
      okCount: isOk,
      offlineCount: isOffline,
      errorCount: isError,
      uptimePct: isOk ? 100 : 0,
      avgResponseMs: responseMs,
    })
    .onConflictDoUpdate({
      target: [stats.agentId, stats.hourTimestamp],
      set: {
        totalChecks: sql`${stats.totalChecks} + 1`,
        okCount: sql`${stats.okCount} + ${isOk}`,
        offlineCount: sql`${stats.offlineCount} + ${isOffline}`,
        errorCount: sql`${stats.errorCount} + ${isError}`,
        uptimePct: sql`ROUND(CAST((${stats.okCount} + ${isOk}) * 100.0 / (${stats.totalChecks} + 1) AS REAL), 2)`,
        avgResponseMs: sql`ROUND(CAST((${stats.avgResponseMs} * ${stats.totalChecks} + ${responseMs}) / (${stats.totalChecks} + 1) AS REAL), 2)`,
      },
    })
    .run();
}

/**
 * Get stats for a specific agent within a time range.
 * Returns rows sorted by hour_timestamp ascending.
 */
export function getAgentStats(
  agentId: number,
  fromTimestampSecs: number,
  toTimestampSecs: number,
): Omit<AgentStatRow, "agentId">[] {
  const { db } = getDatabase();

  const rows = db
    .select({
      hourTimestamp: stats.hourTimestamp,
      totalChecks: stats.totalChecks,
      okCount: stats.okCount,
      offlineCount: stats.offlineCount,
      errorCount: stats.errorCount,
      uptimePct: stats.uptimePct,
      avgResponseMs: stats.avgResponseMs,
    })
    .from(stats)
    .where(
      sql`${stats.agentId} = ${agentId} AND ${stats.hourTimestamp} >= ${fromTimestampSecs} AND ${stats.hourTimestamp} <= ${toTimestampSecs}`,
    )
    .orderBy(stats.hourTimestamp)
    .all();

  return rows;
}

/**
 * Get stats for all agents within a time range.
 * Useful for aggregate dashboard views.
 */
export function getAllAgentStats(
  fromTimestampSecs: number,
  toTimestampSecs: number,
): AgentStatRow[] {
  const { db } = getDatabase();

  const rows = db
    .select({
      agentId: stats.agentId,
      hourTimestamp: stats.hourTimestamp,
      totalChecks: stats.totalChecks,
      okCount: stats.okCount,
      offlineCount: stats.offlineCount,
      errorCount: stats.errorCount,
      uptimePct: stats.uptimePct,
      avgResponseMs: stats.avgResponseMs,
    })
    .from(stats)
    .where(
      sql`${stats.hourTimestamp} >= ${fromTimestampSecs} AND ${stats.hourTimestamp} <= ${toTimestampSecs}`,
    )
    .orderBy(stats.agentId, stats.hourTimestamp)
    .all();

  return rows;
}

/**
 * Get the total number of stat rows in the database.
 */
export function getStatsCount(): number {
  const { db } = getDatabase();

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(stats)
    .get();

  return row?.count ?? 0;
}
