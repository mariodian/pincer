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
} from "./agentsService";
import {
  readWindowConfig,
  updateWindowConfig,
  WindowConfig,
  WindowName,
} from "./windowService";

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
      getWindowConfig: {
        params: { windowName: WindowName };
        response: WindowConfig;
      };
      updateWindowConfig: {
        params: { windowName: WindowName; updates: Partial<WindowConfig> };
        response: WindowConfig;
      };
      openConfig: {
        params: Record<string, never>;
        response: boolean;
      };
      quit: {
        params: Record<string, never>;
        response: boolean;
      };
      getPlatform: {
        params: Record<string, never>;
        response: { os: "macos" | "win" | "linux" };
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
      getWindowConfig: async ({ windowName }: { windowName: WindowName }) => {
        return await readWindowConfig(windowName);
      },
      updateWindowConfig: async ({
        windowName,
        updates,
      }: {
        windowName: WindowName;
        updates: Partial<WindowConfig>;
      }) => {
        return await updateWindowConfig(windowName, updates);
      },
      getPlatform: async () => {
        const p = process.platform;
        console.log("Detected platform:", p);
        const os = p === "darwin" ? "macos" : p === "win32" ? "win" : "linux";
        return { os };
      },
    },
    messages: {},
  },
});
