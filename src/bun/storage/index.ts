import { AgentStorage } from "./backend";
import { readAgents, writeAgents, insertAgent } from "./sqlite/agentsRepo";

export type { AgentStorage } from "./backend";

export const agentStorage: AgentStorage = {
  readAgents: () => Promise.resolve(readAgents()),
  writeAgents: (agents) => {
    writeAgents(agents);
    return Promise.resolve();
  },
  insertAgent: (agent) => Promise.resolve(insertAgent(agent)),
};
