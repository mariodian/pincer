// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { checkAllAgentsStatus, readAgents } from "../agentService";
import { syncAgentData } from "../utils/storage";
import { getMainWindow } from "./windowRegistry";
import { getViewUrl } from "../utils/url";
import type { TrayPopoverRPCType } from "../../shared/rpc";

export const trayPopoverRPC = BrowserView.defineRPC<TrayPopoverRPCType>({
  handlers: {
    requests: {
      getAgents: async () => {
        return await checkAllAgentsStatus();
      },
      checkAllAgentsStatus: async () => {
        const statuses = await checkAllAgentsStatus();
        const agents = await readAgents();
        await syncAgentData(agents, statuses);
        return statuses;
      },
      openMainWindow: async ({ page }) => {
        const win = getMainWindow();
        if (win) {
          win.focus();
          let baseUrl = win.webview.url ?? (await getViewUrl("index.html"));
          // Strip existing hash so we don't accumulate them
          const hashIndex = baseUrl.indexOf("#");
          if (hashIndex !== -1) {
            baseUrl = baseUrl.slice(0, hashIndex);
          }
          win.webview.loadURL(`${baseUrl}#/${page}`);
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
