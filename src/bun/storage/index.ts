import { SqliteAgentStorage } from "./sqlite/sqlStorage";
import { AgentStorage } from "./backend";

export type { AgentStorage } from "./backend";
export { SqliteAgentStorage } from "./sqlite/sqlStorage";

export const agentStorage: AgentStorage = new SqliteAgentStorage();
