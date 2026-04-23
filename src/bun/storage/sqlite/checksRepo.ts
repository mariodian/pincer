import type { Check, CheckBucket, CheckStatus } from "../../../shared/types";
import { rowToCheck } from "../../../shared/db-helpers";
import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./db";
import { checks } from "./schema";

/**
 * Insert a single health check into the database.
 * checkedAt is stored as milliseconds since epoch (INTEGER).
 */
export function insertCheck(
  agentId: number,
  status: CheckStatus,
  responseMs: number,
  httpStatus: number | null,
  errorCode: string | null,
  errorMessage: string | null,
): Check {
  const { db } = getDatabase();
  const checkedAt = Date.now(); // Store as milliseconds timestamp

  const row = db
    .insert(checks)
    .values({
      agentId,
      checkedAt,
      status,
      responseMs,
      httpStatus,
      errorCode,
      errorMessage,
    })
    .returning()
    .get();

  return rowToCheck(row);
}

/**
 * Insert a batch of checks from daemon sync.
 * Uses INSERT OR IGNORE to skip duplicates.
 * Returns the number of checks inserted.
 */
export function insertChecksBatch(checksData: Check[]): number {
  if (checksData.length === 0) return 0;

  const { sqlite } = getDatabase();

  const stmt = sqlite.prepare(
    `INSERT OR IGNORE INTO checks (agent_id, checked_at, status, response_ms, http_status, error_code, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  for (const check of checksData) {
    const result = stmt.run(
      check.agentId,
      check.checkedAt,
      check.status,
      check.responseMs,
      check.httpStatus,
      check.errorCode,
      check.errorMessage,
    );
    inserted += result.changes ?? 0;
  }

  return inserted;
}

/**
 * Get recent checks for an agent within a time range.
 * Returns checks sorted by checkedAt descending (most recent first).
 * sinceMs and untilMs are milliseconds since epoch.
 */
export function getRecentChecks(
  agentId: number,
  sinceMs: number,
  untilMs?: number,
): Check[] {
  const { db } = getDatabase();

  let whereClause = sql`${checks.agentId} = ${agentId} AND ${checks.checkedAt} >= ${sinceMs}`;
  if (untilMs !== undefined) {
    whereClause = sql`${checks.agentId} = ${agentId} AND ${checks.checkedAt} >= ${sinceMs} AND ${checks.checkedAt} <= ${untilMs}`;
  }

  const rows = db
    .select()
    .from(checks)
    .where(whereClause)
    .orderBy(desc(checks.checkedAt))
    .all();

  return rows.map(rowToCheck);
}

/**
 * Get the last N checks for an agent, sorted by checkedAt descending.
 * Used for startup reconstruction to count consecutive non-OK checks.
 */
export function getAgentLastNChecks(agentId: number, n: number): Check[] {
  const { db } = getDatabase();

  const rows = db
    .select()
    .from(checks)
    .where(eq(checks.agentId, agentId))
    .orderBy(desc(checks.checkedAt))
    .limit(n)
    .all();

  return rows.map(rowToCheck);
}

/**
 * Get all checks across all agents within a time range.
 * Useful for global timeline views.
 */
export function getAllChecks(sinceMs: number, untilMs?: number): Check[] {
  const { db } = getDatabase();

  let whereClause = sql`${checks.checkedAt} >= ${sinceMs}`;
  if (untilMs !== undefined) {
    whereClause = sql`${checks.checkedAt} >= ${sinceMs} AND ${checks.checkedAt} <= ${untilMs}`;
  }

  const rows = db
    .select()
    .from(checks)
    .where(whereClause)
    .orderBy(desc(checks.checkedAt))
    .all();

  return rows.map(rowToCheck);
}

/**
 * Delete checks older than the specified cutoff timestamp.
 * Returns the number of deleted rows.
 */
export function deleteOldChecks(cutoffMs: number): number {
  const { db } = getDatabase();

  const result = db
    .delete(checks)
    .where(sql`${checks.checkedAt} < ${cutoffMs}`)
    .run();

  // @ts-expect-error - Drizzle returns void but sqlite3 returns object with changes
  return result.changes ?? 0;
}

/**
 * Count checks older than the specified cutoff timestamp.
 * Useful for logging/debugging before deletion.
 */
export function countOldChecks(cutoffMs: number): number {
  const { db } = getDatabase();

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(checks)
    .where(sql`${checks.checkedAt} < ${cutoffMs}`)
    .get();

  return row?.count ?? 0;
}

/**
 * Count total checks in the database.
 */
export function getTotalChecksCount(): number {
  const { db } = getDatabase();

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(checks)
    .get();

  return row?.count ?? 0;
}

/**
 * Get the latest check for a specific agent.
 * Returns null if no checks exist for the agent.
 */
export function getAgentLatestCheck(agentId: number): Check | null {
  const { db } = getDatabase();

  const row = db
    .select()
    .from(checks)
    .where(eq(checks.agentId, agentId))
    .orderBy(desc(checks.checkedAt))
    .limit(1)
    .get();

  if (!row) {
    return null;
  }

  return rowToCheck(row);
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Get checks aggregated into time buckets for heatmap display.
 * @param bucketMs - Bucket interval in milliseconds (e.g., ONE_HOUR_MS, TEN_MINUTES_MS)
 * @returns Aggregated check buckets, one per agent per bucket_start
 */
function getChecksAggregated(
  sinceMs: number,
  untilMs: number,
  bucketMs: number,
): CheckBucket[] {
  const { sqlite } = getDatabase();

  const rows = sqlite
    .prepare(
      `
      SELECT
        (checked_at / ?) * ? as bucket_start,
        agent_id as agentId,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) as ok_count,
        SUM(CASE WHEN status IN ('degraded', 'offline') THEN 1 ELSE 0 END) as degraded_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_count,
        AVG(response_ms) as avg_response_ms
      FROM checks
      WHERE checked_at >= ? AND checked_at <= ?
      GROUP BY agent_id, bucket_start
      ORDER BY bucket_start DESC
      `,
    )
    .all(bucketMs, bucketMs, sinceMs, untilMs) as Array<{
    bucket_start: number;
    agentId: number;
    total: number;
    ok_count: number;
    degraded_count: number;
    failed_count: number;
    avg_response_ms: number | null;
  }>;

  return rows.map((row) => ({
    bucketStart: row.bucket_start,
    agentId: row.agentId,
    total: row.total,
    okCount: row.ok_count,
    degradedCount: row.degraded_count,
    failedCount: row.failed_count,
    avgResponseMs: row.avg_response_ms,
  }));
}

/**
 * Get checks aggregated into hourly buckets for heatmap display.
 * Returns ~168 buckets for 7d view instead of ~118K raw checks.
 * Dramatically reduces data transfer and client-side processing.
 */
export function getChecksAggregatedByHour(
  sinceMs: number,
  untilMs: number,
): CheckBucket[] {
  return getChecksAggregated(sinceMs, untilMs, ONE_HOUR_MS);
}

/**
 * Get checks aggregated into 10-minute buckets for heatmap display.
 * Returns ~144 buckets for 24h view instead of ~2880 raw checks.
 */
export function getChecksAggregatedBy10Min(
  sinceMs: number,
  untilMs: number,
): CheckBucket[] {
  return getChecksAggregated(sinceMs, untilMs, TEN_MINUTES_MS);
}
