export interface AgentStatusInfo {
  id: string;
  status: "ok" | "offline" | "error" | "warning";
  lastChecked: number;
  errorMessage?: string;
}
