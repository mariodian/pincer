// Status Service - Centralized status polling for agent monitoring
import { logger } from "./loggerService";
import { checkAllAgentsStatus } from "./agentService";
import { getSettings } from "../storage/sqlite/settingsRepo";
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
  const { pollingInterval } = getSettings();
  const interval = pollingInterval || 30000;

  // Update status immediately
  try {
    await refreshAndPush();
  } catch (error) {
    logger.error("status", "Failed to update agent statuses:", error);
  }

  // Start periodic updates
  statusUpdateInterval = setInterval(async () => {
    try {
      await refreshAndPush();
    } catch (error) {
      logger.error("status", "Failed to update agent statuses:", error);
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
