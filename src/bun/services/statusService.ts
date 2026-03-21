// Status Service - Centralized status polling for agent monitoring
import { checkAllAgentsStatus, readConfig } from "./agentService";
import {
  getStatusSyncService,
} from "./statusSyncService";

let statusUpdateInterval: NodeJS.Timeout | null = null;
let statusUpdatesStarted = false;

/**
 * Check all agent statuses, update the local map, push to all windows,
 * and optionally refresh the native tray menu.
 */
export async function refreshAndPush(updateMenu = true) {
  const sync = getStatusSyncService();
  const statuses = await checkAllAgentsStatus();
  sync.updateStatusMap(statuses);
  await sync.sync({ updateMenu });
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
    await refreshAndPush();
  } catch (error) {
    console.error("Failed to update agent statuses:", error);
  }

  // Start periodic updates
  statusUpdateInterval = setInterval(async () => {
    try {
      await refreshAndPush();
    } catch (error) {
      console.error("Failed to update agent statuses:", error);
    }
  }, interval);
}

/**
 * Start status updates once after renderer RPC listeners are ready.
 * Repeated calls are safe and do not create duplicate timers.
 */
export async function beginStatusUpdates() {
  if (statusUpdatesStarted && statusUpdateInterval) {
    return;
  }

  statusUpdatesStarted = true;
  await startStatusUpdates();
}

/**
 * Restart status updates with new interval from config
 */
export async function restartStatusUpdates() {
  statusUpdatesStarted = true;
  await startStatusUpdates();
}
