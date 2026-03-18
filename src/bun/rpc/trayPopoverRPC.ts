// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { Agent, AgentStatus, checkAllAgentsStatus, readAgents } from "../agentService";
import { getAgentsWithStatus } from "../utils/agents";
import { syncAgentData } from "../utils/storage";

let openConfigCallback: (() => void) | null = null;

export type TrayPopoverRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: (Agent & {
          status: string;
          lastChecked: number;
          errorMessage?: string;
        })[];
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

export function setOpenConfigCallback(callback: () => void) {
  openConfigCallback = callback;
}

export const trayPopoverRPC = BrowserView.defineRPC<TrayPopoverRPCType>({
  handlers: {
    requests: {
      getAgents: async () => {
        return await getAgentsWithStatus();
      },
      checkAllAgentsStatus: async () => {
        const statuses = await checkAllAgentsStatus();
        const agents = await readAgents();
        await syncAgentData(agents, statuses);
        return statuses;
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
