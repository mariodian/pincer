// Tray Popover RPC - Handlers for tray popover IPC
import { BrowserView, Utils } from "electrobun/bun";
import { readAgents } from "../services/agentService";
import { getSettings } from "../storage/sqlite/settingsRepo";
import { showMainWindow } from "../utils/navigation";
import type { TrayPopoverRPCType } from "../../shared/rpc";
import { logger } from "../services/loggerService";

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
      getAgents: async () => {
        try {
          return await getAgentsWithStatus();
        } catch (error) {
          logger.error("trayPopoverRPC", "Failed to get agents:", error);
          throw error;
        }
      },
      checkAllAgentsStatus: async () => {
        try {
          return await getAgentsWithStatus();
        } catch (error) {
          logger.error(
            "trayPopoverRPC",
            "Failed to check all agents status:",
            error,
          );
          throw error;
        }
      },
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
      getSettings: async () => {
        try {
          return getSettings();
        } catch (error) {
          logger.error("trayPopoverRPC", "Failed to get settings:", error);
          throw error;
        }
      },
    },
    messages: {},
  },
});
