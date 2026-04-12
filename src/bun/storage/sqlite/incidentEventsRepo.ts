import type { CheckStatus, EventType, IncidentEvent } from "$shared/types";
import { desc, sql } from "drizzle-orm";
import { getDatabase } from "./db";
import { incidentEvents } from "./schema";

/**
 * Insert a single incident event into the database.
 */
export function insertEvent(
  agentId: number,
  incidentId: string,
  eventType: EventType,
  fromStatus: CheckStatus | null,
  toStatus: CheckStatus | null,
  reason: string | null,
): IncidentEvent {
  const { db } = getDatabase();
  const eventAt = new Date(); // Drizzle expects Date for timestamp_ms mode

  const row = db
    .insert(incidentEvents)
    .values({
      agentId,
      incidentId,
      eventType,
      eventAt,
      fromStatus,
      toStatus,
      reason,
    })
    .returning()
    .get();

  return rowToIncidentEvent(row);
}

/**
 * Get all open incidents (incidents that have been opened but not recovered).
 * Uses SQL anti-join pattern to find incidents with 'opened' event
 * but no corresponding 'recovered' event.
 */
export function getOpenIncidents(): Array<{
  agentId: number;
  incidentId: string;
  openedAt: number;
}> {
  const { db } = getDatabase();

  // Use raw SQL for the anti-join pattern
  const rows = db.all<{
    agentId: number;
    incidentId: string;
    openedAt: number;
  }>(sql`
    SELECT 
      e1.agent_id as agentId,
      e1.incident_id as incidentId,
      e1.event_at as openedAt
    FROM incident_events e1
    WHERE e1.event_type = 'opened'
    AND NOT EXISTS (
      SELECT 1 FROM incident_events e2
      WHERE e2.incident_id = e1.incident_id
      AND e2.event_type = 'recovered'
    )
  `);

  return rows.map((row) => ({
    agentId: row.agentId,
    incidentId: row.incidentId,
    openedAt: row.openedAt,
  }));
}

/**
 * Get all events for a specific agent within a time range.
 */
export function getEventsForAgent(
  agentId: number,
  sinceMs: number,
  untilMs?: number,
): IncidentEvent[] {
  const { db } = getDatabase();

  let whereClause = sql`${incidentEvents.agentId} = ${agentId} AND ${incidentEvents.eventAt} >= ${sinceMs}`;
  if (untilMs !== undefined) {
    whereClause = sql`${incidentEvents.agentId} = ${agentId} AND ${incidentEvents.eventAt} >= ${sinceMs} AND ${incidentEvents.eventAt} <= ${untilMs}`;
  }

  const rows = db
    .select()
    .from(incidentEvents)
    .where(whereClause)
    .orderBy(desc(incidentEvents.eventAt))
    .all();

  return rows.map(rowToIncidentEvent);
}

/**
 * Get events for all agents within a time range.
 * Useful for global incident timeline views.
 *
 * Note: Use getEventsForAgent() if you need to filter by a specific agent.
 */
export function getEventsForTimeRange(
  sinceMs: number,
  untilMs?: number,
): IncidentEvent[] {
  const { db } = getDatabase();

  const whereClause =
    untilMs !== undefined
      ? sql`${incidentEvents.eventAt} >= ${sinceMs} AND ${incidentEvents.eventAt} <= ${untilMs}`
      : sql`${incidentEvents.eventAt} >= ${sinceMs}`;

  const rows = db
    .select()
    .from(incidentEvents)
    .where(whereClause)
    .orderBy(desc(incidentEvents.eventAt))
    .all();

  return rows.map(rowToIncidentEvent);
}

/**
 * Get all events for a specific incident ID.
 */
export function getEventsForIncident(incidentId: string): IncidentEvent[] {
  const { db } = getDatabase();

  const rows = db
    .select()
    .from(incidentEvents)
    .where(sql`${incidentEvents.incidentId} = ${incidentId}`)
    .orderBy(incidentEvents.eventAt)
    .all();

  return rows.map(rowToIncidentEvent);
}

/**
 * Get the total number of incident events in the database.
 */
export function getTotalEventsCount(): number {
  const { db } = getDatabase();

  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(incidentEvents)
    .get();

  return row?.count ?? 0;
}

/**
 * Convert a database row to an IncidentEvent object.
 */
function rowToIncidentEvent(row: {
  id: number;
  agentId: number;
  incidentId: string;
  eventAt: Date;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}): IncidentEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    incidentId: row.incidentId,
    eventAt: row.eventAt.getTime(), // Convert Date to ms timestamp
    eventType: row.eventType as EventType,
    fromStatus: row.fromStatus as CheckStatus | null,
    toStatus: row.toStatus as CheckStatus | null,
    reason: row.reason,
  };
}
