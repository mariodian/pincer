import { Agent } from "../agentService";

export interface AgentStorage {
  readAgents(): Promise<Agent[]>;
  writeAgents(agents: Agent[]): Promise<void>;
}
