import { JsonAgentStorage } from "./jsonStorage";
import { AgentStorage } from "./backend";

export type { AgentStorage } from "./backend";
export { JsonAgentStorage } from "./jsonStorage";

export function createAgentStorage(): AgentStorage {
  return new JsonAgentStorage();
}

export const agentStorage: AgentStorage = new JsonAgentStorage();
