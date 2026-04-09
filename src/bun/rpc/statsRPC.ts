// Stats RPC - Shared RPC definition for dashboard statistics
import type { TimeRange } from "$shared/types";
import { getAgentColor } from "../../shared/agent-helpers";
import type {
  AgentWithColor,
  DashboardKpis,
  DashboardStats,
  TimeSeriesPoint,
} from "../../shared/rpc";
import { readAgents } from "../services/agentService";
import { logger } from "../services/loggerService";
import { getAllAgentStats } from "../storage/sqlite/statsRepo";
import { getRangeTimestamps } from "../utils/time-range";

export type StatsRPCType = {
  bun: {
    requests: {
      getDashboardStats: {
        params: { range: TimeRange };
        response: DashboardStats;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const statsRequestHandlers = {
  getDashboardStats: async ({
    range,
  }: {
    range: TimeRange;
  }): Promise<DashboardStats> => {
    try {
      const { from, to } = getRangeTimestamps(range);
      const agents = await readAgents();
      const rawStats = getAllAgentStats(from, to);

      // Assign colors to agents (consistent based on name)
      // Fallback to predefined colors if stringToOklch fails for any reason (e.g. invalid name)
      const agentColors: AgentWithColor[] = agents.map((a, i) => ({
        id: a.id,
        name: a.name,
        enabled: a.enabled !== false,
        color: getAgentColor(a.name, i),
      }));

      // Map raw stats to shared type
      const timeSeries: TimeSeriesPoint[] = rawStats.map((row) => ({
        hourTimestamp: row.hourTimestamp,
        agentId: row.agentId,
        uptimePct: row.uptimePct,
        avgResponseMs: row.avgResponseMs,
        okCount: row.okCount,
        offlineCount: row.offlineCount,
        errorCount: row.errorCount,
      }));

      // Compute KPIs from enabled agents only
      const enabledAgents = agents.filter((a) => a.enabled !== false);
      const enabledAgentIds = new Set(enabledAgents.map((a) => a.id));

      let totalUptime = 0;
      let totalResponseMs = 0;
      let totalIncidents = 0;
      let statRowCount = 0;

      for (const row of timeSeries) {
        if (!enabledAgentIds.has(row.agentId)) continue;
        totalUptime += row.uptimePct;
        totalResponseMs += row.avgResponseMs;
        totalIncidents += row.offlineCount + row.errorCount;
        statRowCount++;
      }

      const kpis: DashboardKpis = {
        avgUptime:
          statRowCount > 0
            ? Math.round((totalUptime / statRowCount) * 100) / 100
            : null,
        totalAgents: agents.length,
        activeAgents: enabledAgents.length,
        incidentCount: totalIncidents,
        avgResponseMs:
          statRowCount > 0
            ? Math.round((totalResponseMs / statRowCount) * 100) / 100
            : 0,
      };

      return {
        timeRange: { from, to },
        agents: agentColors,
        timeSeries,
        kpis,
      };
    } catch (error) {
      logger.error("statsRPC", "Failed to get dashboard stats:", error);
      throw error;
    }
  },
};
