// Agent RPC - Shared RPC definition for agent management
import { BrowserView } from "electrobun/bun";
import {
  addAgent,
  Agent,
  checkAllAgentsStatus,
  deleteAgent,
  readAgents,
  updateAgent,
  getAgentTypeList,
} from "./../agentService";
import { AgentStatusInfo } from "../storage/types";

export type AgentRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: Agent[];
      };
      getAgentTypes: {
        params: Record<string, never>;
        response: { id: string; name: string }[];
      };
      addAgent: {
        params: Omit<Agent, "id">;
        response: Agent;
      };
      updateAgent: {
        params: [number, Partial<Agent>];
        response: Agent | null;
      };
      deleteAgent: {
        params: number;
        response: boolean;
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: AgentStatusInfo[];
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
      getAgentTypes: async () => {
        return getAgentTypeList();
      },
      addAgent: async ({ type, name, url, port, enabled }: Omit<Agent, "id">) => {
        return await addAgent({ type, name, url, port, enabled });
      },
      updateAgent: async ([id, updates]: [number, Partial<Agent>]) => {
        return await updateAgent(id, updates);
      },
      deleteAgent: async (id: number) => {
        return await deleteAgent(id);
      },
      checkAllAgentsStatus: async () => {
        return await checkAllAgentsStatus();
      },
    },
    messages: {},
  },
});
