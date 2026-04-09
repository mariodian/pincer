// Report types for per-agent uptime summaries

export type ReportRange = "7d" | "30d" | "90d";

export interface AgentUptimeSummary {
  agentId: number;
  agentName: string;
  color: string;
  enabled: boolean;
  /** Derived status for sorting (ok if uptimePct > 50, error if > 0, offline otherwise) */
  status: "ok" | "error" | "offline";
  /** Overall uptime percentage for the period (0-100) */
  uptimePct: number;
  /** Total number of checks in the period */
  totalChecks: number;
  /** Number of successful checks */
  okCount: number;
  /** Number of offline checks */
  offlineCount: number;
  /** Number of error checks */
  incidentCount: number;
  /** Average response time in ms */
  avgResponseMs: number;
  /** Whether the agent had any data in this period */
  hasData: boolean;
}

export interface UptimeReport {
  range: ReportRange;
  periodStart: Date;
  periodEnd: Date;
  agents: AgentUptimeSummary[];
  /** Overall average uptime across all agents with data */
  overallUptimePct: number | null;
  totalIncidents: number;
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
        response: string; // HTML string
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};
