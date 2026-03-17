// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { Agent, AgentStatus } from "../agentService";
import { checkAllAgentsStatus } from "../agentService";
import { getAgentsWithStatus } from "../utils/agents";

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
