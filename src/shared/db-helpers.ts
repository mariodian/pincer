// Shared Database Helpers - Row-to-type conversion utilities
// Used by both main process and daemon for consistent data transformation

import type { Check, IncidentEvent } from "./types";

/**
 * Convert a database row to a Check object.
 * Handles both Date objects (from daemon/drizzle timestamp_ms mode)
 * and raw numbers (from main app INTEGER storage).
 */
export function rowToCheck(row: {
  id: number;
  agentId: number;
  checkedAt: number | Date;
  status: string;
  responseMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}): Check {
  return {
    id: row.id,
    agentId: row.agentId,
    checkedAt:
      row.checkedAt instanceof Date ? row.checkedAt.getTime() : row.checkedAt,
    status: row.status as Check["status"],
    responseMs: row.responseMs,
    httpStatus: row.httpStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}

/**
 * Convert a database row to an IncidentEvent object.
 * Handles both Date objects (from daemon/drizzle timestamp_ms mode)
 * and raw numbers (from main app INTEGER storage).
 */
export function rowToIncidentEvent(row: {
  id: number;
  agentId: number;
  incidentId: string;
  eventAt: number | Date;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
}): IncidentEvent {
  return {
    id: row.id,
    agentId: row.agentId,
    incidentId: row.incidentId,
    eventAt: row.eventAt instanceof Date ? row.eventAt.getTime() : row.eventAt,
    eventType: row.eventType as IncidentEvent["eventType"],
    fromStatus: row.fromStatus as IncidentEvent["fromStatus"],
    toStatus: row.toStatus as IncidentEvent["toStatus"],
    reason: row.reason,
  };
}
