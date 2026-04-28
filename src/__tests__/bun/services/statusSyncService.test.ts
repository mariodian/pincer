import { describe, expect, it } from "bun:test";

import { StatusSyncService } from "../../../bun/services/statusSyncService";
import type { AgentStatusInfo } from "../../../shared/types";

// ─── Factories ───────────────────────────────────────────────────────────────
function makeStatus(overrides: Partial<AgentStatusInfo> = {}): AgentStatusInfo {
  return {
    id: 1,
    status: "ok",
    lastChecked: 1000,
    ...overrides,
  };
}

function makeService() {
  return new StatusSyncService({
    getMainWindow: () => null,
    onMenuUpdate: () => {},
  });
}

/**
 * StatusSyncService Integration Tests
 *
 * These tests verify the behavior of the StatusSyncService's internal status
 * map and its handling of status updates, without requiring
 * a full Electron environment.
 */

describe("StatusSyncService", () => {
  describe("updateStatusMap", () => {
    it("should store a new agent status", () => {
      const service = makeService();
      service.updateStatusMap([makeStatus({ id: 1, status: "ok" })]);
      expect(service.getAgentStatus(1)?.status).toBe("ok");
    });

    it("should accept a newer timestamp for the same status", () => {
      const service = makeService();
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 1000 }),
      ]);
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 2000 }),
      ]);
      expect(service.getAgentStatus(1)?.lastChecked).toBe(2000);
    });

    it("should reject a stale timestamp when status is unchanged", () => {
      const service = makeService();
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 2000 }),
      ]);
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 500 }),
      ]);
      expect(service.getAgentStatus(1)?.lastChecked).toBe(2000);
    });

    it("should always accept a status change even with older timestamp", () => {
      const service = makeService();
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 2000 }),
      ]);
      service.updateStatusMap([
        makeStatus({ id: 1, status: "error", lastChecked: 500 }),
      ]);
      expect(service.getAgentStatus(1)?.status).toBe("error");
    });

    it("should update multiple agents independently", () => {
      const service = makeService();
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok" }),
        makeStatus({ id: 2, status: "offline" }),
      ]);
      expect(service.getAgentStatus(1)?.status).toBe("ok");
      expect(service.getAgentStatus(2)?.status).toBe("offline");
    });
  });

  describe("setAgentStatus", () => {
    it("should unconditionally overwrite existing status", () => {
      const service = makeService();
      service.updateStatusMap([
        makeStatus({ id: 1, status: "ok", lastChecked: 9999 }),
      ]);
      service.setAgentStatus(
        makeStatus({ id: 1, status: "error", lastChecked: 1 }),
      );
      expect(service.getAgentStatus(1)?.status).toBe("error");
      expect(service.getAgentStatus(1)?.lastChecked).toBe(1);
    });
  });

  describe("markAgentOffline", () => {
    it("should set status to offline", () => {
      const service = makeService();
      service.markAgentOffline(1);
      expect(service.getAgentStatus(1)?.status).toBe("offline");
    });

    it("should set a lastChecked timestamp", () => {
      const service = makeService();
      const before = Date.now();
      service.markAgentOffline(1);
      const after = Date.now();
      const ts = service.getAgentStatus(1)?.lastChecked ?? 0;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("should set errorMessage to undefined", () => {
      const service = makeService();
      service.markAgentOffline(1);
      expect(service.getAgentStatus(1)?.errorMessage).toBeUndefined();
    });
  });

  describe("removeAgentStatus", () => {
    it("should remove a known agent", () => {
      const service = makeService();
      service.updateStatusMap([makeStatus({ id: 1 })]);
      service.removeAgentStatus(1);
      expect(service.getAgentStatus(1)).toBeUndefined();
    });

    it("should silently do nothing for an unknown agent", () => {
      const service = makeService();
      expect(() => service.removeAgentStatus(99)).not.toThrow();
    });
  });

  describe("getAgentStatus", () => {
    it("should return undefined for unknown agent", () => {
      const service = makeService();
      expect(service.getAgentStatus(42)).toBeUndefined();
    });

    it("should return the stored status", () => {
      const service = makeService();
      service.updateStatusMap([makeStatus({ id: 5, status: "offline" })]);
      expect(service.getAgentStatus(5)?.status).toBe("offline");
    });
  });

  describe("setPopoverWindow", () => {
    it("should accept null without throwing", () => {
      const service = makeService();
      expect(() => service.setPopoverWindow(null)).not.toThrow();
    });
  });
});
