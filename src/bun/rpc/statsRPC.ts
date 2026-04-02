// Stats RPC - Shared RPC definition for dashboard statistics
import type {
  AgentWithColor,
  DashboardKpis,
  DashboardStats,
  TimeRange,
  TimeSeriesPoint,
} from "../../shared/rpc";
import { stringToOklch } from "../../shared/string-helpers";
import { readAgents } from "../services/agentService";
import { getAllAgentStats } from "../storage/sqlite/statsRepo";
import { logger } from "../services/loggerService";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

function getRangeTimestamps(range: TimeRange): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  const seconds: Record<TimeRange, number> = {
    "24h": 24 * 3600,
    "7d": 7 * 24 * 3600,
    "30d": 30 * 24 * 3600,
  };
  return { from: to - seconds[range], to };
}

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
        color:
          stringToOklch(a.name, {
            lightness: [0.6, 0.9],
            chroma: [0.12, 0.18],
          }) || CHART_COLORS[i % CHART_COLORS.length],
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
