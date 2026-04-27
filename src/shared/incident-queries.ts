import { sql, type SQL } from "drizzle-orm";

/**
 * Build the SQL query for getting open incidents.
 *
 * An incident is considered "open" if it has an 'opened' event
 * but no 'recovered' or 'handoff' event.
 *
 * This query uses an anti-join pattern for efficient lookups.
 *
 * @returns SQL query that returns { agentId, incidentId, openedAt }
 */
export function buildOpenIncidentsQuery(): SQL {
  return sql`
    SELECT
      e1.agent_id as agentId,
      e1.incident_id as incidentId,
      e1.event_at as openedAt
    FROM incident_events e1
    WHERE e1.event_type = 'opened'
    AND NOT EXISTS (
      SELECT 1 FROM incident_events e2
      WHERE e2.incident_id = e1.incident_id
      AND e2.event_type IN ('recovered', 'handoff')
    )
  `;
}

/**
 * Build the SQL query for getting handed-off incidents.
 *
 * A handed-off incident is one that has a 'handoff' event
 * but no 'recovered' event. These are incidents that were
 * handed off to the daemon and are still active remotely.
 *
 * Note: The daemon schema doesn't include linked_incident_id,
 * so this query is only used by the app.
 *
 * @returns SQL query that returns { agentId, incidentId, linkedIncidentId }
 */
export function buildHandedOffIncidentsQuery(): SQL {
  return sql`
    SELECT
      e1.agent_id as agentId,
      e1.incident_id as incidentId,
      e1.linked_incident_id as linkedIncidentId
    FROM incident_events e1
    WHERE e1.event_type = 'handoff'
    AND NOT EXISTS (
      SELECT 1 FROM incident_events e2
      WHERE e2.incident_id = e1.incident_id
      AND e2.event_type = 'recovered'
    )
  `;
}
