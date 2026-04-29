// Agent RPC - Shared RPC definition for agent management
import { AgentStatusInfo } from "../../shared/types";
import { STATUS_SHAPE_OPTIONS } from "../agentTypes";
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
} from "../services/agentService";
import { removeAgentState } from "../services/incidentService";
import { logger } from "../services/loggerService";
import { removeAgentStatusTracking } from "../services/statusService";
import {
  getStatusSyncService,
  removeAgentStatus,
} from "../services/statusSyncService";
import { shouldMarkOffline, shouldRunHealthCheck } from "./agentRPCHelpers";
import { withErrorLogging } from "./rpcHelpers";

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
          defaultPort: number;
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
      syncAgents: AgentStatus[];
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
  getAgents: () => withErrorLogging("agentRPC", () => readAgents()),
  getAgentTypes: () =>
    withErrorLogging("agentRPC", async () => {
      const types = getAgentTypeList();
      return types.map((t) => ({
        ...t,
        statusShapeOptions: t.id === "custom" ? [...STATUS_SHAPE_OPTIONS] : [],
      }));
    }),
  addAgent: async ({
    type,
    name,
    url,
    port,
    enabled,
    healthEndpoint,
    statusShape,
  }: Omit<Agent, "id">) => {
    try {
      const result = await addAgent({
        type,
        name,
        url,
        port,
        enabled,
        healthEndpoint,
        statusShape,
      });

      const sync = getStatusSyncService();
      if (result.enabled === false) {
        sync.markAgentOffline(result.id);
        await sync.sync();
      } else {
        const status = await checkOneAgentStatus(result.id);
        if (status) await sync.pushOneStatus(status);
      }

      if (onAgentMutation) onAgentMutation();
      return result;
    } catch (error) {
      logger.error("agentRPC", "Failed to add agent:", error);
      throw error;
    }
  },
  updateAgent: async ([id, updates]: [number, Partial<Agent>]) => {
    try {
      const result = await updateAgent(id, updates);

      if (result) {
        const sync = getStatusSyncService();
        if (shouldMarkOffline(updates)) {
          sync.markAgentOffline(id);
          await sync.sync();
        } else if (shouldRunHealthCheck(updates)) {
          const status = await checkOneAgentStatus(id);
          if (status) await sync.pushOneStatus(status);
        }
      }

      if (onAgentMutation) onAgentMutation();
      return result;
    } catch (error) {
      logger.error("agentRPC", "Failed to update agent:", error);
      throw error;
    }
  },
  deleteAgent: async (id: number) => {
    try {
      const result = await deleteAgent(id);

      // Clean up in-memory state to prevent memory leaks
      removeAgentState(id);
      removeAgentStatus(id);
      removeAgentStatusTracking(id);

      if (onAgentMutation) onAgentMutation();
      return result;
    } catch (error) {
      logger.error("agentRPC", "Failed to delete agent:", error);
      throw error;
    }
  },
  checkAllAgentsStatus: () =>
    withErrorLogging("agentRPC", () => checkAllAgentsStatus()),
  checkOneAgentStatus: (id: number) =>
    withErrorLogging("agentRPC", () => checkOneAgentStatus(id)),
};
