import type { Check, CheckStatus } from "$shared/types";
import { desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./db";
import { checks } from "./schema";

/**
 * Insert a single health check into the database.
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
  const checkedAt = new Date(); // Drizzle expects Date for timestamp_ms mode

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
 * Get recent checks for an agent within a time range.
 * Returns checks sorted by checkedAt descending (most recent first).
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
 * Convert a database row to a Check object.
 */
function rowToCheck(row: {
  id: number;
  agentId: number;
  checkedAt: Date;
  status: string;
  responseMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Check {
  return {
    id: row.id,
    agentId: row.agentId,
    checkedAt: row.checkedAt.getTime(), // Convert Date to ms timestamp
    status: row.status as CheckStatus,
    responseMs: row.responseMs,
    httpStatus: row.httpStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}
