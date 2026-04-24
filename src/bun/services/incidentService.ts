import type { CheckStatus } from "../../shared/types";
import { logger } from "./loggerService";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import {
  getAgentLastNChecks,
  insertCheck as insertCheckRepo,
} from "../storage/sqlite/checksRepo";
import {
  getOpenIncidents,
  getHandedOffIncidents,
  insertEvent,
} from "../storage/sqlite/incidentEventsRepo";
import { getDatabase } from "../storage/sqlite/db";
import { readAgents } from "./agentService";
import {
  createIncidentTracker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
} from "../../shared/incidentCore";

// Export defaults for external use
export { DEFAULT_FAILURE_THRESHOLD, DEFAULT_RECOVERY_THRESHOLD };

// Thresholds (read from settings on init, can be updated)
let failureThreshold = DEFAULT_FAILURE_THRESHOLD;
let recoveryThreshold = DEFAULT_RECOVERY_THRESHOLD;

// Create the incident tracker with app-specific dependencies
let tracker = createTracker();

function createTracker() {
  return createIncidentTracker(
    {
      insertEvent(
        agentId: number,
        incidentId: string,
        eventType: "opened" | "recovered" | "status_changed",
        fromStatus: CheckStatus | null,
        toStatus: CheckStatus | null,
        reason: string | null,
      ): void {
        insertEvent(
          agentId,
          incidentId,
          eventType,
          fromStatus,
          toStatus,
          reason,
        );
      },

      getAgentLastNChecks(
        agentId: number,
        n: number,
      ): Array<{ status: CheckStatus; checkedAt: number }> {
        return getAgentLastNChecks(agentId, n);
      },

      getOpenIncidents(): Array<{
        agentId: number;
        incidentId: string;
        openedAt: number;
      }> {
        return getOpenIncidents();
      },

      getHandedOffIncidents(): Array<{
        agentId: number;
        incidentId: string;
        linkedIncidentId: string | null;
      }> {
        return getHandedOffIncidents();
      },

      getEnabledAgents(): Array<{ id: number }> {
        // This is async in the app, but sync in the tracker
        // We need to handle this specially - see reconstructState below
        return [];
      },

      hasIncidentRecovered(incidentId: string): boolean {
        // Single optimized SQL query to check if incident has recovered
        // Checks both: the incident itself, AND any linked daemon incidents
        const { sqlite } = getDatabase();
        const result = sqlite
          .prepare(
            `
            SELECT EXISTS (
              -- Check if the incident itself has a recovered event
              SELECT 1 FROM incident_events
              WHERE incident_id = ? AND event_type = 'recovered'
              UNION
              -- Check if any linked daemon incident has recovered
              SELECT 1 FROM incident_events e1
              WHERE e1.linked_incident_id = ?
              AND EXISTS (
                SELECT 1 FROM incident_events e2
                WHERE e2.incident_id = e1.incident_id AND e2.event_type = 'recovered'
              )
            ) as hasRecovered
          `,
          )
          .get(incidentId, incidentId) as { hasRecovered: number };

        return result.hasRecovered === 1;
      },

      log(level: "info" | "debug", message: string): void {
        if (level === "info") {
          logger.info("incident", message);
        } else {
          logger.debug("incident", message);
        }
      },
    },
    { failureThreshold, recoveryThreshold },
  );
}

/**
 * Initialize the incident service with thresholds from settings.
 * Call this at app startup before polling begins.
 */
export function initIncidentService(): void {
  const settings = getNotificationSettings();
  failureThreshold = settings.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  recoveryThreshold = settings.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD;

  // Recreate tracker with new thresholds
  tracker = createTracker();

  logger.info(
    "incident",
    `Initialized incident service (failureThreshold=${failureThreshold}, recoveryThreshold=${recoveryThreshold})`,
  );
}

/**
 * Reconstruct incident state from database at startup.
 * Must be called after initIncidentService() but before the first poll.
 */
export async function reconstructState(): Promise<void> {
  logger.info("incident", "Reconstructing incident state from database...");

  const agents = await readAgents();

  // Use the tracker's reconstructState with agents from async readAgents()
  tracker.reconstructState(agents);
}

/**
 * Record a health check result for an agent.
 * This is called after each poll for each agent.
 */
export function recordCheck(
  agentId: number,
  status: CheckStatus,
  responseMs: number,
  httpStatus: number | null,
  errorCode: string | null,
  errorMessage: string | null,
): void {
  // Insert the raw check into the database
  insertCheckRepo(
    agentId,
    status,
    responseMs,
    httpStatus,
    errorCode,
    errorMessage,
  );

  // Use the shared tracker for incident detection
  tracker.recordCheck(agentId, status);
}

/**
 * Get the current state for an agent (for debugging/testing).
 */
export function getAgentState(agentId: number) {
  return tracker.getAgentState(agentId);
}

/**
 * Check if an agent has an open incident.
 */
export function hasOpenIncident(agentId: number): boolean {
  return tracker.hasOpenIncident(agentId);
}

/**
 * Get the open incident ID for an agent (or null if none).
 */
export function getOpenIncidentId(agentId: number): string | null {
  return tracker.getOpenIncidentId(agentId);
}

/**
 * Update thresholds from settings (call when settings change).
 */
export function updateThresholds(
  newFailureThreshold: number,
  newRecoveryThreshold: number,
): void {
  failureThreshold = newFailureThreshold;
  recoveryThreshold = newRecoveryThreshold;

  // Update thresholds in-place without losing in-memory state
  tracker.updateThresholds(newFailureThreshold, newRecoveryThreshold);

  logger.info(
    "incident",
    `Updated thresholds: failureThreshold=${failureThreshold}, recoveryThreshold=${recoveryThreshold}`,
  );
}

/**
 * Remove an agent's state from the in-memory Map.
 * Call this when an agent is deleted to prevent memory leaks.
 */
export function removeAgentState(agentId: number): void {
  tracker.removeAgentState(agentId);
}

/**
 * Clear all incident state from memory.
 * Call this when switching to daemon mode (daemon handles incident detection).
 */
export function clearState(): void {
  tracker.clearState();
}

/**
 * Close all locally-opened incidents by inserting 'recovered' events.
 * Call this when switching to daemon mode to prevent orphaned incidents.
 * Returns the number of incidents closed.
 */
export function closeAllOpenIncidents(): number {
  const openIncidents = getOpenIncidents();

  for (const incident of openIncidents) {
    insertEvent(
      incident.agentId,
      incident.incidentId,
      "recovered",
      null,
      "ok",
      "Switched to daemon monitoring",
    );
  }

  if (openIncidents.length > 0) {
    logger.info(
      "incident",
      `Closed ${openIncidents.length} local open incidents - switching to daemon monitoring`,
    );
  }

  return openIncidents.length;
}
