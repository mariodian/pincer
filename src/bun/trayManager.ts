// Tray Manager - Handles system tray icon and menu for agent monitoring
import { BrowserWindow, Tray } from "electrobun/bun";
import { agentRPC } from "./agentRPC";
import {
  AgentStatus,
  checkAllAgentsStatus,
  readAgents,
  readConfig,
} from "./agentsService";
import { getMainViewUrl } from "./mainViewUrl";
import { setOpenConfigCallback, trayPopoverRPC } from "./trayPopoverRPC";
import { applyMacOSWindowEffects, readWindowConfig } from "./windowService";

const NATIVE_MENU = false;

let tray: Tray | null = null;
let configWindow: BrowserWindow | null = null;
let popoverWindow: BrowserWindow | null = null;
let agentStatusMap: Map<string, AgentStatus> = new Map();
let statusUpdateInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the tray icon and set up event handlers
 */
export async function initializeTray() {
  // Set up callback for opening config window from popover
  setOpenConfigCallback(() => {
    openConfigWindow();
  });

  // Create tray icon
  tray = new Tray({
    title: "🦞 CrabControl",
    // Use a default icon - we'll need to add this to assets
    image: "views://assets/icon-32-template.png", // Will need to create this
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
        const isMacOS = process.platform === "darwin";
        const windowConfig = await readWindowConfig("popover");
        const wc: Record<string, unknown> = {
          title: "",
          url: await getMainViewUrl("tray-popover.html"),
          titleBarStyle: "hiddenInset",
          // trafficLights: false,
          rpc: trayPopoverRPC,
          // transparent: true,
          ...(isMacOS
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
            width: 250,
            height: 300,
            x: bounds.x,
            y: 0 + bounds.height,
          },
        };

        popoverWindow = new BrowserWindow(wc);

        if (isMacOS) {
          applyMacOSWindowEffects(popoverWindow, windowConfig);
        }
        // Clear reference when closed
        popoverWindow.on("close", () => {
          popoverWindow = null;
        });
      }
    } else if (action === "configure") {
      // Configure menu item clicked
      openConfigWindow();
    } else if (action === "refresh") {
      // Refresh menu item clicked - show feedback in title
      tray?.setTitle("🦞 CrabControl - Refreshing...");
      try {
        const statuses = await checkAllAgentsStatus();
        statuses.forEach((status) => {
          agentStatusMap.set(status.id, status);
        });
        updateTrayMenu();
        tray?.setTitle("🦞 CrabControl - Updated!");
        setTimeout(() => tray?.setTitle("🦞 CrabControl"), 2000);
      } catch (error) {
        console.error("Failed to refresh agent statuses:", error);
        tray?.setTitle("🦞 CrabControl - Error!");
        setTimeout(() => tray?.setTitle("🦞 CrabControl"), 2000);
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
    const menuItems = [];

    // Add agent items
    for (const agent of agents) {
      const status = agentStatusMap.get(agent.id) || {
        ...agent,
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
        case "warning":
          label = `▲ ${agent.name}`;
          tooltip += `\nStatus: Warning${status.errorMessage ? `\nError: ${status.errorMessage}` : ""}`;
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

    // Add Configure menu item
    menuItems.push({
      type: "normal" as const,
      label: "Configure Agents",
      action: "configure",
      enabled: true,
    });

    // Add Quit menu item
    menuItems.push({
      type: "normal" as const,
      label: "Quit CrabControl",
      action: "quit",
      enabled: true,
    });
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
        {
          type: "divider" as const,
        },
        {
          type: "normal" as const,
          label: "Configure Agents",
          action: "configure",
          enabled: true,
        },
        {
          type: "normal" as const,
          label: "Quit CrabControl",
          action: "quit",
          enabled: true,
        },
      ]);
    }
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
 * Open the configuration window
 */
export function openConfigWindow() {
  console.log("Opening agent configuration window...");

  // If window already exists, focus it
  if (configWindow) {
    configWindow.focus();
    return;
  }

  const isMacOS = process.platform === "darwin";

  // Create new configuration window
  const openWindow = async () => {
    const url = await getMainViewUrl("agent-config.html");
    const windowConfig = await readWindowConfig("config");
    configWindow = new BrowserWindow({
      title: "Configure Agents - CrabControl",
      url,
      frame: {
        width: 600,
        height: 500,
        x: 100,
        y: 100,
      },
      rpc: agentRPC,
      ...(isMacOS
        ? {
            titleBarStyle: windowConfig.titleBarStyle,
            transparent: windowConfig.transparent,
          }
        : {}),
    });

    // Apply macOS window effects
    if (isMacOS) {
      applyMacOSWindowEffects(configWindow, windowConfig);
    }

    // Clean up when window closes
    configWindow.on("close", () => {
      configWindow = null;
    });

    console.log("Agent configuration window opened");
  };

  void openWindow();
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
