// Shared types for RPC communication
export interface Agent {
  id: string;
  type: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
}

export interface AgentStatus extends Agent {
  status: "online" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}

export type RPCSchema<T> = T;
