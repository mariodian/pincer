import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createRetentionService } from "../../../bun/services/retentionCore";

describe("retentionService", () => {
  const NOW = 1_000_000_000_000;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const ONE_HOUR_MS = 60 * 60 * 1000;

  let deps: {
    countOldChecks: ReturnType<typeof mock<(cutoffMs: number) => number>>;
    deleteOldChecks: ReturnType<typeof mock<(cutoffMs: number) => number>>;
    countOldEvents: ReturnType<typeof mock<(cutoffMs: number) => number>>;
    deleteOldEvents: ReturnType<typeof mock<(cutoffMs: number) => number>>;
    getRetentionDays: ReturnType<typeof mock<() => number>>;
    logger: {
      debug: ReturnType<typeof mock>;
      info: ReturnType<typeof mock>;
      error: ReturnType<typeof mock>;
    };
    setIntervalFn: ReturnType<typeof mock<typeof setInterval>>;
    clearIntervalFn: ReturnType<typeof mock<typeof clearInterval>>;
  };

  beforeEach(() => {
    deps = {
      countOldChecks: mock(() => 0),
      deleteOldChecks: mock(() => 0),
      countOldEvents: mock(() => 0),
      deleteOldEvents: mock(() => 0),
      getRetentionDays: mock(() => 30),
      logger: {
        debug: mock(() => {}),
        info: mock(() => {}),
        error: mock(() => {}),
      },
      setIntervalFn: mock(() => 123 as unknown as NodeJS.Timeout),
      clearIntervalFn: mock(() => {}),
    };
  });

  function createService() {
    return createRetentionService({
      ...deps,
      now: () => NOW,
    });
  }

  describe("runRetentionCleanup", () => {
    it("should return 0 and skip deletion when no old checks exist", () => {
      deps.countOldChecks.mockImplementation(() => 0);

      const service = createService();
      const result = service.runRetentionCleanup();

      expect(result).toBe(0);
      expect(deps.deleteOldChecks).not.toHaveBeenCalled();
    });

    it("should delete old checks and return the deleted count", () => {
      deps.countOldChecks.mockImplementation(() => 10);
      deps.deleteOldChecks.mockImplementation(() => 10);

      const service = createService();
      const result = service.runRetentionCleanup();

      expect(result).toBe(10);
      expect(deps.deleteOldChecks).toHaveBeenCalledTimes(1);
    });

    it("should pass a cutoff timestamp based on 7-day retention", () => {
      deps.countOldChecks.mockImplementation(() => 5);
      deps.deleteOldChecks.mockImplementation(() => 5);

      const service = createService();
      service.runRetentionCleanup();

      expect(deps.countOldChecks).toHaveBeenCalledWith(NOW - SEVEN_DAYS_MS);
      expect(deps.deleteOldChecks).toHaveBeenCalledWith(NOW - SEVEN_DAYS_MS);
    });
  });

  describe("runIncidentRetentionCleanup", () => {
    it("should return 0 and skip deletion when no old events exist", () => {
      deps.countOldEvents.mockImplementation(() => 0);

      const service = createService();
      const result = service.runIncidentRetentionCleanup(30);

      expect(result).toBe(0);
      expect(deps.deleteOldEvents).not.toHaveBeenCalled();
    });

    it("should delete old incident events and return the deleted count", () => {
      deps.countOldEvents.mockImplementation(() => 7);
      deps.deleteOldEvents.mockImplementation(() => 7);

      const service = createService();
      const result = service.runIncidentRetentionCleanup(30);

      expect(result).toBe(7);
      expect(deps.deleteOldEvents).toHaveBeenCalledTimes(1);
    });

    it("should compute cutoff based on the provided retentionDays", () => {
      deps.countOldEvents.mockImplementation(() => 3);
      deps.deleteOldEvents.mockImplementation(() => 3);

      const service = createService();
      service.runIncidentRetentionCleanup(14);

      const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
      expect(deps.countOldEvents).toHaveBeenCalledWith(NOW - fourteenDaysMs);
      expect(deps.deleteOldEvents).toHaveBeenCalledWith(NOW - fourteenDaysMs);
    });

    it("should use provided retentionDays instead of getRetentionDays", () => {
      deps.countOldEvents.mockImplementation(() => 1);
      deps.deleteOldEvents.mockImplementation(() => 1);

      const service = createService();
      service.runIncidentRetentionCleanup(60);

      const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
      expect(deps.countOldEvents).toHaveBeenCalledWith(NOW - sixtyDaysMs);
      expect(deps.getRetentionDays).not.toHaveBeenCalled();
    });
  });

  describe("getRetentionConfig", () => {
    it("should return hardcoded 7-day check retention config", () => {
      const service = createService();
      const config = service.getRetentionConfig();

      expect(config.retentionDays).toBe(7);
      expect(config.retentionMs).toBe(SEVEN_DAYS_MS);
    });

    it("should return 1-hour cleanup interval", () => {
      const service = createService();
      const config = service.getRetentionConfig();

      expect(config.intervalMs).toBe(ONE_HOUR_MS);
    });
  });

  describe("triggerManualCleanup", () => {
    it("should delegate to runRetentionCleanup and return its count", () => {
      deps.countOldChecks.mockImplementation(() => 3);
      deps.deleteOldChecks.mockImplementation(() => 3);

      const service = createService();
      const result = service.triggerManualCleanup();

      expect(result).toBe(3);
      expect(deps.countOldChecks).toHaveBeenCalledTimes(1);
      expect(deps.deleteOldChecks).toHaveBeenCalledTimes(1);
    });
  });

  describe("startRetentionService", () => {
    it("should run startup cleanup once", () => {
      deps.countOldChecks.mockImplementation(() => 5);
      deps.deleteOldChecks.mockImplementation(() => 5);
      deps.countOldEvents.mockImplementation(() => 2);
      deps.deleteOldEvents.mockImplementation(() => 2);

      const service = createService();
      service.startRetentionService();

      expect(deps.countOldChecks).toHaveBeenCalledTimes(1);
      expect(deps.deleteOldChecks).toHaveBeenCalledTimes(1);
      expect(deps.countOldEvents).toHaveBeenCalledTimes(1);
      expect(deps.deleteOldEvents).toHaveBeenCalledTimes(1);
    });

    it("should not duplicate scheduling when started a second time", () => {
      deps.countOldChecks.mockImplementation(() => 0);
      deps.countOldEvents.mockImplementation(() => 0);

      const service = createService();
      service.startRetentionService();
      service.startRetentionService();

      expect(deps.setIntervalFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopRetentionService", () => {
    it("should be callable without error even when service was never started", () => {
      const service = createService();
      expect(() => service.stopRetentionService()).not.toThrow();
    });

    it("should be idempotent when called multiple times", () => {
      deps.countOldChecks.mockImplementation(() => 0);
      deps.countOldEvents.mockImplementation(() => 0);

      const service = createService();
      service.startRetentionService();
      service.stopRetentionService();
      service.stopRetentionService();

      expect(deps.clearIntervalFn).toHaveBeenCalledTimes(1);
    });
  });
});
