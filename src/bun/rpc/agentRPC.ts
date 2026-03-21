// Agent RPC - Shared RPC definition for agent management
import { BrowserView } from "electrobun/bun";
import { shouldTriggerHealthCheck } from "../../shared/agent-helpers";
import { AgentStatusInfo } from "../../shared/types";
import { STATUS_SHAPE_OPTIONS } from "../agentTypes";
import {
  pushOfflineStatusToWindows,
  pushOneStatusToWindows,
} from "../trayManager";
import {
  addAgent,
  Agent,
  AgentStatus,
  checkAllAgentsStatus,
  checkOneAgentStatus,
  deleteAgent,
  getAgentTypeList,
  readAgents,
  updateAgent,
} from "./../agentService";

type AgentMutationCallback = () => void;
let onAgentMutation: AgentMutationCallback | null = null;

export type AgentRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: Agent[];
      };
      getAgentTypes: {
        params: Record<string, never>;
        response: {
          id: string;
          name: string;
          statusShapeOptions: { value: string; label: string }[];
        }[];
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
      checkOneAgentStatus: {
        params: number;
        response: AgentStatusInfo | null;
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

/**
 * Register a callback fired after any agent add/update/delete.
 */
export function setAgentMutationCallback(cb: AgentMutationCallback) {
  onAgentMutation = cb;
}

export const agentRequestHandlers = {
  getAgents: async () => {
    return await readAgents();
  },
  getAgentTypes: async () => {
    const types = getAgentTypeList();
    return types.map((t) => ({
      ...t,
      statusShapeOptions: t.id === "custom" ? [...STATUS_SHAPE_OPTIONS] : [],
    }));
  },
  addAgent: async ({
    type,
    name,
    url,
    port,
    enabled,
    healthEndpoint,
    statusShape,
  }: Omit<Agent, "id">) => {
    const result = await addAgent({
      type,
      name,
      url,
      port,
      enabled,
      healthEndpoint,
      statusShape,
    });

    if (result.enabled === false) {
      await pushOfflineStatusToWindows(result.id);
    } else {
      const status = await checkOneAgentStatus(result.id);
      if (status) await pushOneStatusToWindows(status);
    }

    if (onAgentMutation) onAgentMutation();
    return result;
  },
  updateAgent: async ([id, updates]: [number, Partial<Agent>]) => {
    const result = await updateAgent(id, updates);

    if (result) {
      if (updates.enabled === false) {
        await pushOfflineStatusToWindows(id);
      } else if (
        updates.enabled === true ||
        shouldTriggerHealthCheck(updates)
      ) {
        const status = await checkOneAgentStatus(id);
        if (status) await pushOneStatusToWindows(status);
      }
    }

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
  checkOneAgentStatus: async (id: number) => {
    return await checkOneAgentStatus(id);
  },
};

export const agentRPC = BrowserView.defineRPC<AgentRPCType>({
  handlers: {
    requests: agentRequestHandlers,
    messages: {},
  },
});
