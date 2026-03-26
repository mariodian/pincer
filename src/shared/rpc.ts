// Shared RPC types for tray popover and dashboard
import type { AgentStatus } from "./types";

export type LogEntry = {
  level: "warn" | "error";
  component: string;
  message: string;
  timestamp: string;
};

export type TimeRange = "24h" | "7d" | "30d";

export interface AgentWithColor {
  id: number;
  name: string;
  color: string;
  enabled: boolean;
}

export interface TimeSeriesPoint {
  hourTimestamp: number;
  agentId: number;
  uptimePct: number;
  avgResponseMs: number;
  okCount: number;
  offlineCount: number;
  errorCount: number;
}

export interface DashboardKpis {
  avgUptime: number;
  totalAgents: number;
  activeAgents: number;
  incidentCount: number;
  avgResponseMs: number;
}

export interface DashboardStats {
  timeRange: { from: number; to: number };
  agents: AgentWithColor[];
  timeSeries: TimeSeriesPoint[];
  kpis: DashboardKpis;
}

export type TrayPopoverRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: AgentStatus[];
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: AgentStatus[];
      };
      requestRefresh: {
        params: Record<string, never>;
        response: boolean;
      };
      openMainWindow: {
        params: { page: string };
        response: boolean;
      };
      quit: {
        params: Record<string, never>;
        response: boolean;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      syncAgents: {
        params: AgentStatus[];
        response: void;
      };
    };
  };
};
