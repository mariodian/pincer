// Tray Manager - Handles system tray icon and menu for agent monitoring
import type { Status } from "$shared/types";
import { BrowserWindow, Tray, Utils } from "electrobun/bun";
import { sortAgentsByStatus } from "../shared/agent-helpers";
import {
  POPOVER_WINDOW,
  TRAY_ICON_LINUX_PATH,
  TRAY_ICON_PATH,
  TRAY_ICON_SIZE,
  TRAY_ICON_SIZE_WINDOWS,
} from "./config";
import { setAgentMutationCallback } from "./rpc/agentRPC";
import { setRefreshCallback, trayPopoverRPC } from "./rpc/trayPopoverRPC";
import { getMainWindow } from "./rpc/windowRegistry";
import { readAgents } from "./services/agentService";
import { logger } from "./services/loggerService";
import { refreshAndPush } from "./services/statusService";
import {
  getStatusSyncService,
  initStatusSyncService,
} from "./services/statusSyncService";
import { getAdvancedSettings } from "./storage/sqlite/advancedSettingsRepo";
import { getSettings } from "./storage/sqlite/settingsRepo";
import { applyMacOSWindowEffects } from "./utils/macOSWindowEffects";
import { showMainWindow } from "./utils/navigation";
import { isMacOS, isWindows } from "./utils/platform";
import { getViewUrl } from "./utils/url";
import { POPOVER_CONFIGS, readWindowConfig } from "./utils/windowConfig";
import type { PopoverWindowConfig } from "./utils/windowConfig";

// Re-export for backward compat with setRefreshCallback in this file
export { refreshAndPush };

const platformIsMacOS = isMacOS();
const platformIsWindows = isWindows();
const platformIsLinux = !platformIsMacOS && !platformIsWindows;

/** Get platform-specific popover window configuration */
function getPopoverWindowConfig(): PopoverWindowConfig {
  if (platformIsMacOS) {
    return POPOVER_CONFIGS.macos;
  }
  if (platformIsWindows) {
    return POPOVER_CONFIGS.windows;
  }
  return POPOVER_CONFIGS.linux;
}

/** Check if native menu should be used based on advanced settings.
 *  Note: Linux always uses native menu due to libayatana-appindicator limitations
 *  (tray icon click events are not supported).
 */
function useNativeMenu(): boolean {
  // Force native menu on Linux - tray click events don't work with libayatana-appindicator
  if (platformIsLinux) {
    return true;
  }
  return getAdvancedSettings().useNativeTray;
}

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
    action: "configure-agents",
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
    label: "Quit Pincer",
    action: "quit",
    enabled: true,
  },
];

let tray: Tray | null = null;
let popoverWindow: BrowserWindow | null = null;
const iconSize = platformIsWindows ? TRAY_ICON_SIZE_WINDOWS : TRAY_ICON_SIZE;
const iconPath = platformIsLinux ? TRAY_ICON_LINUX_PATH : TRAY_ICON_PATH;

// Cache the useNativeTray setting at startup - changes require restart
let useNativeTrayCached: boolean | null = null;

/**
 * Initialize the tray icon and set up event handlers
 */
export async function initializeTray() {
  // Cache the useNativeTray setting at startup - changes require restart
  useNativeTrayCached = useNativeMenu();

  logger.info(
    "tray",
    `Tray initializing with useNativeTray=${useNativeTrayCached}${platformIsLinux ? " (forced on Linux)" : ""}`,
  );

  // Create tray icon
  tray = new Tray({
    image: iconPath,
    template: true,
    width: iconSize,
    height: iconSize,
  });

  logger.info("tray", "Tray initialized");

  // Set up click handler
  tray.on("tray-clicked", async (event: unknown) => {
    logger.debug("tray", "Tray clicked event:", JSON.stringify(event));
    const action = (event as { data?: { action?: string } })?.data?.action;

    if (action === "") {
      // Use cached value - changing this setting requires restart
      if (useNativeTrayCached) {
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
        const popoverConfig = getPopoverWindowConfig();

        logger.debug(
          "tray",
          `Creating popover: bounds=${JSON.stringify(bounds)}, platform=${process.platform}, config=${JSON.stringify(popoverConfig)}`,
        );

        const wc: Record<string, unknown> = {
          title: "test",
          url: await getViewUrl("tray-popover.html"),
          rpc: trayPopoverRPC,
          titleBarStyle: popoverConfig.titleBarStyle,
          transparent: popoverConfig.transparent,
          trafficLights: popoverConfig.trafficLights,
          frame: {
            width: POPOVER_WINDOW.width,
            height: POPOVER_WINDOW.height,
            x: bounds.x,
            y: 0 + bounds.height,
          },
          // styleMask is macOS-only
          ...(popoverConfig.styleMask ? { styleMask: popoverConfig.styleMask } : {}),
        };

        popoverWindow = new BrowserWindow(wc);

        if (popoverConfig.applyMacOSEffects) {
          const windowConfig = await readWindowConfig("popover");
          applyMacOSWindowEffects("popover", popoverWindow, windowConfig);
        }
        getStatusSyncService().setPopoverWindow(popoverWindow);
        // Clear reference when closed
        popoverWindow.on("close", () => {
          popoverWindow = null;
          getStatusSyncService().setPopoverWindow(null);
        });

        // Close popover when it loses focus
        popoverWindow.on("blur", () => {
          if (popoverWindow) {
            logger.debug("tray", "Popover lost focus, closing");
            popoverWindow.close();
            popoverWindow = null;
          }
        });
      }
    } else if (
      action === "configure-agents" ||
      action === "dashboard" ||
      action === "settings"
    ) {
      const route = action === "configure-agents" ? "agents" : action;
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
        logger.error("tray", "Failed to refresh agent statuses:", error);
        tray?.setTitle(` - Error!`);
        setTimeout(() => tray?.setTitle(``), 2000);
      }
    } else if (action === "quit") {
      Utils.quit();
    } else if (action && action.startsWith("agent:")) {
      const agentId = action.substring(6);
      await showMainWindow(`agents/${agentId}`);
    }
  });

  // Initial menu update (uses cached value - restart required to change)
  if (useNativeTrayCached) {
    updateTrayMenu();
  }

  // Initialize the status sync service
  initStatusSyncService({
    getMainWindow,
    onMenuUpdate: () => {
      // Use cached value - restart required to change tray type
      if (useNativeTrayCached) updateTrayMenu();
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
    status: Status;
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
    const { showDisabledAgents } = getSettings();

    // Filter out disabled agents unless showDisabledAgents is true
    const filteredAgents = showDisabledAgents
      ? agents
      : agents.filter((agent) => agent.enabled !== false);

    const agentsWithStatus = filteredAgents.map((agent) => {
      const status = sync.getAgentStatus(agent.id);
      return {
        ...agent,
        status: (status?.status ?? "offline") as Status,
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
    logger.error("tray", "Failed to update tray menu:", error);

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
  // Use cached value - restart required to change tray type
  if (updateMenu && useNativeTrayCached) {
    updateTrayMenu();
  }
}

/**
 * Clean up tray resources
 */
export function cleanupTray() {
  logger.info("tray", "Cleaning up tray resources");
  if (tray) {
    tray.remove();
    tray = null;
  }
}
