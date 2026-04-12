import type { IncidentEvent } from "$shared/types";

/**
 * Group incident events by their incident ID.
 * @param events - Array of incident events
 * @returns Map of incidentId -> events for that incident
 */
export function groupEventsByIncident(
  events: IncidentEvent[],
): Map<string, IncidentEvent[]> {
  const grouped = new Map<string, IncidentEvent[]>();
  for (const event of events) {
    const existing = grouped.get(event.incidentId) || [];
    existing.push(event);
    grouped.set(event.incidentId, existing);
  }
  return grouped;
}

/**
 * Split incidents into recent and older based on activity cutoff time.
 * Events are sorted by time (descending) within each bucket.
 *
 * @param eventsByIncident - Map of incidentId -> events (from groupEventsByIncident)
 * @param activityCutoffMs - Timestamp in ms; incidents with ANY event at or after this time are "recent"
 * @returns Object with recentEvents, olderEvents, and the incident ID sets
 */
export function splitIncidentsByActivity(
  eventsByIncident: Map<string, IncidentEvent[]>,
  activityCutoffMs: number,
): {
  recentEvents: IncidentEvent[];
  olderEvents: IncidentEvent[];
  recentIncidentIds: Set<string>;
  olderIncidentIds: Set<string>;
} {
  // Determine which incidents have recent activity
  const recentIncidentIds = new Set<string>();
  const olderIncidentIds = new Set<string>();

  for (const [incidentId, events] of eventsByIncident) {
    const hasRecentActivity = events.some((e) => e.eventAt >= activityCutoffMs);
    if (hasRecentActivity) {
      recentIncidentIds.add(incidentId);
    } else {
      olderIncidentIds.add(incidentId);
    }
  }

  // Collect events for each bucket
  const recentEvents: IncidentEvent[] = [];
  const olderEvents: IncidentEvent[] = [];

  for (const [incidentId, events] of eventsByIncident) {
    if (recentIncidentIds.has(incidentId)) {
      recentEvents.push(...events);
    } else {
      olderEvents.push(...events);
    }
  }

  // Sort events within each bucket by time (descending for display)
  recentEvents.sort((a, b) => b.eventAt - a.eventAt);
  olderEvents.sort((a, b) => b.eventAt - a.eventAt);

  return {
    recentEvents,
    olderEvents,
    recentIncidentIds,
    olderIncidentIds,
  };
}

/**
 * Sort incidents by their most recent event time (descending).
 * Returns an array of [incidentId, events] tuples.
 *
 * @param eventsByIncident - Map of incidentId -> events
 * @returns Sorted array of [incidentId, events] tuples
 */
export function sortIncidentsByRecentEvent(
  eventsByIncident: Map<string, IncidentEvent[]>,
): Array<[string, IncidentEvent[]]> {
  return Array.from(eventsByIncident.entries()).sort((a, b) => {
    const aMax = Math.max(...a[1].map((e) => e.eventAt));
    const bMax = Math.max(...b[1].map((e) => e.eventAt));
    return bMax - aMax;
  });
}
