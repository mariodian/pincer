// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { readAgents, checkAllAgentsStatus, Agent, AgentStatus } from "./agentsService";

export type TrayPopoverRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: (Agent & { status: string; lastChecked: number; errorMessage?: string })[];
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: AgentStatus[];
      };
      openConfig: {
        params: Record<string, never>;
        response: boolean;
      };
      quit: {
        params: Record<string, never>;
        response: boolean;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

let openConfigCallback: (() => void) | null = null;

export function setOpenConfigCallback(callback: () => void) {
  openConfigCallback = callback;
}

export const trayPopoverRPC = BrowserView.defineRPC<TrayPopoverRPCType>({
  handlers: {
    requests: {
      getAgents: async () => {
        const agents = await readAgents();
        const statuses = await checkAllAgentsStatus();
        const statusMap = new Map(statuses.map((s) => [s.id, s]));
        return agents.map((agent) => ({
          ...agent,
          status: statusMap.get(agent.id)?.status || "offline",
          lastChecked: statusMap.get(agent.id)?.lastChecked || 0,
          errorMessage: statusMap.get(agent.id)?.errorMessage,
        }));
      },
      checkAllAgentsStatus: async () => {
        return await checkAllAgentsStatus();
      },
      openConfig: () => {
        if (openConfigCallback) {
          openConfigCallback();
        }
        return true;
      },
      quit: () => {
        Utils.quit();
        return true;
      },
    },
    messages: {},
  },
});
