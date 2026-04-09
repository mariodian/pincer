// Reports RPC - Per-agent uptime report generation
import { stringToOklch } from "../../shared/string-helpers";
import { readAgents } from "../services/agentService";
import { getAllAgentStats } from "../storage/sqlite/statsRepo";
import type {
  ReportRange,
  UptimeReport,
  AgentUptimeSummary,
} from "../../shared/reportTypes";
import { logger } from "../services/loggerService";
import { generateUptimeReportHTML } from "../services/reportExportService";

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

function getRangeTimestamps(range: ReportRange): { from: number; to: number } {
  const to = Math.floor(Date.now() / 1000);
  const seconds: Record<ReportRange, number> = {
    "7d": 7 * 24 * 3600,
    "30d": 30 * 24 * 3600,
    "90d": 90 * 24 * 3600,
  };
  return { from: to - seconds[range], to };
}

export type ReportsRPCType = {
  bun: {
    requests: {
      getUptimeReport: {
        params: { range: ReportRange };
        response: UptimeReport;
      };
      exportHtmlReport: {
        params: { range: ReportRange };
        response: string;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const reportsRequestHandlers = {
  getUptimeReport: async ({
    range,
  }: {
    range: ReportRange;
  }): Promise<UptimeReport> => {
    try {
      const { from, to } = getRangeTimestamps(range);
      const agents = await readAgents();
      const rawStats = getAllAgentStats(from, to);

      const agentSummaries: AgentUptimeSummary[] = agents.map((a, i) => {
        const agentStats = rawStats.filter((s) => s.agentId === a.id);
        const totalChecks = agentStats.reduce(
          (sum, s) => sum + s.totalChecks,
          0,
        );
        const okCount = agentStats.reduce((sum, s) => sum + s.okCount, 0);
        const offlineCount = agentStats.reduce(
          (sum, s) => sum + s.offlineCount,
          0,
        );
        const errorCount = agentStats.reduce((sum, s) => sum + s.errorCount, 0);
        const incidentCount = offlineCount + errorCount;

        // Weighted average: total ok / total checks * 100
        const uptimePct =
          totalChecks > 0
            ? Math.round((okCount * 10000) / totalChecks) / 100
            : 0;

        // Derive status for sorting: ok if uptime >= 95%, error if < 95% but has data, offline if no data
        const status: "ok" | "error" | "offline" =
          totalChecks === 0
            ? "offline"
            : uptimePct >= 95
              ? "ok"
              : "error";

        // Weighted average response time
        const avgResponseMs =
          totalChecks > 0
            ? Math.round(
                (agentStats.reduce(
                  (sum, s) => sum + s.avgResponseMs * s.totalChecks,
                  0,
                ) /
                  totalChecks) *
                  100,
              ) / 100
            : 0;

        return {
          agentId: a.id,
          agentName: a.name,
          enabled: a.enabled !== false,
          status,
          color:
            stringToOklch(a.name, {
              lightness: [0.6, 0.9],
              chroma: [0.12, 0.18],
            }) || CHART_COLORS[i % CHART_COLORS.length],
          uptimePct,
          totalChecks,
          okCount,
          offlineCount,
          incidentCount,
          avgResponseMs,
          hasData: totalChecks > 0,
        };
      });

      const agentsWithData = agentSummaries.filter((a) => a.hasData);
      const overallUptimePct =
        agentsWithData.length > 0
          ? Math.round(
              (agentsWithData.reduce((sum, a) => sum + a.uptimePct, 0) /
                agentsWithData.length) *
                100,
            ) / 100
          : null;

      const totalIncidents = agentSummaries.reduce(
        (sum, a) => sum + a.incidentCount,
        0,
      );

      return {
        range,
        periodStart: new Date(from * 1000),
        periodEnd: new Date(to * 1000),
        agents: agentSummaries,
        overallUptimePct,
        totalIncidents,
      };
    } catch (error) {
      logger.error("reportsRPC", "Failed to get uptime report:", error);
      throw error;
    }
  },

  exportHtmlReport: async ({
    range,
  }: {
    range: ReportRange;
  }): Promise<string> => {
    try {
      const report = await reportsRequestHandlers.getUptimeReport({ range });
      return generateUptimeReportHTML(report);
    } catch (error) {
      logger.error("reportsRPC", "Failed to export HTML report:", error);
      throw error;
    }
  },
};
