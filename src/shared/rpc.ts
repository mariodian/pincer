// Shared RPC types for tray popover and dashboard
import type { AgentStatus, Settings } from "./types";

/**
 * RPC request timeout in milliseconds.
 * Must accommodate health checks (5000ms) + processing buffer.
 */
export const RPC_MAX_REQUEST_TIME = 10000;

export type LogEntry = {
  level: "warn" | "error";
  component: string;
  message: string;
  timestamp: string;
};

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
  avgUptime: number | null;
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
      getSettings: {
        params: Record<string, never>;
        response: Settings;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      syncAgents: AgentStatus[];
    };
  };
};
