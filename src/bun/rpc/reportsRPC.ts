// Reports RPC - Per-agent uptime report generation
import { getAgentColor } from "../../shared/agent-helpers";
import type {
  AgentUptimeSummary,
  UptimeReport,
} from "../../shared/reportTypes";
import type { TimeRange } from "../../shared/types";
import { readAgents } from "../services/agentService";
import { generateUptimeReportHTML } from "../services/reportHtmlService";
import { getAllAgentStats } from "../storage/sqlite/statsRepo";
import { getRangeTimestamps } from "../utils/time-range";
import { withErrorLogging } from "./rpcHelpers";

export type ReportsRPCType = {
  bun: {
    requests: {
      getUptimeReport: {
        params: { range: TimeRange };
        response: UptimeReport;
      };
      exportHtmlReport: {
        params: { range: TimeRange };
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
  getUptimeReport: ({ range }: { range: TimeRange }): Promise<UptimeReport> =>
    withErrorLogging("reportsRPC", async () => {
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
          totalChecks === 0 ? "offline" : uptimePct >= 95 ? "ok" : "error";

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
          color: getAgentColor(a.name, i),
          uptimePct,
          totalChecks,
          okCount,
          offlineCount,
          incidentCount,
          avgResponseMs,
          hasData: totalChecks > 0,
        };
      });

      agentSummaries.sort(
        (a, b) =>
          b.uptimePct - a.uptimePct || a.agentName.localeCompare(b.agentName),
      );

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
    }),

  exportHtmlReport: ({ range }: { range: TimeRange }): Promise<string> =>
    withErrorLogging("reportsRPC", async () => {
      const report = await reportsRequestHandlers.getUptimeReport({ range });
      return generateUptimeReportHTML(report);
    }),
};
