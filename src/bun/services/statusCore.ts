// Status Core - Pure status polling logic, dependency-injected for testability.
// This module does NOT import Bun/Electrobun/runtime modules.

import type { Agent, AgentStatusInfo, CheckStatus } from "../../shared/types";

export interface StatusCoreLogger {
  info(channel: string, message: string): void;
  warn(channel: string, message: string): void;
  debug(channel: string, message: string): void;
}

export interface StatusCoreDeps {
  isDaemonConfigured(): boolean;
  syncDataOnly(): Promise<{
    success: boolean;
    openIncidents: Array<{ agentId: number; incidentId: string }>;
  }>;
  syncAgents(): Promise<number>;
  checkAllAgentsStatus(): Promise<AgentStatusInfo[]>;
  readAgents(): Promise<Agent[]>;
  getAgentLatestCheck(agentId: number): {
    status: CheckStatus;
    checkedAt: number;
    errorMessage: string | null;
  } | null;
  getAdvancedSettings(): { pollingInterval: number };
  initIncidentService(): void;
  reconstructIncidentState(): Promise<void>;
  switchToDaemonMode(
    openIncidents: Array<{ agentId: number; incidentId: string }>,
  ): void;
  startRetentionService(): void;
  notifier: {
    checkAndNotify(statuses: AgentStatusInfo[]): Promise<void>;
    removeAgent(id: number): void;
  };
  statusSync: {
    updateStatusMap(statuses: AgentStatusInfo[]): void;
    sync(opts: { updateMenu: boolean }): Promise<void>;
  };
  logger: StatusCoreLogger;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface StatusCore {
  beginStatusUpdates(): Promise<void>;
  restartStatusUpdates(): Promise<void>;
  stopStatusUpdates(): void;
  refreshAndPush(updateMenu?: boolean): Promise<void>;
  removeAgentStatusTracking(agentId: number): void;
  isDaemonConnected(): boolean;
}

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

export function createStatusCore(deps: StatusCoreDeps): StatusCore {
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;

  // Internal state
  let daemonConnected = false;
  let incidentServiceInitialized = false;
  let lastOpenIncidents: Array<{ agentId: number; incidentId: string }> = [];
  let statusUpdateInterval: ReturnType<typeof setTimeout> | null = null;
  let statusUpdatesStarted = false;

  /**
   * Process synced data from daemon and detect status changes for notifications.
   * Queries the latest checks from DB (synced from daemon) and compares to lastKnownStatuses.
   */
  async function processSyncedData(): Promise<void> {
    const agents = await deps.readAgents();
    const currentStatuses: AgentStatusInfo[] = [];

    for (const agent of agents) {
      const latestCheck = deps.getAgentLatestCheck(agent.id);
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

    await deps.notifier.checkAndNotify(currentStatuses);

    deps.statusSync.updateStatusMap(currentStatuses);
    await deps.statusSync.sync({ updateMenu: true });
  }

  async function refreshAndPush(updateMenu = true) {
    const statuses = await deps.checkAllAgentsStatus();

    await deps.notifier.checkAndNotify(statuses);

    deps.statusSync.updateStatusMap(statuses);
    await deps.statusSync.sync({ updateMenu });
  }

  /**
   * DaemonMode: syncs from daemon and processes synced data.
   * Falls back to local mode if sync fails.
   */
  const daemonMode: PollMode = {
    name: "daemon",
    async execute() {
      const result = await deps.syncDataOnly();

      if (result.success) {
        lastOpenIncidents = result.openIncidents;
        await processSyncedData();
        return { success: true };
      }

      return { success: false, fallbackTo: "local" };
    },
    onEnter(reason) {
      if (reason === "daemon-connected") {
        deps.logger.info(
          "status",
          "Daemon connected - switching to synced data mode",
        );
        void deps.syncAgents();
        if (incidentServiceInitialized) {
          deps.switchToDaemonMode(lastOpenIncidents);
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
        deps.initIncidentService();
        await deps.reconstructIncidentState();
        incidentServiceInitialized = true;
      }
      await refreshAndPush();
      return { success: true };
    },
    onEnter(reason) {
      if (reason === "daemon-disconnected") {
        deps.logger.warn(
          "status",
          "Daemon sync failed - falling back to local polling",
        );
      } else if (reason === "daemon-disabled") {
        deps.logger.info(
          "status",
          "Daemon disabled - switching to local polling",
        );
      }
    },
  };

  async function startStatusUpdates() {
    if (statusUpdateInterval) {
      clearTimeoutFn(statusUpdateInterval);
      statusUpdateInterval = null;
    }

    const { pollingInterval } = deps.getAdvancedSettings();
    const interval = pollingInterval || 30000;

    deps.logger.info("status", `Starting status polling every ${interval}ms`);

    // Recursive poll function to prevent overlapping polls
    const poll = async () => {
      deps.logger.debug("status", "Starting poll cycle...");

      if (deps.isDaemonConfigured()) {
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

      deps.logger.debug("status", "Poll cycle complete");

      // Schedule next poll after this one completes
      const { pollingInterval } = deps.getAdvancedSettings();
      const nextInterval = pollingInterval || 30000;
      statusUpdateInterval = setTimeoutFn(poll, nextInterval);
    };

    // First poll immediately
    await poll();
  }

  async function beginStatusUpdates() {
    if (statusUpdatesStarted && statusUpdateInterval) {
      return;
    }

    statusUpdatesStarted = true;

    // Start retention cleanup service (runs startup cleanup + background job)
    deps.startRetentionService();

    await startStatusUpdates();
  }

  async function restartStatusUpdates() {
    statusUpdatesStarted = true;
    await startStatusUpdates();
  }

  function stopStatusUpdates(): void {
    if (statusUpdateInterval !== null) {
      clearTimeoutFn(statusUpdateInterval);
      statusUpdateInterval = null;
    }
    statusUpdatesStarted = false;
    deps.logger.info("status", "Status updates stopped");
  }

  /**
   * Remove an agent from all status tracking structures.
   * Call this when an agent is deleted to prevent memory leaks.
   */
  function removeAgentStatusTracking(agentId: number): void {
    deps.notifier.removeAgent(agentId);
  }

  /**
   * Check if daemon is currently connected (for external queries).
   */
  function isDaemonConnected(): boolean {
    return daemonConnected;
  }

  return {
    beginStatusUpdates,
    restartStatusUpdates,
    stopStatusUpdates,
    refreshAndPush,
    removeAgentStatusTracking,
    isDaemonConnected,
  };
}
