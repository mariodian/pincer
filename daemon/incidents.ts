import { eq, sql } from "drizzle-orm";
import { logger } from "../src/shared/logger";
import type { CheckStatus } from "../src/shared/types";
import {
  createIncidentTracker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
} from "../src/shared/incidentCore";
import { buildOpenIncidentsQuery } from "../src/shared/incident-queries";
import { getDatabase } from "./db";
import { agents, checks, incidentEvents } from "./schema";

// Read thresholds from environment or use defaults
const failureThreshold = parseInt(
  process.env.FAILURE_THRESHOLD || String(DEFAULT_FAILURE_THRESHOLD),
  10,
);
const recoveryThreshold = parseInt(
  process.env.RECOVERY_THRESHOLD || String(DEFAULT_RECOVERY_THRESHOLD),
  10,
);

// Create the incident tracker with daemon-specific dependencies
const tracker = createIncidentTracker(
  {
    insertEvent(
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
    },

    getAgentLastNChecks(
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
    },

    getOpenIncidents(): Array<{
      agentId: number;
      incidentId: string;
      openedAt: number;
    }> {
      const { db } = getDatabase();
      // Use shared query to ensure consistency with app (excludes both 'recovered' and 'handoff')
      return db.all<{
        agentId: number;
        incidentId: string;
        openedAt: number;
      }>(buildOpenIncidentsQuery());
    },

    getHandedOffIncidents(): Array<{
      agentId: number;
      incidentId: string;
      linkedIncidentId: string | null;
    }> {
      // Daemon never creates handoff events, so this always returns empty
      return [];
    },

    hasIncidentRecovered(incidentId: string): boolean {
      const { db } = getDatabase();
      const result = db
        .select({ count: sql<number>`count(*)` })
        .from(incidentEvents)
        .where(
          sql`${incidentEvents.incidentId} = ${incidentId} AND ${incidentEvents.eventType} = 'recovered'`,
        )
        .get();
      return (result?.count ?? 0) > 0;
    },

    log(level: "info" | "debug", message: string): void {
      if (level === "info") {
        logger.info("incidents", message);
      } else {
        logger.debug("incidents", message);
      }
    },
  },
  { failureThreshold, recoveryThreshold },
);

/** Reconstruct incident state from database, fetching enabled agents first. */
export function reconstructState(): void {
  const { db } = getDatabase();
  const enabledAgents = db
    .select({ id: agents.id })
    .from(agents)
    .where(sql`${agents.enabled} = 1`)
    .all();
  tracker.reconstructState(enabledAgents);
}

export const recordCheck = tracker.recordCheck;
export const getAgentState = tracker.getAgentState;
export const hasOpenIncident = tracker.hasOpenIncident;
export const getOpenIncidentId = tracker.getOpenIncidentId;
export const removeAgentState = tracker.removeAgentState;
