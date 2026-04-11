import type { CheckStatus } from "$shared/types";
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

// Hardcoded defaults - these can be promoted to configurable settings later
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_THRESHOLD = 2;

/**
 * Per-agent incident tracking state.
 */
interface AgentIncidentState {
  failureCounter: number; // consecutive non-OK checks
  recoveryCounter: number; // consecutive OK checks (starts at 0 after incident opens)
  openIncidentId: string | null;
  lastStatus: CheckStatus | null;
}

// In-memory state: agentId -> state
const agentStates: Map<number, AgentIncidentState> = new Map();

// Thresholds (read from settings on init, can be updated)
let failureThreshold = DEFAULT_FAILURE_THRESHOLD;
let recoveryThreshold = DEFAULT_RECOVERY_THRESHOLD;

/**
 * Initialize the incident service with thresholds from settings.
 * Call this at app startup before polling begins.
 */
export function initIncidentService(): void {
  const settings = getNotificationSettings();
  failureThreshold = settings.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  recoveryThreshold = settings.recoveryThreshold ?? DEFAULT_RECOVERY_THRESHOLD;
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

  // For each agent, reconstruct state
  for (const agent of agents) {
    const agentId = agent.id;
    const state: AgentIncidentState = {
      failureCounter: 0,
      recoveryCounter: 0,
      openIncidentId: null,
      lastStatus: null,
    };

    // Check if there's an open incident for this agent
    const openIncident = openIncidentsByAgent.get(agentId);
    if (openIncident) {
      state.openIncidentId = openIncident.incidentId;
      state.recoveryCounter = 0; // Start fresh for recovery detection
      logger.debug(
        "incident",
        `[Agent ${agentId}] Reconstructed open incident: ${openIncident.incidentId}`,
      );
    }

    // Load recent checks to count consecutive non-OK checks
    const recentChecks = getAgentLastNChecks(agentId, failureThreshold + 1);
    if (recentChecks.length > 0) {
      // Count consecutive non-OK checks from the most recent check working backward
      let consecutiveNonOk = 0;
      for (const check of recentChecks) {
        if (check.status !== "ok") {
          consecutiveNonOk++;
        } else {
          break; // Stop counting when we hit an OK check
        }
      }
      state.failureCounter = consecutiveNonOk;
      state.lastStatus = recentChecks[0].status;

      logger.debug(
        "incident",
        `[Agent ${agentId}] Reconstructed failureCounter=${consecutiveNonOk}, lastStatus=${state.lastStatus}`,
      );
    }

    agentStates.set(agentId, state);
  }

  logger.info(
    "incident",
    `State reconstruction complete: ${openIncidents.length} open incidents across ${agents.length} agents`,
  );
}

/**
 * Record a health check result for an agent.
 * This is called after each poll for each agent.
 *
 * @param agentId - The agent ID
 * @param status - The agent status from the health check
 * @param responseMs - Response time in milliseconds
 * @param httpStatus - HTTP status code (or null if failed)
 * @param errorCode - Error code (or null)
 * @param errorMessage - Error message (or null)
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

  // Get or create the agent's state
  let state = agentStates.get(agentId);
  if (!state) {
    state = {
      failureCounter: 0,
      recoveryCounter: 0,
      openIncidentId: null,
      lastStatus: null,
    };
    agentStates.set(agentId, state);
  }

  const previousStatus = state.lastStatus;
  state.lastStatus = status;

  // State machine logic
  if (status === "ok") {
    handleOkCheck(agentId, state, previousStatus);
  } else {
    handleNonOkCheck(agentId, status, state, previousStatus);
  }
}

/**
 * Handle an OK check result.
 */
function handleOkCheck(
  agentId: number,
  state: AgentIncidentState,
  previousStatus: CheckStatus | null,
): void {
  // Reset failure counter
  state.failureCounter = 0;

  if (state.openIncidentId === null) {
    // No open incident, nothing to do
    return;
  }

  // There's an open incident, increment recovery counter
  state.recoveryCounter++;

  logger.debug(
    "incident",
    `[Agent ${agentId}] Recovery counter: ${state.recoveryCounter}/${recoveryThreshold}`,
  );

  // Check if we've reached the recovery threshold
  if (state.recoveryCounter >= recoveryThreshold) {
    // Close the incident
    const incidentId = state.openIncidentId;
    insertEvent(
      agentId,
      incidentId,
      "recovered",
      previousStatus,
      "ok",
      `Recovered after ${state.recoveryCounter} consecutive OK checks`,
    );

    logger.info(
      "incident",
      `[Agent ${agentId}] Incident ${incidentId} recovered`,
    );

    // Reset state
    state.openIncidentId = null;
    state.recoveryCounter = 0;
  }
}

/**
 * Handle a non-OK check result (offline, error, degraded).
 */
function handleNonOkCheck(
  agentId: number,
  status: CheckStatus,
  state: AgentIncidentState,
  previousStatus: CheckStatus | null,
): void {
  // Reset recovery counter since we're not OK
  state.recoveryCounter = 0;

  // Increment failure counter
  state.failureCounter++;

  logger.debug(
    "incident",
    `[Agent ${agentId}] Failure counter: ${state.failureCounter}/${failureThreshold} (status: ${status})`,
  );

  if (state.openIncidentId === null) {
    // No open incident yet - check if we should open one
    if (state.failureCounter >= failureThreshold) {
      // Open a new incident
      const incidentId = generateIncidentId(agentId);
      state.openIncidentId = incidentId;

      insertEvent(
        agentId,
        incidentId,
        "opened",
        previousStatus,
        status,
        `Incident opened after ${state.failureCounter} consecutive non-OK checks`,
      );

      logger.info(
        "incident",
        `[Agent ${agentId}] Incident ${incidentId} opened (status: ${status})`,
      );
    }
  } else {
    // There's already an open incident
    // Check if status changed from the last non-OK status
    if (
      previousStatus !== null &&
      previousStatus !== status &&
      previousStatus !== "ok"
    ) {
      // Status changed within the incident (e.g., offline -> error)
      insertEvent(
        agentId,
        state.openIncidentId,
        "status_changed",
        previousStatus,
        status,
        `Status changed from ${previousStatus} to ${status}`,
      );

      logger.info(
        "incident",
        `[Agent ${agentId}] Incident ${state.openIncidentId} status changed: ${previousStatus} -> ${status}`,
      );
    }
  }
}

/**
 * Generate a deterministic incident ID.
 * Format: {agentId}-{timestamp}
 */
function generateIncidentId(agentId: number): string {
  return `${agentId}-${Date.now()}`;
}

/**
 * Get the current state for an agent (for debugging/testing).
 */
export function getAgentState(agentId: number): AgentIncidentState | undefined {
  return agentStates.get(agentId);
}

/**
 * Check if an agent has an open incident.
 */
export function hasOpenIncident(agentId: number): boolean {
  const state = agentStates.get(agentId);
  return state?.openIncidentId !== null;
}

/**
 * Get the open incident ID for an agent (or null if none).
 */
export function getOpenIncidentId(agentId: number): string | null {
  const state = agentStates.get(agentId);
  return state?.openIncidentId ?? null;
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
  logger.info(
    "incident",
    `Updated thresholds: failureThreshold=${failureThreshold}, recoveryThreshold=${recoveryThreshold}`,
  );
}
