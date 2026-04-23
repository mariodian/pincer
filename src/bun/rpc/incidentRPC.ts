// Incident RPC - Shared RPC definition for incident timeline and events
import type {
  Check,
  CheckBucket,
  IncidentEvent,
  TimeRange,
} from "../../shared/types";
import type { AgentStatRow } from "../storage/sqlite/statsRepo";
import { getAgentStats } from "../storage/sqlite/statsRepo";
import {
  getRecentChecks,
  getAllChecks,
  getChecksAggregatedByHour,
} from "../storage/sqlite/checksRepo";
import {
  getEventsForAgent,
  getEventsForTimeRange,
} from "../storage/sqlite/incidentEventsRepo";
import { readAgents } from "../services/agentService";
import { logger } from "../services/loggerService";
import { getRangeTimestamps } from "../utils/time-range";
import { getAgentColor } from "../../shared/agent-helpers";
import {
  groupEventsByIncident,
  splitIncidentsByActivity,
} from "../utils/incident-grouping";
import { SEVEN_DAYS_MS, ONE_SECOND_MS } from "../utils/constants";

export interface IncidentTimeline {
  agentId?: number;
  range: TimeRange;
  agents: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  // Incidents with ANY activity in the last 7 days + pre-aggregated check buckets for heatmap
  recent7d: {
    events: IncidentEvent[];
    checks: Check[]; // Raw checks for 24h view (smaller dataset)
    checkBuckets?: CheckBucket[]; // Aggregated buckets for 7d+ views
  };
  // Incidents with NO activity in the last 7 days + hourly stats for chart context
  older: {
    events: IncidentEvent[];
    stats: Array<AgentStatRow & { agentId: number }>;
  };
}

export type IncidentRPCType = {
  bun: {
    requests: {
      getIncidentTimeline: {
        params: { agentId?: number; range: TimeRange };
        response: IncidentTimeline;
      };
      getIncidentEvents: {
        params: { agentId?: number; from: number; to: number };
        response: IncidentEvent[];
      };
      getChecks: {
        params: { agentId?: number; since: number };
        response: Check[];
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const incidentRequestHandlers = {
  getIncidentTimeline: async ({
    agentId,
    range,
  }: {
    agentId?: number;
    range: TimeRange;
  }): Promise<IncidentTimeline> => {
    try {
      const { from, to } = getRangeTimestamps(range);
      const agents = await readAgents();

      // Get agent colors
      const agentsWithColors = agents.map((a, i) => ({
        id: a.id,
        name: a.name,
        color: getAgentColor(a.name, i),
      }));

      const now = Date.now();
      const sevenDaysAgo = now - SEVEN_DAYS_MS;

      // Convert query range to milliseconds
      const fromMs = from * ONE_SECOND_MS;
      const toMs = to * ONE_SECOND_MS;

      // Query ALL events for the full time range (incidents persist longer than checks)
      let allEvents: IncidentEvent[] = [];
      if (agentId !== undefined) {
        allEvents = getEventsForAgent(agentId, fromMs, toMs);
      } else {
        allEvents = getEventsForTimeRange(fromMs, toMs);
      }

      logger.debug(
        "incidentRPC",
        `Queried ${allEvents.length} events from ${new Date(fromMs).toISOString()} to ${new Date(toMs).toISOString()}`,
      );

      // Group events by incident and split by recent activity
      const eventsByIncident = groupEventsByIncident(allEvents);
      const { recentEvents, olderEvents } = splitIncidentsByActivity(
        eventsByIncident,
        sevenDaysAgo,
      );

      // Query checks for the last 7 days (retention period)
      // Use aggregated buckets for 7d+ views to reduce data transfer (118K -> ~168 rows)
      let recentChecks: Check[] = [];
      let checkBuckets: CheckBucket[] | undefined;
      const checkQueryStart = Math.max(fromMs, sevenDaysAgo);
      if (checkQueryStart <= toMs) {
        if (range === "24h") {
          // Small dataset: use raw checks for detailed tooltip display
          if (agentId !== undefined) {
            recentChecks = getRecentChecks(agentId, checkQueryStart, toMs);
          } else {
            recentChecks = getAllChecks(checkQueryStart, toMs);
          }
        } else {
          // Large dataset: use pre-aggregated buckets (7d, 30d, 90d views)
          checkBuckets = getChecksAggregatedByHour(checkQueryStart, toMs);
        }
      }

      // Query hourly stats for periods older than 7 days (for chart context)
      let olderStats: Array<AgentStatRow & { agentId: number }> = [];
      const statsQueryEnd = Math.min(
        to,
        Math.floor(sevenDaysAgo / ONE_SECOND_MS),
      );
      if (from < statsQueryEnd) {
        if (agentId !== undefined) {
          const stats = getAgentStats(agentId, from, statsQueryEnd);
          olderStats = stats.map((s) => ({ ...s, agentId }));
        } else {
          // Parallelize across agents for faster response
          const statsResults = await Promise.all(
            agents.map((agent) => getAgentStats(agent.id, from, statsQueryEnd)),
          );
          olderStats = statsResults.flatMap((stats, i) =>
            stats.map((s) => ({ ...s, agentId: agents[i].id })),
          );
        }
      }

      const result = {
        agentId,
        range,
        agents: agentsWithColors,
        recent7d: {
          events: recentEvents,
          checks: recentChecks,
          checkBuckets,
        },
        older: {
          events: olderEvents,
          stats: olderStats,
        },
      };

      const checkCount = checkBuckets?.length ?? recentChecks.length;
      logger.debug(
        "incidentRPC",
        `Returning timeline: ${recentEvents.length} recent events, ${olderEvents.length} older events, ${checkCount} checks/buckets`,
      );

      return result;
    } catch (error) {
      logger.error("incidentRPC", "Failed to get incident timeline:", error);
      throw error;
    }
  },

  getIncidentEvents: async ({
    agentId,
    from,
    to,
  }: {
    agentId?: number;
    from: number;
    to: number;
  }): Promise<IncidentEvent[]> => {
    try {
      if (agentId !== undefined) {
        return getEventsForAgent(agentId, from, to);
      } else {
        return getEventsForTimeRange(from, to);
      }
    } catch (error) {
      logger.error("incidentRPC", "Failed to get incident events:", error);
      throw error;
    }
  },

  getChecks: async ({
    agentId,
    since,
  }: {
    agentId?: number;
    since: number;
  }): Promise<Check[]> => {
    try {
      if (agentId !== undefined) {
        return getRecentChecks(agentId, since);
      } else {
        return getAllChecks(since);
      }
    } catch (error) {
      logger.error("incidentRPC", "Failed to get checks:", error);
      throw error;
    }
  },
};
