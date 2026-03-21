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
  getAgentTypeList,
} from "./../agentService";
import { AgentStatusInfo } from "../storage/types";

type AgentMutationCallback = () => void;
let onAgentMutation: AgentMutationCallback | null = null;

/** Register a callback fired after any agent add/update/delete. */
export function setAgentMutationCallback(cb: AgentMutationCallback) {
  onAgentMutation = cb;
}

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
    messages: {
      syncAgents: {
        params: AgentStatus[];
        response: void;
      };
    };
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
        const result = await addAgent({ type, name, url, port, enabled });
        if (onAgentMutation) onAgentMutation();
        return result;
      },
      updateAgent: async ([id, updates]: [number, Partial<Agent>]) => {
        const result = await updateAgent(id, updates);
        if (onAgentMutation) onAgentMutation();
        return result;
      },
      deleteAgent: async (id: number) => {
        const result = await deleteAgent(id);
        if (onAgentMutation) onAgentMutation();
        return result;
      },
      checkAllAgentsStatus: async () => {
        return await checkAllAgentsStatus();
      },
    },
    messages: {},
  },
});
