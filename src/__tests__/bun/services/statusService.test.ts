import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createStatusCore } from "../../../bun/services/statusCore";
import type { Agent, AgentStatusInfo } from "../../../shared/types";

describe("statusCore", () => {
  let deps: {
    isDaemonConfigured: ReturnType<typeof mock<() => boolean>>;
    syncDataOnly: ReturnType<
      typeof mock<
        () => Promise<{
          success: boolean;
          openIncidents: Array<{ agentId: number; incidentId: string }>;
        }>
      >
    >;
    syncAgents: ReturnType<typeof mock<() => Promise<number>>>;
    checkAllAgentsStatus: ReturnType<
      typeof mock<() => Promise<AgentStatusInfo[]>>
    >;
    readAgents: ReturnType<typeof mock<() => Promise<Agent[]>>>;
    getAgentLatestCheck: ReturnType<
      typeof mock<
        (agentId: number) => {
          status: "ok" | "offline" | "error" | "degraded";
          checkedAt: number;
          errorMessage: string | null;
        } | null
      >
    >;
    getAdvancedSettings: ReturnType<
      typeof mock<() => { pollingInterval: number }>
    >;
    initIncidentService: ReturnType<typeof mock<() => void>>;
    reconstructIncidentState: ReturnType<typeof mock<() => Promise<void>>>;
    switchToDaemonMode: ReturnType<
      typeof mock<
        (openIncidents: Array<{ agentId: number; incidentId: string }>) => void
      >
    >;
    startRetentionService: ReturnType<typeof mock<() => void>>;
    notifier: {
      checkAndNotify: ReturnType<
        typeof mock<(statuses: AgentStatusInfo[]) => Promise<void>>
      >;
      removeAgent: ReturnType<typeof mock<(id: number) => void>>;
    };
    statusSync: {
      updateStatusMap: ReturnType<
        typeof mock<(statuses: AgentStatusInfo[]) => void>
      >;
      sync: ReturnType<
        typeof mock<(opts: { updateMenu: boolean }) => Promise<void>>
      >;
    };
    logger: {
      info: ReturnType<typeof mock>;
      warn: ReturnType<typeof mock>;
      debug: ReturnType<typeof mock>;
    };
    setTimeoutFn: typeof setTimeout;
    clearTimeoutFn: typeof clearTimeout;
  };

  let latestCallback: (() => void) | null = null;
  let latestTimeoutId = 0;
  let nextTimeoutId = 1;

  beforeEach(() => {
    latestCallback = null;
    latestTimeoutId = 0;
    nextTimeoutId = 1;

    deps = {
      isDaemonConfigured: mock(() => false),
      syncDataOnly: mock(() =>
        Promise.resolve({ success: false, openIncidents: [] }),
      ),
      syncAgents: mock(() => Promise.resolve(0)),
      checkAllAgentsStatus: mock(() => Promise.resolve([])),
      readAgents: mock(() => Promise.resolve([])),
      getAgentLatestCheck: mock(() => null),
      getAdvancedSettings: mock(() => ({ pollingInterval: 30000 })),
      initIncidentService: mock(() => {}),
      reconstructIncidentState: mock(() => Promise.resolve()),
      switchToDaemonMode: mock(() => {}),
      startRetentionService: mock(() => {}),
      notifier: {
        checkAndNotify: mock(() => Promise.resolve()),
        removeAgent: mock(() => {}),
      },
      statusSync: {
        updateStatusMap: mock(() => {}),
        sync: mock(() => Promise.resolve()),
      },
      logger: {
        info: mock(() => {}),
        warn: mock(() => {}),
        debug: mock(() => {}),
      },
      setTimeoutFn: mock((cb: () => void) => {
        latestCallback = cb;
        latestTimeoutId = nextTimeoutId++;
        return latestTimeoutId;
      }) as unknown as typeof setTimeout,
      clearTimeoutFn: mock((id: unknown) => {
        if (id === latestTimeoutId) {
          latestCallback = null;
          latestTimeoutId = 0;
        }
      }),
    };
  });

  function createService() {
    return createStatusCore(deps);
  }

  async function triggerNextPoll() {
    if (latestCallback) {
      const cb = latestCallback;
      await (cb as unknown as () => Promise<void>)();
    }
  }

  describe("refreshAndPush", () => {
    it("calls checkAllAgentsStatus and passes statuses to notifier and statusSync with updateMenu true by default", async () => {
      const statuses: AgentStatusInfo[] = [
        { id: 1, status: "ok", lastChecked: 123 },
      ];
      deps.checkAllAgentsStatus.mockImplementation(() =>
        Promise.resolve(statuses),
      );

      const service = createService();
      await service.refreshAndPush();

      expect(deps.checkAllAgentsStatus).toHaveBeenCalledTimes(1);
      expect(deps.notifier.checkAndNotify).toHaveBeenCalledWith(statuses);
      expect(deps.statusSync.updateStatusMap).toHaveBeenCalledWith(statuses);
      expect(deps.statusSync.sync).toHaveBeenCalledWith({ updateMenu: true });
    });

    it("calls sync with updateMenu false when passed false", async () => {
      const statuses: AgentStatusInfo[] = [
        { id: 1, status: "ok", lastChecked: 123 },
      ];
      deps.checkAllAgentsStatus.mockImplementation(() =>
        Promise.resolve(statuses),
      );

      const service = createService();
      await service.refreshAndPush(false);

      expect(deps.statusSync.sync).toHaveBeenCalledWith({ updateMenu: false });
    });
  });

  describe("isDaemonConnected", () => {
    it("returns false initially", () => {
      const service = createService();
      expect(service.isDaemonConnected()).toBe(false);
    });

    it("returns true after a successful daemon poll", async () => {
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      expect(service.isDaemonConnected()).toBe(true);
    });

    it("returns false after a failed daemon poll", async () => {
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();
      expect(service.isDaemonConnected()).toBe(true);

      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: false, openIncidents: [] }),
      );
      deps.checkAllAgentsStatus.mockImplementation(() => Promise.resolve([]));

      await triggerNextPoll();

      expect(service.isDaemonConnected()).toBe(false);
    });
  });

  describe("daemon mode", () => {
    it("success path - does not call checkAllAgentsStatus, calls notifier with synced statuses, daemonConnected flips to true", async () => {
      const agent: Agent = {
        id: 1,
        type: "http",
        name: "Agent 1",
        url: "http://localhost",
        port: 80,
      };
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([agent]));
      deps.getAgentLatestCheck.mockImplementation(() => ({
        status: "ok" as const,
        checkedAt: 12345,
        errorMessage: null,
      }));

      const service = createService();
      await service.beginStatusUpdates();

      expect(deps.checkAllAgentsStatus).not.toHaveBeenCalled();
      expect(deps.notifier.checkAndNotify).toHaveBeenCalledWith([
        {
          id: 1,
          status: "ok",
          lastChecked: 12345,
          errorMessage: undefined,
        },
      ]);
      expect(deps.statusSync.updateStatusMap).toHaveBeenCalledWith([
        {
          id: 1,
          status: "ok",
          lastChecked: 12345,
          errorMessage: undefined,
        },
      ]);
      expect(deps.statusSync.sync).toHaveBeenCalledWith({ updateMenu: true });
      expect(service.isDaemonConnected()).toBe(true);
    });

    it("maps degraded status to error in the notifier", async () => {
      const agent: Agent = {
        id: 1,
        type: "http",
        name: "Agent 1",
        url: "http://localhost",
        port: 80,
      };
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([agent]));
      deps.getAgentLatestCheck.mockImplementation(() => ({
        status: "degraded" as const,
        checkedAt: 12345,
        errorMessage: "slow",
      }));

      const service = createService();
      await service.beginStatusUpdates();

      expect(deps.notifier.checkAndNotify).toHaveBeenCalledWith([
        {
          id: 1,
          status: "error",
          lastChecked: 12345,
          errorMessage: "slow",
        },
      ]);
    });

    it("fallback - falls back to local mode when syncDataOnly fails", async () => {
      const localStatuses: AgentStatusInfo[] = [
        { id: 1, status: "ok", lastChecked: 123 },
      ];
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: false, openIncidents: [] }),
      );
      deps.checkAllAgentsStatus.mockImplementation(() =>
        Promise.resolve(localStatuses),
      );

      const service = createService();
      await service.beginStatusUpdates();

      expect(deps.checkAllAgentsStatus).toHaveBeenCalled();
      expect(deps.notifier.checkAndNotify).toHaveBeenCalledWith(localStatuses);
      expect(service.isDaemonConnected()).toBe(false);
    });
  });

  describe("daemonMode.onEnter", () => {
    it("calls syncAgents and switchToDaemonMode only if incidentServiceInitialized was true", async () => {
      deps.isDaemonConfigured.mockImplementation(() => false);
      deps.checkAllAgentsStatus.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      // First poll was local, so incidentServiceInitialized should be true
      expect(deps.initIncidentService).toHaveBeenCalledTimes(1);
      expect(deps.reconstructIncidentState).toHaveBeenCalledTimes(1);

      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({
          success: true,
          openIncidents: [{ agentId: 1, incidentId: "inc-1" }],
        }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      await triggerNextPoll();

      expect(deps.syncAgents).toHaveBeenCalled();
      expect(deps.switchToDaemonMode).toHaveBeenCalledWith([
        { agentId: 1, incidentId: "inc-1" },
      ]);
    });

    it("does not call switchToDaemonMode if incidentServiceInitialized was false", async () => {
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      // Daemon was connected from the start, so incidentServiceInitialized is false
      expect(deps.initIncidentService).not.toHaveBeenCalled();
      expect(deps.reconstructIncidentState).not.toHaveBeenCalled();
      expect(deps.syncAgents).toHaveBeenCalled();
      expect(deps.switchToDaemonMode).not.toHaveBeenCalled();
    });
  });

  describe("local mode", () => {
    it("initializes incident service exactly once on first run", async () => {
      deps.isDaemonConfigured.mockImplementation(() => false);
      deps.checkAllAgentsStatus.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      expect(deps.initIncidentService).toHaveBeenCalledTimes(1);
      expect(deps.reconstructIncidentState).toHaveBeenCalledTimes(1);

      await triggerNextPoll();

      expect(deps.initIncidentService).toHaveBeenCalledTimes(1);
      expect(deps.reconstructIncidentState).toHaveBeenCalledTimes(1);
    });

    it("logs a warning when transitioning from daemon to local", async () => {
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      expect(service.isDaemonConnected()).toBe(true);

      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: false, openIncidents: [] }),
      );
      deps.checkAllAgentsStatus.mockImplementation(() => Promise.resolve([]));

      await triggerNextPoll();

      expect(deps.logger.warn).toHaveBeenCalledWith(
        "status",
        "Daemon sync failed - falling back to local polling",
      );
    });
  });

  describe("stopStatusUpdates", () => {
    it("clears the timeout and resets statusUpdatesStarted without resetting daemonConnected", async () => {
      deps.isDaemonConfigured.mockImplementation(() => true);
      deps.syncDataOnly.mockImplementation(() =>
        Promise.resolve({ success: true, openIncidents: [] }),
      );
      deps.readAgents.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      expect(service.isDaemonConnected()).toBe(true);
      expect(latestCallback).not.toBeNull();

      service.stopStatusUpdates();

      expect(deps.clearTimeoutFn).toHaveBeenCalled();
      expect(latestCallback).toBeNull();

      // daemonConnected should NOT be reset
      expect(service.isDaemonConnected()).toBe(true);
    });
  });

  describe("beginStatusUpdates idempotency", () => {
    it("does not start a second polling loop when called twice", async () => {
      deps.isDaemonConfigured.mockImplementation(() => false);
      deps.checkAllAgentsStatus.mockImplementation(() => Promise.resolve([]));

      const service = createService();
      await service.beginStatusUpdates();

      expect(deps.setTimeoutFn).toHaveBeenCalledTimes(1);

      await service.beginStatusUpdates();

      expect(deps.setTimeoutFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeAgentStatusTracking", () => {
    it("delegates to notifier.removeAgent", () => {
      const service = createService();
      service.removeAgentStatusTracking(42);

      expect(deps.notifier.removeAgent).toHaveBeenCalledWith(42);
    });
  });
});
