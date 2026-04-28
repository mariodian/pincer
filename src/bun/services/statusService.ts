// Status Service - Centralized status polling for agent monitoring
// Thin production wrapper around statusCore.

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
import { createStatusCore } from "./statusCore";
import { StatusNotifier } from "./statusNotifier";
import { getStatusSyncService } from "./statusSyncService";

const notifier = new StatusNotifier();

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

const statusSync = {
  updateStatusMap(
    statuses: Parameters<
      ReturnType<typeof getStatusSyncService>["updateStatusMap"]
    >[0],
  ) {
    getStatusSyncService().updateStatusMap(statuses);
  },
  sync(opts: Parameters<ReturnType<typeof getStatusSyncService>["sync"]>[0]) {
    return getStatusSyncService().sync(opts);
  },
};

const core = createStatusCore({
  isDaemonConfigured,
  syncDataOnly,
  syncAgents,
  checkAllAgentsStatus,
  readAgents,
  getAgentLatestCheck,
  getAdvancedSettings,
  initIncidentService,
  reconstructIncidentState,
  switchToDaemonMode,
  startRetentionService,
  notifier,
  statusSync,
  logger,
});

export async function beginStatusUpdates() {
  if (globalForHMR.__pincerStatusPollingActive) {
    logger.warn(
      "status",
      "Polling already active (HMR), skipping duplicate start",
    );
    return;
  }

  await core.beginStatusUpdates();
  globalForHMR.__pincerStatusPollingActive = true;
}

export async function restartStatusUpdates() {
  globalForHMR.__pincerStatusPollingActive = true;
  await core.restartStatusUpdates();
}

export function stopStatusUpdates(): void {
  core.stopStatusUpdates();
  globalForHMR.__pincerStatusPollingActive = false;
}

export const refreshAndPush = core.refreshAndPush;

/**
 * Remove an agent from all status tracking structures.
 * Call this when an agent is deleted to prevent memory leaks.
 */
export const removeAgentStatusTracking = core.removeAgentStatusTracking;

/**
 * Check if daemon is currently connected (for external queries).
 */
export const isDaemonConnected = core.isDaemonConnected;
