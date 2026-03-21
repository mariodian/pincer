import { SqliteAgentStorage } from "./sqlite/sqlStorage";
import { AgentStorage } from "./backend";

export type { AgentStorage } from "./backend";
export { SqliteAgentStorage } from "./sqlite/sqlStorage";

export function createAgentStorage(): AgentStorage {
  return new SqliteAgentStorage();
}

export const agentStorage: AgentStorage = new SqliteAgentStorage();
