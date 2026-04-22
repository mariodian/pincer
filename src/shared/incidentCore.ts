import type { CheckStatus } from "./types";

// Default thresholds for incident detection
export const DEFAULT_FAILURE_THRESHOLD = 3;
export const DEFAULT_RECOVERY_THRESHOLD = 2;

/**
 * Per-agent incident tracking state.
 */
export interface AgentIncidentState {
  failureCounter: number; // consecutive non-OK checks
  recoveryCounter: number; // consecutive OK checks (starts at 0 after incident opens)
  openIncidentId: string | null;
  lastStatus: CheckStatus | null;
}

/**
 * Dependencies required by the incident tracker.
 * These are provided by the caller (app or daemon) to handle DB operations.
 */
export interface IncidentTrackerDeps {
  /** Insert an incident event into the database */
  insertEvent: (
    agentId: number,
    incidentId: string,
    eventType: "opened" | "recovered" | "status_changed",
    fromStatus: CheckStatus | null,
    toStatus: CheckStatus | null,
    reason: string | null,
  ) => void;
  /** Get the last N checks for an agent (most recent first) */
  getAgentLastNChecks: (
    agentId: number,
    n: number,
  ) => Array<{ status: CheckStatus; checkedAt: number | Date }>;
  /** Get all open incidents (for state reconstruction) */
  getOpenIncidents: () => Array<{
    agentId: number;
    incidentId: string;
    openedAt: number;
  }>;
  /** Get all enabled agents (for state reconstruction) */
  getEnabledAgents: () => Array<{ id: number }>;
  /** Logger function for incident-related logging */
  log: (level: "info" | "debug", message: string) => void;
}

/**
 * Configuration for the incident tracker.
 */
export interface IncidentTrackerConfig {
  failureThreshold: number;
  recoveryThreshold: number;
}

/**
 * Create an incident tracker with the given dependencies and config.
 * Returns an object with methods to manage incident state.
 */
export function createIncidentTracker(
  deps: IncidentTrackerDeps,
  config: IncidentTrackerConfig,
) {
  // In-memory state: agentId -> state
  const agentStates: Map<number, AgentIncidentState> = new Map();

  /**
   * Reconstruct incident state from database at startup.
   * @param providedAgents Optional array of agents to use instead of deps.getEnabledAgents()
   */
  function reconstructState(providedAgents?: Array<{ id: number }>): void {
    deps.log("info", "Reconstructing incident state from database...");

    const openIncidents = deps.getOpenIncidents();
    const agents = providedAgents ?? deps.getEnabledAgents();

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
        deps.log(
          "debug",
          `[Agent ${agentId}] Reconstructed open incident: ${openIncident.incidentId}`,
        );
      }

      // Load recent checks to count consecutive non-OK checks
      const recentChecks = deps.getAgentLastNChecks(
        agentId,
        config.failureThreshold + 1,
      );
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

        deps.log(
          "debug",
          `[Agent ${agentId}] Reconstructed failureCounter=${consecutiveNonOk}, lastStatus=${state.lastStatus}`,
        );
      }

      agentStates.set(agentId, state);
    }

    deps.log(
      "info",
      `State reconstruction complete: ${openIncidents.length} open incidents across ${agents.length} agents`,
    );
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

    deps.log(
      "debug",
      `[Agent ${agentId}] Recovery counter: ${state.recoveryCounter}/${config.recoveryThreshold}`,
    );

    // Check if we've reached the recovery threshold
    if (state.recoveryCounter >= config.recoveryThreshold) {
      // Close the incident
      const incidentId = state.openIncidentId;
      deps.insertEvent(
        agentId,
        incidentId,
        "recovered",
        previousStatus,
        "ok",
        `Recovered after ${state.recoveryCounter} consecutive OK checks`,
      );

      deps.log("info", `[Agent ${agentId}] Incident ${incidentId} recovered`);

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

    deps.log(
      "debug",
      `[Agent ${agentId}] Failure counter: ${state.failureCounter}/${config.failureThreshold} (status: ${status})`,
    );

    if (state.openIncidentId === null) {
      // No open incident yet - check if we should open one
      if (state.failureCounter >= config.failureThreshold) {
        // Open a new incident
        const incidentId = generateIncidentId(agentId);
        state.openIncidentId = incidentId;

        deps.insertEvent(
          agentId,
          incidentId,
          "opened",
          previousStatus,
          status,
          `Incident opened after ${state.failureCounter} consecutive non-OK checks`,
        );

        deps.log(
          "info",
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
        deps.insertEvent(
          agentId,
          state.openIncidentId,
          "status_changed",
          previousStatus,
          status,
          `Status changed from ${previousStatus} to ${status}`,
        );

        deps.log(
          "info",
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
   * Record a health check result for an agent and update incident state.
   */
  function recordCheck(agentId: number, status: CheckStatus): void {
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
   * Get the current state for an agent (for debugging/testing).
   */
  function getAgentState(agentId: number): AgentIncidentState | undefined {
    return agentStates.get(agentId);
  }

  /**
   * Check if an agent has an open incident.
   */
  function hasOpenIncident(agentId: number): boolean {
    const state = agentStates.get(agentId);
    return state?.openIncidentId !== null;
  }

  /**
   * Get the open incident ID for an agent (or null if none).
   */
  function getOpenIncidentId(agentId: number): string | null {
    const state = agentStates.get(agentId);
    return state?.openIncidentId ?? null;
  }

  /**
   * Remove an agent's state from the in-memory Map.
   * Call this when an agent is deleted to prevent memory leaks.
   */
  function removeAgentState(agentId: number): boolean {
    const existed = agentStates.delete(agentId);
    if (existed) {
      deps.log("debug", `[Agent ${agentId}] Removed from incident state`);
    }
    return existed;
  }

  /**
   * Clear all incident state from memory.
   */
  function clearState(): void {
    agentStates.clear();
    deps.log("debug", "All incident state cleared");
  }

  return {
    reconstructState,
    recordCheck,
    getAgentState,
    hasOpenIncident,
    getOpenIncidentId,
    removeAgentState,
    clearState,
  };
}
