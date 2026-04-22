// Status Service - Centralized status polling for agent monitoring
import { Utils } from "electrobun/bun";
import type { AgentStatusInfo } from "../../shared/types";
import { getAdvancedSettings } from "../storage/sqlite/advancedSettingsRepo";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import { checkAllAgentsStatus, readAgents } from "./agentService";
import { sync as daemonSync } from "./daemonSyncService";
import { logger } from "./loggerService";
import { getStatusSyncService } from "./statusSyncService";
import {
  initIncidentService,
  reconstructState as reconstructIncidentState,
  clearState as clearIncidentState,
  closeAllOpenIncidents,
} from "./incidentService";
import { startRetentionService } from "./retentionService";
import { getAgentLatestCheck } from "../storage/sqlite/checksRepo";

let statusUpdateInterval: NodeJS.Timeout | null = null;
let statusUpdatesStarted = false;

// Daemon connection state
let daemonConnected = false;

const FIRST_POLL_MARKER = "__FIRST_POLL__";

/**
 * agentBaseline tracks each agent's status at the PREVIOUS poll.
 * This allows us to detect status changes between polls.
 * Example: If Poll 1 = offline and Poll 2 = error, the baseline
 * at Poll 2 is "offline" and current is "error", so we know
 * the agent deviated from baseline.
 */
let agentBaseline: Map<number, string> = new Map();

/**
 * pendingAgents tracks agents that have deviated from their baseline.
 * Key: agent ID
 * Value: { currentStatus, pollsInNewState, originalBaseline }
 *   - currentStatus: the non-baseline status (ok, offline, error)
 *   - pollsInNewState: how many consecutive polls at currentStatus
 *   - originalBaseline: the status BEFORE the first deviation (used to detect true return)
 * Example: After 3 polls at "error", pollsInNewState = 3, originalBaseline = "ok"
 */
interface PendingAgent {
  currentStatus: string;
  pollsInNewState: number;
  originalBaseline: string;
}
let pendingAgents: Map<number, PendingAgent> = new Map();

/**
 * statusGroups groups pending agents by their current non-baseline status.
 * When any agent in a group reaches threshold, ALL agents in that group fire.
 * Example: If A1(error@3 polls) and A3(error@1 poll) are both in error group,
 * when A1 reaches threshold (3), both A1 and A3 fire together.
 */
const STATUS_VALUES: string[] = ["ok", "offline", "error"];
let statusGroups: Map<string, Set<number>> = new Map(
  STATUS_VALUES.map((s) => [s, new Set<number>()]),
);

interface StatusChangeBatch {
  agentId: number;
  agentName: string;
  newStatus: string;
}

export async function refreshAndPush(updateMenu = true) {
  const sync = getStatusSyncService();
  const statuses = await checkAllAgentsStatus();

  await checkAndNotifyStatusChanges(statuses);

  sync.updateStatusMap(statuses);
  await sync.sync({ updateMenu });
}

/**
 * Process synced data from daemon and detect status changes for notifications.
 * Queries the latest checks from DB (synced from daemon) and compares to lastKnownStatuses.
 */
async function processSyncedData(): Promise<void> {
  const agents = await readAgents();
  const currentStatuses: AgentStatusInfo[] = [];

  // Get latest check for each agent from DB (synced from daemon)
  for (const agent of agents) {
    const latestCheck = getAgentLatestCheck(agent.id);
    if (latestCheck) {
      // Map CheckStatus to Status (treat "degraded" as "error")
      const status =
        latestCheck.status === "degraded" ? "error" : latestCheck.status;
      currentStatuses.push({
        id: agent.id,
        status,
        lastChecked: latestCheck.checkedAt,
        errorMessage: latestCheck.errorMessage ?? undefined,
      });
    }
  }

  await checkAndNotifyStatusChanges(currentStatuses);

  // Update status sync service with current statuses
  const sync = getStatusSyncService();
  sync.updateStatusMap(currentStatuses);
  await sync.sync({ updateMenu: true });
}

/**
 * checkAndNotifyStatusChanges - Main notification logic
 *
 * ALGORITHM:
 * 1. First poll for an agent: set baseline = current status, no notification
 * 2. Subsequent polls: compare current status to baseline
 *    a. If current ≠ baseline: agent deviated, add to pending
 *    b. If current = baseline: agent returned to normal, remove from pending
 * 3. For deviated agents: increment poll counter each poll at same status
 * 4. For each status group (ok/offline/error):
 *    a. Find max pollsInNewState among agents in group
 *    b. If max >= threshold: ALL agents in group fire together
 * 5. After firing: remove all fired agents from pending
 *
 * EDGE CASE: Agent changes status mid-pending (e.g., error → ok while pending)
 * - Remove from old status group
 * - Reset poll counter to 1
 * - Add to new status group
 */
async function checkAndNotifyStatusChanges(
  statuses: AgentStatusInfo[],
): Promise<void> {
  const settings = getNotificationSettings();

  if (!settings.notificationsEnabled) {
    return;
  }

  const agents = await readAgents();
  const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));
  const changesToNotify: StatusChangeBatch[] = [];

  // Capture baselines BEFORE processing any agents.
  // This ensures all agents in this poll compare against their baseline
  // from the PREVIOUS complete poll, not baselines modified during this poll.
  const baselinesAtPollStart = new Map<number, string>();
  for (const status of statuses) {
    baselinesAtPollStart.set(
      status.id,
      agentBaseline.get(status.id) ?? FIRST_POLL_MARKER,
    );
  }

  // Phase 1: Process each agent - detect deviations, update counters, manage groups
  for (const status of statuses) {
    const baseline = baselinesAtPollStart.get(status.id);
    const agentName = agentNameMap.get(status.id) || `Agent ${status.id}`;

    // First poll for this agent: establish baseline, no change to report
    if (baseline === FIRST_POLL_MARKER) {
      agentBaseline.set(status.id, status.status);
      continue;
    }

    const currentStatus = status.status;

    // Agent has DEVIATED from baseline (current ≠ baseline)
    if (currentStatus !== baseline) {
      const pending = pendingAgents.get(status.id);

      if (!pending) {
        // First time this agent has deviated from baseline
        // Create pending entry with counter = 1 (this is first poll at new status)
        pendingAgents.set(status.id, {
          currentStatus,
          pollsInNewState: 1,
          originalBaseline: baseline as string,
        });
        // Add to appropriate status group for batching
        statusGroups.get(currentStatus)?.add(status.id);
        logger.debug(
          "notifications",
          `[${agentName}] Status change: ${baseline} -> ${currentStatus}`,
        );
      } else if (pending.currentStatus === currentStatus) {
        // Agent is still deviated in the SAME status as last poll
        // Just increment the counter
        pending.pollsInNewState++;
      } else {
        // Agent changed to a DIFFERENT non-baseline status mid-pending
        // Example: was error, now ok (both ≠ baseline)
        // Remove from old status group
        statusGroups.get(pending.currentStatus)?.delete(status.id);
        // Update pending with new status and reset counter
        // Preserve originalBaseline - we still want to know where we came from
        pending.currentStatus = currentStatus;
        pending.pollsInNewState = 1;
        // Add to new status group
        statusGroups.get(currentStatus)?.add(status.id);
      }
    } else {
      // Agent's current status equals the poll-start baseline
      // Check if this is a TRUE return to original baseline (pre-deviation)
      const pending = pendingAgents.get(status.id);
      if (pending) {
        // Compare against ORIGINAL baseline (stored when first deviated)
        // NOT against the current baseline which gets updated each poll
        if (currentStatus === pending.originalBaseline) {
          // Genuinely returned to where we started before deviation
          pendingAgents.delete(status.id);
          // Remove from all status groups
          for (const group of statusGroups.values()) {
            group.delete(status.id);
          }
        } else {
          // Agent returned to baseline status but hasn't returned to original baseline
          // This means the deviation has persisted for another poll cycle
          // Increment counter to track sustained deviation
          pending.pollsInNewState++;
        }
      }
    }

    // Update baseline for next poll comparison
    // Next poll will compare against THIS poll's status
    agentBaseline.set(status.id, currentStatus);
  }

  // Phase 2: Check which groups have reached threshold and should fire
  for (const [status, group] of statusGroups) {
    if (group.size === 0) continue;

    // Find the agent with the most polls in this group
    // When this agent reaches threshold, ALL in group fire
    let maxPolls = 0;
    for (const agentId of group) {
      const pending = pendingAgents.get(agentId);
      if (pending && pending.pollsInNewState > maxPolls) {
        maxPolls = pending.pollsInNewState;
      }
    }

    // Check if threshold reached
    if (maxPolls >= settings.statusChangeThreshold) {
      // ALL agents in this group fire together
      // This includes agents that joined later (fewer polls)
      logger.info(
        "notifications",
        `${group.size} agent(s) reached threshold for ${status}, sending notification`,
      );
      for (const agentId of group) {
        const agentName = agentNameMap.get(agentId) || `Agent ${agentId}`;
        changesToNotify.push({
          agentId,
          agentName,
          newStatus: status,
        });
        // Remove fired agents from pending
        pendingAgents.delete(agentId);
      }
      // Clear the group since all fired
      group.clear();
    }
  }

  // Phase 3: Send the notifications
  if (changesToNotify.length > 0) {
    batchAndSendNotifications(changesToNotify, settings);
  }
}

/**
 * batchAndSendNotifications - Group changes by status and send notifications
 *
 * Groups changes by their final status (ok/offline/error) and sends
 * one notification per group with appropriate messaging.
 *
 * Example: 3 agents going online → "3 agents are now online"
 * Example: 1 agent offline → "Agent Offline - X is now offline"
 */
function batchAndSendNotifications(
  changes: StatusChangeBatch[],
  settings: {
    notifyOnStatusChange: boolean;
    notifyOnError: boolean;
    silentNotifications: boolean;
  },
): void {
  // Group changes by their final status
  const grouped: Map<string, StatusChangeBatch[]> = new Map();

  for (const change of changes) {
    // Check if this change should trigger a notification
    // notifyOnStatusChange = true means notify for ANY status change
    // notifyOnError = true means notify specifically for errors
    const shouldNotify =
      settings.notifyOnStatusChange ||
      (change.newStatus === "error" && settings.notifyOnError);

    if (!shouldNotify) continue;

    if (!grouped.has(change.newStatus)) {
      grouped.set(change.newStatus, []);
    }
    grouped.get(change.newStatus)!.push(change);
  }

  // Send one notification per status group
  for (const [status, groupChanges] of grouped) {
    if (groupChanges.length === 0) continue;

    const count = groupChanges.length;
    let title = "";
    let body = "";

    switch (status) {
      case "ok":
        if (count === 1) {
          title = "Agent Online";
          body = groupChanges[0].agentName + " is now online";
        } else {
          title = "Agents Online";
          body = count + " agents are now online";
        }
        break;
      case "offline":
        if (count === 1) {
          title = "Agent Offline";
          body = groupChanges[0].agentName + " is now offline";
        } else {
          title = "Agents Offline";
          body = count + " agents are now offline";
        }
        break;
      case "error":
        if (count === 1) {
          title = "Agent Error";
          body = groupChanges[0].agentName + " encountered an error";
        } else {
          title = "Agent Errors";
          body = count + " agents encountered errors";
        }
        break;
    }

    try {
      Utils.showNotification({
        title,
        body,
        silent: settings.silentNotifications,
      });
      logger.info("notifications", `Notification sent: ${title} - ${body}`);
    } catch (error) {
      logger.error("notifications", "Failed to send notification:", error);
    }
  }
}

async function startStatusUpdates() {
  if (statusUpdateInterval) {
    clearTimeout(statusUpdateInterval);
  }

  const { pollingInterval } = getAdvancedSettings();
  const interval = pollingInterval || 30000;

  logger.info("status", `Starting status polling every ${interval}ms`);

  // Recursive poll function to prevent overlapping polls
  const poll = async () => {
    logger.debug("status", "Starting poll cycle...");
    try {
      // Try to sync from daemon first
      const wasConnected = daemonConnected;
      const syncResult = await daemonSync();

      if (syncResult.checksImported > 0) {
        // Daemon sync succeeded
        if (!wasConnected) {
          // Transitioning from local mode to daemon mode
          logger.info(
            "status",
            "Daemon connected - switching to synced data mode",
          );
          // Close local open incidents and clear state (daemon handles incident detection)
          closeAllOpenIncidents();
          clearIncidentState();
        }
        daemonConnected = true;

        // Process synced data for notifications
        await processSyncedData();
      } else {
        // This shouldn't happen - daemonSync returns counts on success
        throw new Error("Unexpected sync result");
      }
    } catch (error) {
      // Daemon sync failed - fall back to local polling
      const wasConnected = daemonConnected;
      if (wasConnected) {
        // Transitioning from daemon mode to local mode
        logger.warn(
          "status",
          "Daemon sync failed - falling back to local polling",
        );
        daemonConnected = false;

        // Initialize local incident service for fallback mode
        initIncidentService();
        await reconstructIncidentState();
      }

      // Perform local polling
      await refreshAndPush();
    }

    // Schedule next poll after this one completes
    const { pollingInterval } = getAdvancedSettings();
    const interval = pollingInterval || 30000;
    statusUpdateInterval = setTimeout(poll, interval);
  };

  // First poll immediately
  await poll();
}

export async function beginStatusUpdates() {
  if (statusUpdatesStarted && statusUpdateInterval) {
    return;
  }

  statusUpdatesStarted = true;

  // Start retention cleanup service (runs startup cleanup + background job)
  startRetentionService();

  // Note: Incident service is initialized conditionally in the poll loop
  // based on whether daemon is connected or not

  await startStatusUpdates();
}

export async function restartStatusUpdates() {
  statusUpdatesStarted = true;
  await startStatusUpdates();
}

export function stopStatusUpdates(): void {
  if (statusUpdateInterval !== null) {
    clearTimeout(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  statusUpdatesStarted = false;
  logger.info("status", "Status updates stopped");
}

/**
 * Remove an agent from all status tracking structures.
 * Call this when an agent is deleted to prevent memory leaks.
 */
export function removeAgentStatusTracking(agentId: number): void {
  // Remove from baseline tracking
  agentBaseline.delete(agentId);

  // Remove from pending agents tracking
  const pending = pendingAgents.get(agentId);
  if (pending) {
    pendingAgents.delete(agentId);
    // Also remove from status groups
    for (const group of statusGroups.values()) {
      group.delete(agentId);
    }
  }

  logger.debug("status", `[Agent ${agentId}] Removed from status tracking`);
}

/**
 * Check if daemon is currently connected (for external queries).
 */
export function isDaemonConnected(): boolean {
  return daemonConnected;
}
