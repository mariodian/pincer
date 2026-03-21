import type { Agent } from "../../shared/types";

export interface AgentStorage {
  readAgents(): Promise<Agent[]>;
  writeAgents(agents: Agent[]): Promise<void>;
}
