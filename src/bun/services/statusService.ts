// Status Service - Centralized status polling for agent monitoring
import { Utils } from "electrobun/bun";
import type { AgentStatusInfo } from "../../shared/types";
import { getAdvancedSettings } from "../storage/sqlite/advancedSettingsRepo";
import { getAgentLatestCheck } from "../storage/sqlite/checksRepo";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import { checkAllAgentsStatus, readAgents } from "./agentService";
import {
  sync as daemonSync,
  isDaemonConfigured,
  pushAgentsToDaemon,
} from "./daemonSyncService";
import {
  initIncidentService,
  reconstructState as reconstructIncidentState,
  switchToDaemonMode,
} from "./incidentService";
import { logger } from "./loggerService";
import { startRetentionService } from "./retentionService";
import { getStatusSyncService } from "./statusSyncService";

let statusUpdateInterval: NodeJS.Timeout | null = null;
let statusUpdatesStarted = false;

// Global flag to prevent duplicate polling across HMR reloads
const globalForHMR = globalThis as typeof globalThis & {
  __pincerStatusPollingActive?: boolean;
};

// On module load (including HMR), clear any stale polling state
if (globalForHMR.__pincerStatusPollingActive) {
  logger.warn(
    "status",
    "HMR detected - polling was already active, resetting state",
  );
}
globalForHMR.__pincerStatusPollingActive = false;

// Daemon connection state
let daemonConnected = false;
let incidentServiceInitialized = false;
let lastOpenIncidents: Array<{ agentId: number; incidentId: string }> = [];
let agentsPushedOnStartup = false;

const FIRST_POLL_MARKER = "__FIRST_POLL__";

/**
 * PollMode interface for strategy pattern.
 * Separates daemon vs local polling logic into swappable strategies.
 */
interface PollMode {
  name: "daemon" | "local";
  execute(): Promise<{ success: boolean; fallbackTo?: "local" }>;
  onEnter(
    reason:
      | "initial"
      | "daemon-connected"
      | "daemon-disconnected"
      | "daemon-disabled",
  ): void;
}

/**
 * DaemonMode: syncs from daemon and processes synced data.
 * Falls back to local mode if sync fails.
 */
const daemonMode: PollMode = {
  name: "daemon",
  async execute() {
    const result = await daemonSync();

    if (result.success) {
      lastOpenIncidents = result.openIncidents;
      await processSyncedData();
      return { success: true };
    }

    return { success: false, fallbackTo: "local" };
  },
  onEnter(reason) {
    if (reason === "daemon-connected") {
      logger.info("status", "Daemon connected - switching to synced data mode");
      // Push agents to daemon on reconnect (skip if already pushed on startup)
      if (!agentsPushedOnStartup) {
        agentsPushedOnStartup = true;
      } else {
        void pushAgentsToDaemon();
      }
      if (incidentServiceInitialized) {
        switchToDaemonMode(lastOpenIncidents);
      }
      incidentServiceInitialized = false;
    }
  },
};

/**
 * LocalMode: initializes incident service and polls locally.
 */
const localMode: PollMode = {
  name: "local",
  async execute() {
    if (!incidentServiceInitialized) {
      initIncidentService();
      await reconstructIncidentState();
      incidentServiceInitialized = true;
    }
    await refreshAndPush();
    return { success: true };
  },
  onEnter(reason) {
    if (reason === "daemon-disconnected") {
      logger.warn(
        "status",
        "Daemon sync failed - falling back to local polling",
      );
    } else if (reason === "daemon-disabled") {
      logger.info("status", "Daemon disabled - switching to local polling");
    }
  },
};

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
 * Build notification title and body for a group of status changes.
 */
function buildNotificationMessage(
  status: string,
  changes: StatusChangeBatch[],
): { title: string; body: string } {
  const count = changes.length;
  const isSingle = count === 1;
  const statusWord = status.charAt(0).toUpperCase() + status.slice(1);

  if (isSingle) {
    return {
      title: `Agent ${statusWord}`,
      body:
        status !== "error"
          ? `${changes[0].agentName} is now ${status}`
          : `${changes[0].agentName} encountered error`,
    };
  }

  return {
    title: `Agents ${statusWord}`,
    body:
      status !== "error"
        ? `${count} agents are now ${status}`
        : `${count} agents encountered error`,
  };
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

    const { title, body } = buildNotificationMessage(status, groupChanges);
    if (!title) continue;

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

    if (isDaemonConfigured()) {
      const result = await daemonMode.execute();

      if (result.success) {
        if (!daemonConnected) {
          daemonMode.onEnter("daemon-connected");
        }
        daemonConnected = true;
      } else {
        if (daemonConnected) {
          localMode.onEnter("daemon-disconnected");
        }
        daemonConnected = false;
        await localMode.execute();
      }
    } else {
      if (daemonConnected) {
        localMode.onEnter("daemon-disabled");
      }
      daemonConnected = false;
      await localMode.execute();
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

  // HMR protection: only skip if there's actually an active polling interval
  // The flag alone is insufficient — HMR may have cleared the old interval
  // while the flag remains true from a previous module instance
  if (globalForHMR.__pincerStatusPollingActive && statusUpdateInterval) {
    logger.warn(
      "status",
      "Polling already active (HMR), skipping duplicate start",
    );
    return;
  }

  statusUpdatesStarted = true;
  globalForHMR.__pincerStatusPollingActive = true;

  // Start retention cleanup service (runs startup cleanup + background job)
  startRetentionService();

  // Note: Incident service is initialized conditionally in the poll loop
  // based on whether daemon is connected or not

  await startStatusUpdates();
}

export async function restartStatusUpdates() {
  statusUpdatesStarted = true;
  globalForHMR.__pincerStatusPollingActive = true;
  await startStatusUpdates();
}

export function stopStatusUpdates(): void {
  if (statusUpdateInterval !== null) {
    clearTimeout(statusUpdateInterval);
    statusUpdateInterval = null;
  }
  statusUpdatesStarted = false;
  globalForHMR.__pincerStatusPollingActive = false;
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
