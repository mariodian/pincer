// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { checkAllAgentsStatus, readAgents } from "../agentService";
import { syncAgentData } from "../utils/storage";
import { getMainWindow } from "./windowRegistry";
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
          // Use executeJavascript to set hash directly — bypasses RPC socket chain
          const escaped = `/${page}`.replace(/'/g, "\\'");
          win.webview.executeJavascript(`window.location.hash = '${escaped}'`);
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
