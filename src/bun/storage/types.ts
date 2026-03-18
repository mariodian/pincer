export interface AgentStatusInfo {
  id: string;
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}
