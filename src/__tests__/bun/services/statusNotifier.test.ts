import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { AgentStatusInfo } from "../../../shared/types";

const mockGetNotificationSettings = mock(() => ({
  notificationsEnabled: true,
  notifyOnStatusChange: true,
  notifyOnError: true,
  statusChangeThreshold: 2,
  silentNotifications: false,
  failureThreshold: 3,
  recoveryThreshold: 2,
}));

const mockReadAgents = mock(() =>
  Promise.resolve<{ id: number; name: string }[]>([]),
);
const mockShowNotification = mock(() => {});
const mockLoggerInfo = mock(() => {});
const mockLoggerDebug = mock(() => {});
const mockLoggerWarn = mock(() => {});
const mockLoggerError = mock(() => {});

mock.module("../../../bun/storage/sqlite/settingsNotificationsRepo", () => ({
  getNotificationSettings: mockGetNotificationSettings,
}));

mock.module("../../../bun/services/agentService", () => ({
  readAgents: mockReadAgents,
}));

mock.module("electrobun/bun", () => ({
  Utils: { showNotification: mockShowNotification },
}));

mock.module("../../../bun/services/loggerService", () => ({
  logger: {
    info: mockLoggerInfo,
    debug: mockLoggerDebug,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

const { buildNotificationMessage, StatusNotifier } =
  await import("../../../bun/services/statusNotifier");

describe("StatusNotifier", () => {
  let notifier: InstanceType<typeof StatusNotifier>;

  beforeEach(() => {
    notifier = new StatusNotifier();
    mockGetNotificationSettings.mockClear();
    mockReadAgents.mockClear();
    mockShowNotification.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerDebug.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
  });

  function makeAgent(id: number, name: string) {
    return { id, name };
  }

  function makeStatus(
    id: number,
    status: "ok" | "offline" | "error",
  ): AgentStatusInfo {
    return { id, status, lastChecked: Date.now() };
  }

  describe("checkAndNotify", () => {
    it("should not notify on first poll (establishes baseline only)", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1")]),
      );

      await notifier.checkAndNotify([makeStatus(1, "ok")]);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it("should notify when threshold is reached", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1")]),
      );

      // Poll 1: establish baseline
      await notifier.checkAndNotify([makeStatus(1, "ok")]);
      expect(mockShowNotification).not.toHaveBeenCalled();

      // Poll 2: deviation starts (pollsInNewState = 1)
      await notifier.checkAndNotify([makeStatus(1, "offline")]);
      expect(mockShowNotification).not.toHaveBeenCalled();

      // Poll 3: threshold reached (pollsInNewState = 2 >= threshold = 2)
      await notifier.checkAndNotify([makeStatus(1, "offline")]);
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: "Agent Offline",
        body: "Agent 1 is now offline",
        silent: false,
      });
    });

    it("should not notify when agent recovers to original baseline before threshold", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1")]),
      );

      // Poll 1: baseline = ok
      await notifier.checkAndNotify([makeStatus(1, "ok")]);

      // Poll 2: deviation (pollsInNewState = 1)
      await notifier.checkAndNotify([makeStatus(1, "offline")]);
      expect(mockShowNotification).not.toHaveBeenCalled();

      // Poll 3: recovery to original baseline
      await notifier.checkAndNotify([makeStatus(1, "ok")]);
      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it("should handle mid-pending status change by resetting counter and switching group", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1"), makeAgent(2, "Agent 2")]),
      );

      // Poll 1: baselines = ok
      await notifier.checkAndNotify([makeStatus(1, "ok"), makeStatus(2, "ok")]);

      // Poll 2: both deviate to error
      await notifier.checkAndNotify([
        makeStatus(1, "error"),
        makeStatus(2, "error"),
      ]);
      expect(mockShowNotification).not.toHaveBeenCalled();

      // Poll 3: Agent 1 changes to offline mid-pending (resets counter to 1)
      // Agent 2 stays at error (counter = 2, threshold reached)
      await notifier.checkAndNotify([
        makeStatus(1, "offline"),
        makeStatus(2, "error"),
      ]);

      // Only Agent 2 should fire because it reached threshold
      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: "Agent Error",
        body: "Agent 2 encountered error",
        silent: false,
      });
    });

    it("should batch notify all agents in a group when any reaches threshold", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1"), makeAgent(2, "Agent 2")]),
      );

      // Poll 1: baselines = ok
      await notifier.checkAndNotify([makeStatus(1, "ok"), makeStatus(2, "ok")]);

      // Poll 2: Agent 1 deviates (pollsInNewState = 1)
      await notifier.checkAndNotify([
        makeStatus(1, "offline"),
        makeStatus(2, "ok"),
      ]);

      // Poll 3: Agent 2 joins the offline group (pollsInNewState = 1)
      // Agent 1 reaches threshold (pollsInNewState = 2)
      // Both fire together
      await notifier.checkAndNotify([
        makeStatus(1, "offline"),
        makeStatus(2, "offline"),
      ]);

      expect(mockShowNotification).toHaveBeenCalledTimes(1);
      expect(mockShowNotification).toHaveBeenCalledWith({
        title: "Agents Offline",
        body: "2 agents are now offline",
        silent: false,
      });
    });

    it("should not notify when notifications are disabled", async () => {
      mockGetNotificationSettings.mockImplementation(() => ({
        notificationsEnabled: false,
        notifyOnStatusChange: true,
        notifyOnError: true,
        statusChangeThreshold: 1,
        silentNotifications: false,
        failureThreshold: 3,
        recoveryThreshold: 2,
      }));

      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1")]),
      );

      // Even with threshold = 1, notifications are disabled
      await notifier.checkAndNotify([makeStatus(1, "ok")]);
      await notifier.checkAndNotify([makeStatus(1, "offline")]);

      expect(mockShowNotification).not.toHaveBeenCalled();
    });

    it("should remove agent from tracking when removeAgent is called", async () => {
      mockReadAgents.mockImplementation(() =>
        Promise.resolve([makeAgent(1, "Agent 1")]),
      );

      // Poll 1: baseline = ok
      await notifier.checkAndNotify([makeStatus(1, "ok")]);

      // Poll 2: deviation
      await notifier.checkAndNotify([makeStatus(1, "offline")]);

      // Remove agent
      notifier.removeAgent(1);

      // Poll 3: should be treated as first poll again
      await notifier.checkAndNotify([makeStatus(1, "offline")]);

      // No notification because it's treated as first poll after removal
      expect(mockShowNotification).not.toHaveBeenCalled();
    });
  });

  describe("buildNotificationMessage", () => {
    it("should build single-agent offline message", () => {
      const result = buildNotificationMessage("offline", [
        { agentId: 1, agentName: "Alpha", newStatus: "offline" },
      ]);
      expect(result).toEqual({
        title: "Agent Offline",
        body: "Alpha is now offline",
      });
    });

    it("should build single-agent error message", () => {
      const result = buildNotificationMessage("error", [
        { agentId: 1, agentName: "Beta", newStatus: "error" },
      ]);
      expect(result).toEqual({
        title: "Agent Error",
        body: "Beta encountered error",
      });
    });

    it("should build single-agent ok message", () => {
      const result = buildNotificationMessage("ok", [
        { agentId: 1, agentName: "Gamma", newStatus: "ok" },
      ]);
      expect(result).toEqual({
        title: "Agent Ok",
        body: "Gamma is now ok",
      });
    });

    it("should build multi-agent offline message", () => {
      const result = buildNotificationMessage("offline", [
        { agentId: 1, agentName: "Alpha", newStatus: "offline" },
        { agentId: 2, agentName: "Beta", newStatus: "offline" },
      ]);
      expect(result).toEqual({
        title: "Agents Offline",
        body: "2 agents are now offline",
      });
    });

    it("should build multi-agent error message", () => {
      const result = buildNotificationMessage("error", [
        { agentId: 1, agentName: "Alpha", newStatus: "error" },
        { agentId: 2, agentName: "Beta", newStatus: "error" },
        { agentId: 3, agentName: "Gamma", newStatus: "error" },
      ]);
      expect(result).toEqual({
        title: "Agents Error",
        body: "3 agents encountered error",
      });
    });

    it("should build multi-agent ok message", () => {
      const result = buildNotificationMessage("ok", [
        { agentId: 1, agentName: "Alpha", newStatus: "ok" },
        { agentId: 2, agentName: "Beta", newStatus: "ok" },
      ]);
      expect(result).toEqual({
        title: "Agents Ok",
        body: "2 agents are now ok",
      });
    });

    it("should capitalize status word", () => {
      const result = buildNotificationMessage("offline", [
        { agentId: 1, agentName: "X", newStatus: "offline" },
      ]);
      expect(result.title).toBe("Agent Offline");
    });
  });
});
