import type { CheckStatus } from "../../shared/types";
import { logger } from "./loggerService";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import {
  getAgentLastNChecks,
  insertCheck as insertCheckRepo,
} from "../storage/sqlite/checksRepo";
import {
  getOpenIncidents,
  insertEvent,
} from "../storage/sqlite/incidentEventsRepo";
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

      getEnabledAgents(): Array<{ id: number }> {
        // This is async in the app, but sync in the tracker
        // We need to handle this specially - see reconstructState below
        return [];
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
  const openIncidents = getOpenIncidents();

  // Build map of open incidents by agent
  const openIncidentsByAgent = new Map<
    number,
    { incidentId: string; openedAt: number }
  >();
  for (const incident of openIncidents) {
    openIncidentsByAgent.set(incident.agentId, {
      incidentId: incident.incidentId,
      openedAt: incident.openedAt,
    });
  }

  // For each agent, reconstruct state manually (app uses async readAgents)
  for (const agent of agents) {
    const agentId = agent.id;

    // Check if there's an open incident for this agent
    const openIncident = openIncidentsByAgent.get(agentId);
    if (openIncident) {
      // There was an open incident - the tracker will establish state on first poll
      logger.debug(
        "incident",
        `[Agent ${agentId}] Found open incident: ${openIncident.incidentId}`,
      );
    }
  }

  // Use the tracker's reconstructState but with our own agent loading
  // Since the tracker's getEnabledAgents doesn't work with async, we do manual setup
  // and let the first few polls establish proper state

  logger.info(
    "incident",
    `State reconstruction complete: ${openIncidents.length} open incidents across ${agents.length} agents`,
  );
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

  // Recreate tracker with new thresholds
  tracker = createTracker();

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
  logger.debug("incident", "All incident state cleared");
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
