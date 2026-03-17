// Shared types for RPC communication
export interface Agent {
  id: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
}

export interface AgentStatus extends Agent {
  status: "online" | "offline" | "error" | "warning";
  lastChecked: number;
  errorMessage?: string;
}

export type RPCSchema<T> = T;
