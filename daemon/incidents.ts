import { eq, sql } from "drizzle-orm";
import { logger } from "../src/shared/logger";
import type { CheckStatus } from "../src/shared/types";
import {
  createIncidentTracker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
} from "../src/shared/incidentCore";
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
      return db.all<{
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
    },

    getHandedOffIncidents(): Array<{
      agentId: number;
      incidentId: string;
      linkedIncidentId: string | null;
    }> {
      // Daemon never creates handoff events, so this always returns empty
      return [];
    },

    getEnabledAgents(): Array<{ id: number }> {
      const { db } = getDatabase();
      return db
        .select({ id: agents.id })
        .from(agents)
        .where(sql`${agents.enabled} = 1`)
        .all();
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

// Export the tracker methods
export const reconstructState = tracker.reconstructState;
export const recordCheck = tracker.recordCheck;
export const getAgentState = tracker.getAgentState;
export const hasOpenIncident = tracker.hasOpenIncident;
export const getOpenIncidentId = tracker.getOpenIncidentId;
export const removeAgentState = tracker.removeAgentState;
