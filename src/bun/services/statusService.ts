// Status Service - Centralized status polling for agent monitoring
import type { AgentStatusInfo } from "../../shared/types";
import { getAdvancedSettings } from "../storage/sqlite/advancedSettingsRepo";
import { getAgentLatestCheck } from "../storage/sqlite/checksRepo";
import { checkAllAgentsStatus, readAgents } from "./agentService";
import {
  isDaemonConfigured,
  syncAgents,
  syncDataOnly,
} from "./daemonSyncService";
import {
  initIncidentService,
  reconstructState as reconstructIncidentState,
  switchToDaemonMode,
} from "./incidentService";
import { logger } from "./loggerService";
import { startRetentionService } from "./retentionService";
import { StatusNotifier } from "./statusNotifier";
import { getStatusSyncService } from "./statusSyncService";

const notifier = new StatusNotifier();

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
    const result = await syncDataOnly();

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
      void syncAgents();
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

export async function refreshAndPush(updateMenu = true) {
  const sync = getStatusSyncService();
  const statuses = await checkAllAgentsStatus();

  await notifier.checkAndNotify(statuses);

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

  await notifier.checkAndNotify(currentStatuses);

  // Update status sync service with current statuses
  const sync = getStatusSyncService();
  sync.updateStatusMap(currentStatuses);
  await sync.sync({ updateMenu: true });
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

    logger.debug("status", "Poll cycle complete");

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
  notifier.removeAgent(agentId);
}

/**
 * Check if daemon is currently connected (for external queries).
 */
export function isDaemonConnected(): boolean {
  return daemonConnected;
}
