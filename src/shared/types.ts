// Canonical type definitions shared between main process and renderer.
// Import from this file instead of re-declaring interfaces.

export type Status = "ok" | "error" | "offline";

// Extended status including "degraded" for checks
export type CheckStatus = "ok" | "offline" | "error" | "degraded";

// Incident event types
export type EventType = "opened" | "status_changed" | "recovered";

// Raw health check from the checks table
export interface Check {
  id: number;
  agentId: number;
  checkedAt: number; // ms timestamp
  status: CheckStatus;
  responseMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

// Incident event from the incident_events table
export interface IncidentEvent {
  id: number;
  agentId: number;
  incidentId: string;
  eventAt: number; // ms timestamp
  eventType: EventType;
  fromStatus: CheckStatus | null;
  toStatus: CheckStatus | null;
  reason: string | null;
}

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
  status: Status;
  lastChecked: number;
  errorMessage?: string;
  internalNetworkWarning?: boolean;
}

export interface AgentStatusInfo {
  id: number;
  status: Status;
  lastChecked: number;
  errorMessage?: string;
  internalNetworkWarning?: boolean;
}

export interface Settings {
  retentionDays: number;
  openMainWindow: boolean;
  showDisabledAgents: boolean;
  launchAtLogin: boolean;
}

export interface AdvancedSettings {
  pollingInterval: number;
  useNativeTray: boolean;
  autoCheckUpdate: boolean;
}

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notifyOnStatusChange: boolean;
  notifyOnError: boolean;
  statusChangeThreshold: number;
  silentNotifications: boolean;
}

export type TimeRange = "24h" | "7d" | "30d" | "90d";
