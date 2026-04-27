import { desc, sql } from "drizzle-orm";

import { rowToIncidentEvent } from "../../../shared/db-helpers";
import {
  buildHandedOffIncidentsQuery,
  buildOpenIncidentsQuery,
} from "../../../shared/incident-queries";
import type {
  CheckStatus,
  EventType,
  IncidentEvent,
} from "../../../shared/types";
import { logger } from "../../services/loggerService";
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
  linkedIncidentId: string | null = null,
): IncidentEvent {
  const { db } = getDatabase();
  const eventAt = new Date();

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
      linkedIncidentId,
    })
    .returning()
    .get();

  return rowToIncidentEvent(row);
}

/**
 * Get all incident IDs that have an "opened" event in the database.
 */
function getIncidentIdsWithOpenedEvent(): Set<string> {
  const { sqlite } = getDatabase();
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT incident_id FROM incident_events WHERE event_type = 'opened'`,
    )
    .all() as Array<{ incident_id: string }>;
  return new Set(rows.map((r) => r.incident_id));
}

/**
 * Get existing "opened" and "recovered" event pairs to prevent duplicates.
 * These are "once per incident" events and should not be duplicated when syncing from daemon.
 */
function getExistingLifecycleEventIds(): Set<string> {
  const { sqlite } = getDatabase();
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT incident_id, event_type FROM incident_events WHERE event_type IN ('opened', 'recovered')`,
    )
    .all() as Array<{ incident_id: string; event_type: string }>;
  return new Set(rows.map((r) => `${r.incident_id}:${r.event_type}`));
}

/**
 * Insert a batch of incident events from daemon sync.
 * Uses INSERT OR IGNORE to skip duplicates.
 * Filters out:
 *   - "recovered" events that don't have a matching "opened" event
 *   - Duplicate "opened" or "recovered" events for the same incident
 * Returns the number of events inserted.
 *
 * Also links daemon events to local incidents: if a local incident that
 * hasn't been resolved exists for the same agent, the daemon event
 * gets linked to it via linked_incident_id.
 */
export function insertEventsBatch(events: IncidentEvent[]): number {
  if (events.length === 0) return 0;

  const { sqlite } = getDatabase();

  // Collect incident IDs that have an "opened" event (in DB or in this batch)
  const openedIds = getIncidentIdsWithOpenedEvent();
  for (const event of events) {
    if (event.eventType === "opened") {
      openedIds.add(event.incidentId);
    }
  }

  // Get existing "opened" and "recovered" events to prevent duplicates
  const existingLifecycleEvents = getExistingLifecycleEventIds();

  // Filter out:
  // 1. Orphan "recovered" events (no matching "opened" event)
  // 2. Duplicate "opened" or "recovered" events (lifecycle events happen once per incident)
  const filtered = events.filter((e) => {
    // Skip orphan recovered events
    if (e.eventType === "recovered" && !openedIds.has(e.incidentId)) {
      return false;
    }
    // Skip duplicate opened/recovered events (lifecycle events are unique per incident)
    if (e.eventType === "opened" || e.eventType === "recovered") {
      const key = `${e.incidentId}:${e.eventType}`;
      if (existingLifecycleEvents.has(key)) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) return 0;

  // OPTIMIZATION: Find all unrecovered local incidents for unique agents in one batch query
  // This avoids N+1 queries when processing each event
  const uniqueAgentIds = [...new Set(filtered.map((e) => e.agentId))];
  const unrecoveredIncidents =
    findUnrecoveredLocalIncidentsBatch(uniqueAgentIds);

  const stmt = sqlite.prepare(
    `INSERT OR IGNORE INTO incident_events (agent_id, incident_id, event_at, event_type, from_status, to_status, reason, linked_incident_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  for (const event of filtered) {
    const linkedId = unrecoveredIncidents.get(event.agentId) ?? null;

    // Don't link an incident to itself
    const finalLinkedId = linkedId === event.incidentId ? null : linkedId;

    const result = stmt.run(
      event.agentId,
      event.incidentId,
      event.eventAt,
      event.eventType,
      event.fromStatus,
      event.toStatus,
      event.reason,
      finalLinkedId ?? null,
    );
    inserted += result.changes ?? 0;
  }

  return inserted;
}

/**
 * Find unrecovered local incidents for multiple agents using 2 simple queries.
 * Returns a Map of agentId -> incidentId (or null) for agents.
 *
 * Only considers OPEN local incidents (not handed-off ones), since linking
 * is only needed for events coming from the daemon when a local incident is open.
 *
 * Query 1: Get open local incidents for these agents (anti-join pattern)
 * Query 2: Find which of those have a linked daemon incident that recovered
 * JS filter: Remove recovered ones, pick first per agent
 */
function findUnrecoveredLocalIncidentsBatch(
  agentIds: number[],
): Map<number, string | null> {
  const result = new Map<number, string | null>();
  if (agentIds.length === 0) return result;

  const { sqlite } = getDatabase();
  const placeholders = agentIds.map(() => "?").join(",");

  // Query 1: Get unrecovered local incidents for these agents
  // Includes both open incidents and handed-off incidents (handoff doesn't prevent linking)
  const openLocals = sqlite
    .prepare(
      `
      SELECT e1.agent_id as agentId, e1.incident_id as incidentId
      FROM incident_events e1
      WHERE e1.agent_id IN (${placeholders})
        AND e1.event_type = 'opened'
        AND e1.linked_incident_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM incident_events e2
          WHERE e2.incident_id = e1.incident_id
          AND e2.event_type = 'recovered'
        )
    `,
    )
    .all(...agentIds) as Array<{ agentId: number; incidentId: string }>;

  if (openLocals.length === 0) {
    for (const agentId of agentIds) {
      result.set(agentId, null);
    }
    return result;
  }

  // Query 2: Find local incidents that have recovered via linked daemon incident
  // A local incident is recovered if a daemon incident linking to it has 'recovered'
  // (daemon events have linked_incident_id pointing to the local incident they link to)
  const localIncidentIds = openLocals.map((r) => r.incidentId);
  const localIdPlaceholders = localIncidentIds.map(() => "?").join(",");

  const daemonRecovered = sqlite
    .prepare(
      `
      SELECT DISTINCT linked_incident_id as localIncidentId
      FROM incident_events
      WHERE event_type = 'recovered'
      AND linked_incident_id IN (${localIdPlaceholders})
    `,
    )
    .all(...localIncidentIds) as Array<{ localIncidentId: string }>;

  const recoveredViaDaemon = new Set(
    daemonRecovered.map((r) => r.localIncidentId),
  );

  // Local incident is unrecovered if: no 'recovered'/'handoff' event (Query 1 filter)
  // AND no recovered daemon incident linked to it
  const unrecovered = openLocals.filter(
    (r) => !recoveredViaDaemon.has(r.incidentId),
  );

  for (const agentId of agentIds) {
    result.set(agentId, null);
  }
  for (const r of unrecovered) {
    if (!result.has(r.agentId) || result.get(r.agentId) === null) {
      result.set(r.agentId, r.incidentId);
    }
  }

  return result;
}

/**
 * Get all open incidents (incidents that have been opened but not recovered or handed off).
 * Uses SQL anti-join pattern to find incidents with 'opened' event
 * but no corresponding 'recovered' or 'handoff' event.
 */
export function getOpenIncidents(): Array<{
  agentId: number;
  incidentId: string;
  openedAt: number;
}> {
  const { db } = getDatabase();

  // Use shared query for the anti-join pattern
  const rows = db.all<{
    agentId: number;
    incidentId: string;
    openedAt: number;
  }>(buildOpenIncidentsQuery());

  return rows.map((row) => ({
    agentId: row.agentId,
    incidentId: row.incidentId,
    openedAt: row.openedAt,
  }));
}

/**
 * Get handed-off incidents: incidents with a 'handoff' event but no 'recovered' event.
 * These are incidents that were handed off to the daemon and are still active remotely.
 * Used during state reconstruction to prevent opening duplicate local incidents.
 */
export function getHandedOffIncidents(): Array<{
  agentId: number;
  incidentId: string;
  linkedIncidentId: string | null;
}> {
  const { db } = getDatabase();

  // Use shared query for the anti-join pattern
  const rows = db.all<{
    agentId: number;
    incidentId: string;
    linkedIncidentId: string | null;
  }>(buildHandedOffIncidentsQuery());

  return rows.map((row) => ({
    agentId: row.agentId,
    incidentId: row.incidentId,
    linkedIncidentId: row.linkedIncidentId ?? null,
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
 * Delete incident events older than the cutoff timestamp.
 * Returns the number of deleted rows.
 */
export function deleteOldEvents(cutoffMs: number): number {
  const { db } = getDatabase();

  const result = db
    .delete(incidentEvents)
    .where(sql`${incidentEvents.eventAt} < ${cutoffMs}`)
    .run();

  // @ts-expect-error - Drizzle returns void but sqlite3 returns object with changes
  return result.changes ?? 0;
}

/**
 * Count incident events older than the cutoff timestamp.
 */
export function countOldEvents(cutoffMs: number): number {
  const { db } = getDatabase();
  const row = db
    .select({ count: sql<number>`count(*)` })
    .from(incidentEvents)
    .where(sql`${incidentEvents.eventAt} < ${cutoffMs}`)
    .get();
  return row?.count ?? 0;
}

/**
 * For each local open incident, find the matching daemon open incident
 * (by agentId), set linkedIncidentId on the handoff event, and close the local incident.
 * Returns the number of incidents closed.
 */
export function linkAndCloseLocalIncidents(
  daemonOpenIncidents: Array<{ agentId: number; incidentId: string }>,
): number {
  const localOpen = getOpenIncidents();

  const daemonByAgent = new Map<number, string>();
  for (const di of daemonOpenIncidents) {
    daemonByAgent.set(di.agentId, di.incidentId);
  }

  let closed = 0;
  for (const local of localOpen) {
    const daemonIncidentId = daemonByAgent.get(local.agentId);

    // Get the incident's last status from its most recent event
    const events = getEventsForIncident(local.incidentId);
    const lastEvent = events[events.length - 1];
    const incidentStatus: CheckStatus = lastEvent?.toStatus ?? "offline";

    // Create handoff event with linkedIncidentId directly on the handoff row
    // This is where getHandedOffIncidents() reads it from
    insertEvent(
      local.agentId,
      local.incidentId,
      "handoff",
      incidentStatus,
      incidentStatus,
      daemonIncidentId
        ? "Handed off to daemon monitoring"
        : "Switched to daemon monitoring",
      daemonIncidentId ?? null,
    );
    closed++;
  }

  if (closed > 0) {
    logger.info(
      "incident",
      `Linked and closed ${closed} local incident(s) - switching to daemon monitoring`,
    );
  }

  return closed;
}

/**
 * Delete all events for a specific incident ID.
 * Returns the number of deleted rows.
 */
export function deleteIncident(incidentId: string): number {
  const { db } = getDatabase();

  const result = db
    .delete(incidentEvents)
    .where(sql`${incidentEvents.incidentId} = ${incidentId}`)
    .run();

  // @ts-expect-error - Drizzle returns void but sqlite3 returns object with changes
  return result.changes ?? 0;
}
