// Status Service - Centralized status polling for agent monitoring
import { Utils } from "electrobun/bun";
import { logger } from "./loggerService";
import { checkAllAgentsStatus, readAgents } from "./agentService";
import { getAdvancedSettings } from "../storage/sqlite/advancedSettingsRepo";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import { getStatusSyncService } from "./statusSyncService";
import type { AgentStatusInfo, AgentStatus } from "../../shared/types";

let statusUpdateInterval: NodeJS.Timeout | null = null;
let statusUpdatesStarted = false;
let previousStatuses: Map<number, AgentStatus> = new Map();
let statusChangeCounters: Map<number, number> = new Map();

/**
 * Check all agent statuses, update the local map, push to all windows,
 * and optionally refresh the native tray menu.
 */
export async function refreshAndPush(updateMenu = true) {
  const sync = getStatusSyncService();
  const statuses = await checkAllAgentsStatus();
  logger.debug("status", `Polled ${statuses.length} agent(s)`);

  // Check for status changes and trigger notifications
  await checkAndNotifyStatusChanges(statuses);

  sync.updateStatusMap(statuses);
  await sync.sync({ updateMenu });
  logger.debug("status", "Status sync pushed to all windows");
}

/**
 * Compare new statuses with previous ones and send notifications if needed.
 */
async function checkAndNotifyStatusChanges(statuses: AgentStatusInfo[]): Promise<void> {
  const settings = getNotificationSettings();

  if (!settings.notificationsEnabled) {
    return;
  }

  // Get agent names for notifications
  const agents = await readAgents();
  const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

  for (const status of statuses) {
    const previous = previousStatuses.get(status.id);
    const previousStatus = previous?.status;

    if (previousStatus && previousStatus !== status.status) {
      // Status changed for this agent
      const counter = statusChangeCounters.get(status.id) || 0;
      const newCounter = counter + 1;

        if (newCounter >= settings.statusChangeThreshold) {
          // Threshold reached, send notification
          const shouldNotify =
            settings.notifyOnStatusChange ||
            (status.status === "error" && settings.notifyOnError);

          if (shouldNotify) {
          const agentName = agentNameMap.get(status.id) || `Agent ${status.id}`;
          let title = "";
          let body = "";

          switch (status.status) {
            case "ok":
              title = "Agent Online";
              body = `${agentName} is now online`;
              break;
            case "offline":
              title = "Agent Offline";
              body = `${agentName} is now offline`;
              break;
            case "error":
              title = "Agent Error";
              body = `${agentName} encountered an error${status.errorMessage ? `: ${status.errorMessage}` : ""}`;
              break;
          }

          Utils.showNotification({
            title,
            body,
            silent: settings.silentNotifications,
          });

          logger.debug("notifications", `Sent notification for ${agentName} status change to ${status.status}`);
        }

        // Reset counter after notification
        statusChangeCounters.set(status.id, 0);
      } else {
        statusChangeCounters.set(status.id, newCounter);
      }
    } else if (!previousStatus || previousStatus === status.status) {
      // No change or first check, reset counter
      statusChangeCounters.set(status.id, 0);
    }

    // Update previous status for next comparison (need full AgentStatus with name)
    const agent = agents.find((a) => a.id === status.id);
    if (agent) {
      previousStatuses.set(status.id, {
        ...agent,
        ...status,
      });
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

  // Read config for polling interval from advanced settings
  const { pollingInterval } = getAdvancedSettings();
  const interval = pollingInterval || 30000;

  logger.debug("status", `Starting status polling every ${interval}ms`);

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
