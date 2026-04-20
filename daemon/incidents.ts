import { eq, sql } from "drizzle-orm";
import { logger } from "../src/shared/logger";
import type { CheckStatus } from "../src/shared/types";
import { getDatabase } from "./db";
import { agents, checks, incidentEvents } from "./schema";

// Default thresholds for incident detection
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_THRESHOLD = 2;

// Read thresholds from environment or use defaults
const failureThreshold = parseInt(process.env.FAILURE_THRESHOLD || "3", 10);
const recoveryThreshold = parseInt(process.env.RECOVERY_THRESHOLD || "2", 10);

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

/**
 * Reconstruct incident state from database at startup.
 * Must be called during daemon initialization.
 */
export function reconstructState(): void {
  logger.info("incidents", "Reconstructing incident state from database...");

  const { db } = getDatabase();

  // Get all open incidents (incidents with 'opened' event but no 'recovered' event)
  const openIncidents = db.all<{
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

  // Get all enabled agents
  const allAgents = db.select().from(agents).where(sql`${agents.enabled} = 1`).all();

  // For each agent, reconstruct state
  for (const agent of allAgents) {
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
        "incidents",
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
        "incidents",
        `[Agent ${agentId}] Reconstructed failureCounter=${consecutiveNonOk}, lastStatus=${state.lastStatus}`,
      );
    }

    agentStates.set(agentId, state);
  }

  logger.info(
    "incidents",
    `State reconstruction complete: ${openIncidents.length} open incidents across ${allAgents.length} agents`,
  );
}

/**
 * Get the last N checks for an agent.
 */
function getAgentLastNChecks(
  agentId: number,
  n: number,
): Array<{ status: CheckStatus; checkedAt: Date }> {
  const { db } = getDatabase();

  return db
    .select({
      status: checks.status,
      checkedAt: checks.checkedAt,
    })
    .from(checks)
    .where(eq(checks.agentId, agentId))
    .orderBy(sql`${checks.checkedAt} DESC`)
    .limit(n)
    .all() as Array<{ status: CheckStatus; checkedAt: Date }>;
}

/**
 * Record a health check result for an agent and update incident state.
 * This is called after each poll for each agent.
 *
 * @param agentId - The agent ID
 * @param status - The agent status from the health check
 */
export function recordCheck(agentId: number, status: CheckStatus): void {
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
    "incidents",
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
      "incidents",
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
    "incidents",
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
        "incidents",
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
        "incidents",
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
 * Insert an incident event into the database.
 */
function insertEvent(
  agentId: number,
  incidentId: string,
  eventType: "opened" | "recovered" | "status_changed",
  fromStatus: CheckStatus | null,
  toStatus: CheckStatus | null,
  reason: string | null,
): void {
  const { db } = getDatabase();

  db.insert(incidentEvents)
    .values({
      agentId,
      incidentId,
      eventType,
      eventAt: new Date(),
      fromStatus,
      toStatus,
      reason,
    })
    .run();
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
 * Remove an agent's state from the in-memory Map.
 * Call this when an agent is deleted to prevent memory leaks.
 */
export function removeAgentState(agentId: number): void {
  const existed = agentStates.delete(agentId);
  if (existed) {
    logger.debug("incidents", `[Agent ${agentId}] Removed from incident state`);
  }
}
