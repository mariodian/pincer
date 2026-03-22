// Tray Manager - Handles system tray icon and menu for agent monitoring
import { BrowserWindow, Tray } from "electrobun/bun";
import { sortAgentsByStatus } from "../shared/agent-helpers";
import { AgentStatusInfo } from "../shared/types";
import { POPOVER_WINDOW, TRAY_ICON_PATH } from "./config";
import { setAgentMutationCallback } from "./rpc/agentRPC";
import { setRefreshCallback, trayPopoverRPC } from "./rpc/trayPopoverRPC";
import { getMainWindow } from "./rpc/windowRegistry";
import { readAgents } from "./services/agentService";
import { refreshAndPush } from "./services/statusService";
import {
  getStatusSyncService,
  initStatusSyncService,
} from "./services/statusSyncService";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";
import { showMainWindow } from "./utils/navigation";
import { isMacOS } from "./utils/platform";
import { getViewUrl } from "./utils/url";
import { readWindowConfig } from "./utils/windowConfig";

// Re-export for backward compat with setRefreshCallback in this file
export { refreshAndPush };

const platformIsMacOS = isMacOS();

// For now, only use native menu on non-macOS platforms since it supports icons and better styling.
// On macOS we will use a custom popover menu to have more control over appearance and behavior.
// @TODO: Evaluate if we can switch to custom menu on all platforms for consistency.
const NATIVE_MENU = !platformIsMacOS;
// const NATIVE_MENU = true;

/** Shared navigation/action menu items used in both normal and error-fallback menus. */
const NAV_MENU_ITEMS = [
  { type: "divider" as const },
  {
    type: "normal" as const,
    label: "Dashboard",
    action: "dashboard",
    enabled: true,
  },
  {
    type: "normal" as const,
    label: "Configure Agents",
    action: "configure",
    enabled: true,
  },
  {
    type: "normal" as const,
    label: "Settings",
    action: "settings",
    enabled: true,
  },
  { type: "divider" as const },
  {
    type: "normal" as const,
    label: "Quit CrabMonitor",
    action: "quit",
    enabled: true,
  },
];

let tray: Tray | null = null;
let popoverWindow: BrowserWindow | null = null;

/**
 * Initialize the tray icon and set up event handlers
 */
export async function initializeTray() {
  // Create tray icon
  tray = new Tray({
    image: TRAY_ICON_PATH,
    template: true,
    width: 32,
    height: 32,
  });

  // Set up click handler
  tray.on("tray-clicked", async (event: unknown) => {
    console.log("Tray clicked event:", JSON.stringify(event));
    const action = (event as { data?: { action?: string } })?.data?.action;

    if (action === "") {
      if (NATIVE_MENU) {
        // Show native menu
        updateTrayMenu();
      } else {
        // Show custom popover menu under tray icon
        // If popover already exists, close it
        if (popoverWindow) {
          popoverWindow.close();
          popoverWindow = null;
          return;
        }

        // @ts-ignore - getBounds may not be in types
        const bounds = tray.getBounds();
        const windowConfig = await readWindowConfig("popover");
        const wc: Record<string, unknown> = {
          title: "",
          url: await getViewUrl("tray-popover.html"),
          titleBarStyle: "hiddenInset",
          // trafficLights: false,
          rpc: trayPopoverRPC,
          // transparent: true,
          ...(platformIsMacOS
            ? {
                trafficLights: windowConfig.trafficLights,
                titleBarStyle: windowConfig.titleBarStyle,
                transparent: windowConfig.transparent,
                styleMask: {
                  Borderless: true,
                  Titled: false,
                  Closable: false,
                  Miniaturizable: false,
                  Resizable: false,
                },
              }
            : {}),
          // frame: false,
          frame: {
            width: POPOVER_WINDOW.width,
            height: POPOVER_WINDOW.height,
            x: bounds.x,
            y: 0 + bounds.height,
          },
        };

        popoverWindow = new BrowserWindow(wc);

        if (platformIsMacOS) {
          applyMacOSWindowEffects("popover", popoverWindow, windowConfig);
        }
        getStatusSyncService().setPopoverWindow(popoverWindow);
        // Clear reference when closed
        popoverWindow.on("close", () => {
          popoverWindow = null;
          getStatusSyncService().setPopoverWindow(null);
        });
      }
    } else if (
      action === "configure" ||
      action === "dashboard" ||
      action === "settings"
    ) {
      const route =
        action === "configure"
          ? "agents"
          : action === "dashboard"
            ? ""
            : action;
      await showMainWindow(route);
    } else if (action === "refresh") {
      // Refresh menu item clicked - show feedback in title
      tray?.setTitle(` - Refreshing...`);
      try {
        await refreshAndPush();
        updateTrayMenu();
        tray?.setTitle(` - Updated!`);
        setTimeout(() => tray?.setTitle(``), 2000);
      } catch (error) {
        console.error("Failed to refresh agent statuses:", error);
        tray?.setTitle(` - Error!`);
        setTimeout(() => tray?.setTitle(``), 2000);
      }
    } else if (action && action.startsWith("agent:")) {
      // Agent menu item clicked
      const agentId = action.substring(6); // Remove "agent:" prefix
      // Could open agent URL or show details
      console.log(`Agent clicked: ${agentId}`);
    }
  });

  // Initial menu update
  if (NATIVE_MENU) {
    updateTrayMenu();
  }

  // Initialize the status sync service
  initStatusSyncService({
    getMainWindow,
    onMenuUpdate: () => {
      if (NATIVE_MENU) updateTrayMenu();
    },
  });
  getStatusSyncService().setPopoverWindow(popoverWindow);

  // Register popover refresh callback
  setRefreshCallback(() => refreshAndPush());

  // Register mutation callback — push to all windows after add/edit/delete
  setAgentMutationCallback(() => syncAgentsFromKnownStatuses());
}

/**
 * Update the tray menu with current agent statuses
 */
type TrayMenuItem =
  | {
      type: "normal";
      label: string;
      tooltip?: string;
      action: string;
      enabled: boolean;
    }
  | {
      type: "divider";
      label?: never;
      tooltip?: never;
      action?: never;
      enabled?: never;
    };

/**
 * Build a menu item for a single agent with status indicator.
 */
function buildAgentMenuItem(
  agent: {
    id: number;
    name: string;
    url: string;
    port: number;
    status: string;
  },
  errorMessage?: string,
): TrayMenuItem {
  let label = agent.name;
  let tooltip = `${agent.name}: ${agent.url}:${agent.port}`;

  switch (agent.status) {
    case "ok":
      label = `● ${agent.name}`;
      tooltip += "\nStatus: Online";
      break;
    case "offline":
      label = `○ ${agent.name}`;
      tooltip += `\nStatus: Offline${errorMessage ? `\nError: ${errorMessage}` : ""}`;
      break;
    case "error":
      label = `✗ ${agent.name}`;
      tooltip += `\nStatus: Error${errorMessage ? `\nError: ${errorMessage}` : ""}`;
      break;
  }

  return {
    type: "normal" as const,
    label,
    tooltip,
    action: `agent:${agent.id}`,
    enabled: true,
  };
}

export async function updateTrayMenu() {
  if (!tray) return;

  try {
    const agents = await readAgents();
    const sync = getStatusSyncService();

    const agentsWithStatus = agents.map((agent) => {
      const status = sync.getAgentStatus(agent.id);
      return {
        ...agent,
        status: (status?.status ?? "offline") as "ok" | "offline" | "error",
      };
    });

    const sortedAgents = sortAgentsByStatus(agentsWithStatus);

    // Build menu items
    const menuItems: TrayMenuItem[] = sortedAgents.map((agent) =>
      buildAgentMenuItem(agent, sync.getAgentStatus(agent.id)?.errorMessage),
    );

    // Add separator if we have agents
    if (agents.length > 0) {
      menuItems.push({ type: "divider" as const });
    }

    // Add Refresh menu item
    menuItems.push({
      type: "normal" as const,
      label: "Refresh Status",
      tooltip: "Refresh all agent statuses",
      action: "refresh",
      enabled: true,
    });

    menuItems.push(...NAV_MENU_ITEMS);

    // Set the menu
    tray.setMenu(menuItems);
  } catch (error) {
    console.error("Failed to update tray menu:", error);

    // Show error menu
    if (tray) {
      tray.setMenu([
        {
          type: "normal" as const,
          label: "Error loading agents",
          enabled: false,
        },
        ...NAV_MENU_ITEMS,
      ]);
    }
  }
}

/**
 * Push current known statuses to all windows and optionally update menu.
 * @deprecated Use StatusSyncService.sync() directly for more control
 */
export async function syncAgentsFromKnownStatuses(updateMenu = true) {
  const sync = getStatusSyncService();
  await sync.pushKnownStatuses();
  if (updateMenu && NATIVE_MENU) {
    updateTrayMenu();
  }
}

/**
 * Push a single agent's status to all windows immediately (bypasses polling).
 * Used after toggling enabled state so the UI dot updates without waiting.
 * @deprecated Use StatusSyncService.pushOneStatus() directly
 */
export async function pushOneStatusToWindows(
  status: AgentStatusInfo,
): Promise<void> {
  const sync = getStatusSyncService();
  await sync.pushOneStatus(status);
}

/**
 * Mark an agent as offline immediately without making an HTTP request.
 * Used when an agent is disabled so the UI dot turns gray right away.
 * @deprecated Use StatusSyncService.markOffline() + sync() directly
 */
export async function pushOfflineStatusToWindows(id: number): Promise<void> {
  const sync = getStatusSyncService();
  sync.markAgentOffline(id);
  await sync.sync({ updateMenu: NATIVE_MENU });
}

/**
 * Clean up tray resources
 */
export function cleanupTray() {
  if (tray) {
    tray.remove();
    tray = null;
  }
}
