// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";

import type { TrayPopoverRPCType } from "../../shared/rpc";
import { readAgents } from "../services/agentService";
import { logger } from "../services/loggerService";
import { getSettings } from "../storage/sqlite/settingsRepo";
import { showMainWindow } from "../utils/navigation";
import { withErrorLogging } from "./rpcHelpers";

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
      getAgents: () =>
        withErrorLogging("trayPopoverRPC", () => getAgentsWithStatus()),
      checkAllAgentsStatus: () =>
        withErrorLogging("trayPopoverRPC", () => getAgentsWithStatus()),
      openMainWindow: async ({ page }) => {
        try {
          await showMainWindow(page);
          return true;
        } catch (error) {
          logger.error("trayPopoverRPC", "Failed to open main window:", error);
          throw error;
        }
      },
      quit: () => {
        try {
          Utils.quit();
          return true;
        } catch (error) {
          logger.error("trayPopoverRPC", "Failed to quit:", error);
          throw error;
        }
      },
      requestRefresh: async () => {
        try {
          if (onRefreshRequested) {
            onRefreshRequested();
          }
          return true;
        } catch (error) {
          logger.error("trayPopoverRPC", "Failed to request refresh:", error);
          throw error;
        }
      },
      getSettings: () =>
        withErrorLogging("trayPopoverRPC", async () => getSettings()),
    },
    messages: {},
  },
});
