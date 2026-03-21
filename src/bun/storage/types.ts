export interface AgentStatusInfo {
  id: number;
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}
