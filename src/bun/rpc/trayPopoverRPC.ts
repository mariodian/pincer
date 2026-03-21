// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { checkAllAgentsStatus, readAgents } from "../agentService";
import { getMainWindow } from "./windowRegistry";
import { getViewUrl, stripHash } from "../utils/url";
import type { TrayPopoverRPCType } from "../../shared/rpc";

/** Fetch all agents enriched with their latest status. */
async function getAgentsWithStatus() {
  const statuses = await checkAllAgentsStatus();
  const agents = await readAgents();
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  return agents.map((agent) => {
    const status = statusMap.get(agent.id);
    return {
      ...agent,
      status: status?.status ?? "offline",
      lastChecked: status?.lastChecked ?? 0,
      errorMessage: status?.errorMessage,
    };
  });
}

export const trayPopoverRPC = BrowserView.defineRPC<TrayPopoverRPCType>({
  handlers: {
    requests: {
      getAgents: getAgentsWithStatus,
      checkAllAgentsStatus: getAgentsWithStatus,
      openMainWindow: async ({ page }) => {
        const win = getMainWindow();
        if (win) {
          win.focus();
          const baseUrl = stripHash(
            win.webview.url ?? (await getViewUrl("index.html")),
          );
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
