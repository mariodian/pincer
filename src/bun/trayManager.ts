// Tray Manager - Handles system tray icon and menu for agent monitoring
import { Tray, BrowserWindow } from "electrobun/bun";
import { readAgents, checkAllAgentsStatus, AgentStatus } from "./agentsService";
import { agentRPC } from "./agentRPC";
import { applyMacOSWindowEffects } from "./index";

let tray: Tray | null = null;
let configWindow: BrowserWindow | null = null;
let agentStatusMap: Map<string, AgentStatus> = new Map();
let statusUpdateInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the tray icon and set up event handlers
 */
export function initializeTray() {
  // Create tray icon
  tray = new Tray({
    title: "CrabControl Agents",
    // Use a default icon - we'll need to add this to assets
    image: "views://assets/icon-32-template.png", // Will need to create this
    template: true,
    width: 32,
    height: 32,
  });

  // Set up click handler
  tray.on("tray-clicked", async (event: unknown) => {
    const action = (event as { data?: { action?: string } })?.data?.action;
    
    if (action === "") {
      // Tray icon clicked (no menu item) - show/update menu
      updateTrayMenu();
    } else if (action === "configure") {
      // Configure menu item clicked
      openConfigWindow();
    } else if (action && action.startsWith("agent:")) {
      // Agent menu item clicked
      const agentId = action.substring(6); // Remove "agent:" prefix
      // Could open agent URL or show details
      console.log(`Agent clicked: ${agentId}`);
    }
  });

  // Initial menu update
  updateTrayMenu();
  
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
        errorMessage: undefined
      };
      
      let label = agent.name;
      let tooltip = `${agent.name}: ${agent.url}:${agent.port}`;
      
      // Add status indicator
      switch (status.status) {
        case "online":
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
        type: "divider" as const
      });
    }
    
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
           type: "divider" as const
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
function startStatusUpdates() {
  // Clear any existing interval
  if (statusUpdateInterval) {
    clearInterval(statusUpdateInterval);
  }
  
  // Update status every 30 seconds
  statusUpdateInterval = setInterval(async () => {
    try {
      const statuses = await checkAllAgentsStatus();
      statuses.forEach(status => {
        agentStatusMap.set(status.id, status);
      });
      
      // Update menu to reflect new statuses
      updateTrayMenu();
    } catch (error) {
      console.error("Failed to update agent statuses:", error);
    }
  }, 30000); // 30 seconds
}

/**
 * Open the configuration window
 */
function openConfigWindow() {
  console.log("Opening agent configuration window...");
  
  // If window already exists, focus it
  if (configWindow) {
    configWindow.focus();
    return;
  }
  
  const isMacOS = process.platform === "darwin";
  
  // Create new configuration window
  configWindow = new BrowserWindow({
    title: "Configure Agents - CrabControl",
    url: "views://mainview/agent-config.html",
    frame: {
      width: 600,
      height: 500,
      x: 100,
      y: 100,
    },
    rpc: agentRPC,
    ...(isMacOS ? {
      titleBarStyle: "hiddenInset" as const,
      transparent: true,
    } : {}),
  });
  
  // Apply macOS window effects
  if (isMacOS) {
    applyMacOSWindowEffects(configWindow);
  }
  
  // Clean up when window closes
  configWindow.on("close", () => {
    configWindow = null;
  });
  
  console.log("Agent configuration window opened");
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