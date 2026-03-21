// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { readAgents } from "../agentService";
import { getMainWindow } from "./windowRegistry";
import { getViewUrl, stripHash } from "../utils/url";
import type { TrayPopoverRPCType } from "../../shared/rpc";

type RefreshCallback = () => void;
let onRefreshRequested: RefreshCallback | null = null;

/** Register a callback for when the popover requests a refresh. */
export function setRefreshCallback(cb: RefreshCallback) {
  onRefreshRequested = cb;
}

/** Fetch all agents without triggering live status checks.
 *  Status data is pushed to the popover via syncAgents from trayManager. */
async function getAgentsWithStatus() {
  const agents = await readAgents();
  return agents.map((agent) => ({
    ...agent,
    status: "offline" as const,
    lastChecked: 0,
    errorMessage: undefined,
  }));
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
      requestRefresh: async () => {
        if (onRefreshRequested) {
          onRefreshRequested();
        }
        return true;
      },
    },
    messages: {},
  },
});
