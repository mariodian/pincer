// Incident RPC - Shared RPC definition for incident timeline and events
import type { Check, IncidentEvent, TimeRange } from "$shared/types";
import type { AgentStatRow } from "../storage/sqlite/statsRepo";
import { getAgentStats } from "../storage/sqlite/statsRepo";
import { getRecentChecks, getAllChecks } from "../storage/sqlite/checksRepo";
import {
  getEventsForAgent,
  getEventsForTimeRange,
} from "../storage/sqlite/incidentEventsRepo";
import { readAgents } from "../services/agentService";
import { logger } from "../services/loggerService";
import { getRangeTimestamps } from "../utils/time-range";
import { getAgentColor } from "../../shared/agent-helpers";

export interface IncidentTimeline {
  agentId?: number;
  range: TimeRange;
  agents: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  // Incidents with ANY activity in the last 7 days + their raw checks
  recent7d: {
    events: IncidentEvent[];
    checks: Check[];
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

// 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      const fromMs = from * 1000;
      const toMs = to * 1000;

      // Query ALL events for the full time range (incidents persist longer than checks)
      let allEvents: IncidentEvent[] = [];
      if (agentId !== undefined) {
        allEvents = getEventsForAgent(agentId, fromMs, toMs);
      } else {
        allEvents = getEventsForTimeRange(fromMs, toMs);
      }

      // Group events by incidentId
      const eventsByIncident = new Map<string, IncidentEvent[]>();
      for (const event of allEvents) {
        const existing = eventsByIncident.get(event.incidentId) || [];
        existing.push(event);
        eventsByIncident.set(event.incidentId, existing);
      }

      // Split incidents based on whether they have ANY activity in the last 7 days
      const recentIncidentIds = new Set<string>();
      const olderIncidentIds = new Set<string>();

      for (const [incidentId, events] of eventsByIncident) {
        const hasRecentActivity = events.some((e) => e.eventAt >= sevenDaysAgo);
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

      // Query raw checks only for the last 7 days (retention period)
      let recentChecks: Check[] = [];
      const checkQueryStart = Math.max(fromMs, sevenDaysAgo);
      if (checkQueryStart <= toMs) {
        if (agentId !== undefined) {
          recentChecks = getRecentChecks(agentId, checkQueryStart, toMs);
        } else {
          recentChecks = getAllChecks(checkQueryStart, toMs);
        }
      }

      // Query hourly stats for periods older than 7 days (for chart context)
      let olderStats: Array<AgentStatRow & { agentId: number }> = [];
      const statsQueryEnd = Math.min(to, Math.floor(sevenDaysAgo / 1000));
      if (from < statsQueryEnd) {
        if (agentId !== undefined) {
          const stats = getAgentStats(agentId, from, statsQueryEnd);
          olderStats = stats.map((s) => ({ ...s, agentId }));
        } else {
          for (const agent of agents) {
            const stats = getAgentStats(agent.id, from, statsQueryEnd);
            olderStats.push(
              ...stats.map((s) => ({
                ...s,
                agentId: agent.id,
              })),
            );
          }
        }
      }

      return {
        agentId,
        range,
        agents: agentsWithColors,
        recent7d: {
          events: recentEvents,
          checks: recentChecks,
        },
        older: {
          events: olderEvents,
          stats: olderStats,
        },
      };
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
