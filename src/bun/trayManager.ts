// Tray Manager - Handles system tray icon and menu for agent monitoring
import { BrowserWindow, Tray } from "electrobun/bun";
import { checkAllAgentsStatus, readAgents, readConfig } from "./agentService";
import { POPOVER_WINDOW, TRAY_ICON_PATH } from "./config";
import { trayPopoverRPC } from "./rpc/trayPopoverRPC";
import { getMainWindow } from "./rpc/windowRegistry";
import { AgentStatusInfo } from "./storage/types";
import { isMacOS } from "./utils/platform";
import { getViewUrl, stripHash } from "./utils/url";
import { applyMacOSWindowEffects, readWindowConfig } from "./windowService";

const platformIsMacOS = isMacOS();

// For now, only use native menu on non-macOS platforms since it supports icons and better styling.
// On macOS we will use a custom popover menu to have more control over appearance and behavior.
// @TODO: Evaluate if we can switch to custom menu on all platforms for consistency.
const NATIVE_MENU = !platformIsMacOS;
// const NATIVE_MENU = true;

/** Shared navigation/action menu items used in both normal and error-fallback menus. */
const NAV_MENU_ITEMS = [
  { type: "divider" as const },
  { type: "normal" as const, label: "Dashboard", action: "dashboard", enabled: true },
  { type: "normal" as const, label: "Configure Agents", action: "configure", enabled: true },
  { type: "normal" as const, label: "Settings", action: "settings", enabled: true },
  { type: "divider" as const },
  { type: "normal" as const, label: "Quit CrabMonitor", action: "quit", enabled: true },
];

let tray: Tray | null = null;
let popoverWindow: BrowserWindow | null = null;
let agentStatusMap: Map<number, AgentStatusInfo> = new Map();
let statusUpdateInterval: NodeJS.Timeout | null = null;

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
        // Clear reference when closed
        popoverWindow.on("close", () => {
          popoverWindow = null;
        });
      }
    } else if (
      action === "configure" ||
      action === "dashboard" ||
      action === "settings"
    ) {
      // Navigate to a page in the main window
      const route =
        action === "configure"
          ? "agents"
          : action === "dashboard"
            ? ""
            : action;
      const win = getMainWindow();
      if (win) {
        win.focus();
        const baseUrl = stripHash(
          win.webview.url ?? (await getViewUrl("index.html")),
        );
        win.webview.loadURL(`${baseUrl}#/${route}`);
      }
    } else if (action === "refresh") {
      // Refresh menu item clicked - show feedback in title
      tray?.setTitle(` - Refreshing...`);
      try {
        const statuses = await checkAllAgentsStatus();
        statuses.forEach((status) => {
          agentStatusMap.set(status.id, status);
        });
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

  // Start periodic status updates
  startStatusUpdates();
}

/**
 * Update the tray menu with current agent statuses
 */
export async function updateTrayMenu() {
  if (!tray) return;

  try {
    const agents = await readAgents();

    const sortedAgents = [...agents].sort((a, b) => {
      const statusOrder = (id: number) => {
        const s = agentStatusMap.get(id)?.status;
        if (s === "ok") return 0;
        if (s === "offline") return 2;
        return 1;
      };
      const orderDiff = statusOrder(a.id) - statusOrder(b.id);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });

    const menuItems = [];

    // Add agent items
    for (const agent of sortedAgents) {
      const status = agentStatusMap.get(agent.id) || {
        status: "offline" as const,
        lastChecked: 0,
        errorMessage: undefined,
      };

      let label = agent.name;
      let tooltip = `${agent.name}: ${agent.url}:${agent.port}`;

      // Add status indicator
      switch (status.status) {
        case "ok":
          label = `● ${agent.name}`;
          tooltip += "\nStatus: Online";
          break;
        case "offline":
          label = `○ ${agent.name}`;
          tooltip += `\nStatus: Offline${status.errorMessage ? `\nError: ${status.errorMessage}` : ""}`;
          break;
        case "error":
          label = `✗ ${agent.name}`;
          tooltip += `\nStatus: Error${status.errorMessage ? `\nError: ${status.errorMessage}` : ""}`;
          break;
      }

      menuItems.push({
        type: "normal" as const,
        label,
        tooltip,
        action: `agent:${agent.id}`,
        enabled: true,
      });
    }

    // Add separator if we have agents
    if (agents.length > 0) {
      menuItems.push({
        type: "divider" as const,
      });
    }

    // Add Refresh menu item
    menuItems.push({
      type: "normal" as const,
      label: "Refresh Status",
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
 * Push merged agent+status data to the popover's localStorage via RPC.
 * No-op if the popover window doesn't exist yet.
 */
async function pushAgentsToPopover() {
  if (!popoverWindow?.webview.rpc) return;
  try {
    const statuses = await checkAllAgentsStatus();
    const agents = await readAgents();
    const statusMap = new Map(statuses.map((s) => [s.id, s]));
    const merged = agents.map((agent) => ({
      ...agent,
      status: statusMap.get(agent.id)?.status ?? "offline",
      lastChecked: statusMap.get(agent.id)?.lastChecked ?? 0,
      errorMessage: statusMap.get(agent.id)?.errorMessage,
    }));
    (popoverWindow.webview.rpc as any).syncAgents(merged);
  } catch (error) {
    console.warn("Failed to push agents to popover:", error);
  }
}

/**
 * Start periodic status updates for all agents
 */
async function startStatusUpdates() {
  // Clear any existing interval
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }

  // Read config for polling interval
  const config = await readConfig();
  const interval = config.pollingInterval || 30000;

  // Update status immediately
  try {
    const statuses = await checkAllAgentsStatus();
    statuses.forEach((status) => {
      agentStatusMap.set(status.id, status);
    });
    await pushAgentsToPopover();
    if (NATIVE_MENU) {
      updateTrayMenu();
    }
  } catch (error) {
    console.error("Failed to update agent statuses:", error);
  }

  // Start periodic updates
  statusUpdateInterval = setInterval(async () => {
    try {
      const statuses = await checkAllAgentsStatus();
      statuses.forEach((status) => {
        agentStatusMap.set(status.id, status);
      });
      await pushAgentsToPopover();

      // Update menu to reflect new statuses
      if (NATIVE_MENU) {
        updateTrayMenu();
      }
    } catch (error) {
      console.error("Failed to update agent statuses:", error);
    }
  }, interval);
}

/**
 * Restart status updates with new interval from config
 */
export async function restartStatusUpdates() {
  await startStatusUpdates();
}

/**
 * Clean up tray resources
 */
export function cleanupTray() {
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
    statusUpdateInterval = null;
  }

  if (tray) {
    tray.remove();
    tray = null;
  }

  agentStatusMap.clear();
}
