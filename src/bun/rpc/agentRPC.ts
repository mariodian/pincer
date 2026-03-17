// Agent RPC - Shared RPC definition for agent management
import { BrowserView } from "electrobun/bun";
import {
  addAgent,
  Agent,
  AgentStatus,
  checkAllAgentsStatus,
  deleteAgent,
  readAgents,
  updateAgent,
} from "./../agentsService";

export type AgentRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: Agent[];
      };
      addAgent: {
        params: Omit<Agent, "id">;
        response: Agent;
      };
      updateAgent: {
        params: [string, Partial<Agent>];
        response: Agent | null;
      };
      deleteAgent: {
        params: string;
        response: boolean;
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: AgentStatus[];
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const agentRPC = BrowserView.defineRPC<AgentRPCType>({
  handlers: {
    requests: {
      getAgents: async () => {
        return await readAgents();
      },
      addAgent: async ({ name, url, port, enabled }: Omit<Agent, "id">) => {
        return await addAgent({ name, url, port, enabled });
      },
      updateAgent: async ([id, updates]: [string, Partial<Agent>]) => {
        return await updateAgent(id, updates);
      },
      deleteAgent: async (id: string) => {
        return await deleteAgent(id);
      },
      checkAllAgentsStatus: async () => {
        return await checkAllAgentsStatus();
      },
    },
    messages: {},
  },
});
