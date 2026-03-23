// Canonical type definitions shared between main process and renderer.
// Import from this file instead of re-declaring interfaces.

export interface Agent {
  id: number;
  type: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
  healthEndpoint?: string;
  statusShape?: string;
}

export interface AgentStatus extends Agent {
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}

export interface AgentStatusInfo {
  id: number;
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}

export interface Settings {
  pollingInterval: number;
  retentionDays: number;
  openMainWindow: boolean;
}
