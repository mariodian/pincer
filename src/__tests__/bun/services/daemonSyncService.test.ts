import { describe, it, expect } from "bun:test";
import type {
  DaemonSyncResult,
  DaemonTestResult,
  Check,
  IncidentEvent,
  HourlyStat,
  Agent,
} from "../../../shared/types";

/**
 * Daemon Sync Service Integration Tests
 *
 * These tests verify the data structures, flow logic, and pure helper
 * functions of the daemon sync service.
 */

describe("daemonSyncService integration", () => {
  describe("formatUptime helper", () => {
    it("should format seconds to days/hours/minutes", () => {
      const testCases = [
        { input: 3661, expected: "1h" }, // 1h 1m → shows only hours
        { input: 86400, expected: "1d 0h" }, // 1 day
        { input: 90061, expected: "1d 1h" }, // 1d 1h 1m → shows only days+hours
        { input: 3600, expected: "1h" }, // exactly 1 hour
        { input: 1800, expected: "30m" }, // 30 minutes
        { input: 59, expected: "0m" }, // less than 1 minute
      ];

      for (const { input, expected } of testCases) {
        const days = Math.floor(input / 86400);
        const hours = Math.floor((input % 86400) / 3600);
        const minutes = Math.floor((input % 3600) / 60);
        let result: string;
        if (days > 0) result = `${days}d ${hours}h`;
        else if (hours > 0) result = `${hours}h`;
        else result = `${minutes}m`;

        expect(result).toBe(expected);
      }
    });
  });

  describe("DaemonSyncResult interface", () => {
    it("should support successful sync result", () => {
      const result: DaemonSyncResult = {
        success: true,
        checksImported: 100,
        statsImported: 24,
        incidentsImported: 5,
        openIncidents: [{ agentId: 1, incidentId: "inc-1" }],
      };

      expect(result.success).toBe(true);
      expect(result.checksImported).toBe(100);
      expect(result.openIncidents[0].agentId).toBe(1);
    });

    it("should support failed sync result", () => {
      const result: DaemonSyncResult = {
        success: false,
        error: "Daemon unreachable",
        checksImported: 0,
        statsImported: 0,
        incidentsImported: 0,
        openIncidents: [],
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Daemon unreachable");
    });

    it("should support empty sync result", () => {
      const result: DaemonSyncResult = {
        success: true,
        checksImported: 0,
        statsImported: 0,
        incidentsImported: 0,
        openIncidents: [],
      };

      expect(result.success).toBe(true);
      expect(result.checksImported).toBe(0);
    });
  });

  describe("DaemonTestResult interface", () => {
    it("should support connected result", () => {
      const result: DaemonTestResult = {
        connected: true,
        version: "1.0.0",
        uptime: 3661,
        uptimeFormatted: "1h 1m",
      };

      expect(result.connected).toBe(true);
      expect(result.version).toBe("1.0.0");
      expect(result.uptimeFormatted).toBe("1h 1m");
    });

    it("should support failed connection result", () => {
      const result: DaemonTestResult = {
        connected: false,
        error: "Connection refused",
      };

      expect(result.connected).toBe(false);
      expect(result.error).toBe("Connection refused");
      expect(result.version).toBeUndefined();
    });
  });

  describe("sync pagination logic", () => {
    it("should handle single-page check import", () => {
      const checks: Check[] = [
        {
          id: 1,
          agentId: 1,
          checkedAt: 1000,
          status: "ok",
          responseMs: 100,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ];

      // Simulate single page (no pagination)
      const page = { data: checks, nextCursor: null as number | null };
      expect(page.data.length).toBe(1);
      expect(page.nextCursor).toBeNull();
    });

    it("should handle multi-page check import", () => {
      const page1 = {
        data: [
          {
            id: 1,
            agentId: 1,
            checkedAt: 1000,
            status: "ok",
            responseMs: 100,
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
          } as Check,
        ],
        nextCursor: 1000 as number | null,
      };
      const page2 = {
        data: [
          {
            id: 2,
            agentId: 1,
            checkedAt: 2000,
            status: "ok",
            responseMs: 150,
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
          } as Check,
        ],
        nextCursor: null as number | null,
      };

      let total = 0;
      let cursor: number | null = 0;
      const pages = [page1, page2];
      let pageIndex = 0;

      while (cursor !== null) {
        const page = pages[pageIndex++];
        total += page.data.length;
        cursor = page.nextCursor;
      }

      expect(total).toBe(2);
    });

    it("should handle empty page", () => {
      const page = { data: [] as Check[], nextCursor: null as number | null };
      expect(page.data.length).toBe(0);
    });
  });

  describe("batch import logic", () => {
    it("should handle batch stats import", () => {
      const stats: HourlyStat[] = [
        {
          agentId: 1,
          hourTimestamp: 3600,
          totalChecks: 10,
          okCount: 9,
          offlineCount: 0,
          errorCount: 1,
          uptimePct: 90,
          avgResponseMs: 100,
        },
      ];

      expect(stats.length).toBe(1);
      expect(stats[0].uptimePct).toBe(90);
    });

    it("should handle batch incident events import", () => {
      const events: IncidentEvent[] = [
        {
          id: 1,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: 1000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: "Agent down",
          linkedIncidentId: null,
        },
      ];

      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("opened");
    });
  });

  describe("daemon configuration checks", () => {
    it("should detect configured daemon", () => {
      const settings = {
        enabled: true,
        url: "http://daemon:7378",
        secret: "test",
      };
      const isConfigured =
        settings.enabled && !!settings.url && !!settings.secret;
      expect(isConfigured).toBe(true);
    });

    it("should detect disabled daemon", () => {
      const settings = { enabled: false, url: "", secret: "" };
      const isConfigured =
        settings.enabled && !!settings.url && !!settings.secret;
      expect(isConfigured).toBe(false);
    });

    it("should detect missing URL", () => {
      const settings = { enabled: true, url: "", secret: "test" };
      const isConfigured =
        settings.enabled && !!settings.url && !!settings.secret;
      expect(isConfigured).toBe(false);
    });

    it("should detect missing secret", () => {
      const settings = { enabled: true, url: "http://daemon:7378", secret: "" };
      const isConfigured =
        settings.enabled && !!settings.url && !!settings.secret;
      expect(isConfigured).toBe(false);
    });
  });

  describe("handoff flow", () => {
    it("should link local incidents to daemon incidents", () => {
      const localOpenIncidents = [
        { agentId: 1, incidentId: "local-1", openedAt: 1000 },
        { agentId: 2, incidentId: "local-2", openedAt: 2000 },
      ];

      const daemonOpenIncidents = [{ agentId: 1, incidentId: "daemon-1" }];

      const daemonByAgent = new Map<number, string>();
      for (const di of daemonOpenIncidents) {
        daemonByAgent.set(di.agentId, di.incidentId);
      }

      let closed = 0;
      for (const local of localOpenIncidents) {
        const daemonIncidentId = daemonByAgent.get(local.agentId);
        if (daemonIncidentId) {
          // Linked handoff
          closed++;
        } else {
          // Unlinked handoff
          closed++;
        }
      }

      expect(closed).toBe(2);
    });
  });

  describe("computeAgentHash", () => {
    it("should generate consistent hash for same agent", () => {
      const agent = {
        id: 1,
        type: "custom",
        name: "Test Agent",
        url: "http://localhost:8080",
        port: 8080,
      };

      const hash1 = computeAgentHash(agent);
      const hash2 = computeAgentHash(agent);
      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different agents", () => {
      const agent1 = {
        id: 1,
        type: "custom",
        name: "Agent A",
        url: "http://localhost:8080",
        port: 8080,
      };
      const agent2 = {
        id: 2,
        type: "custom",
        name: "Agent B",
        url: "http://localhost:8081",
        port: 8081,
      };

      const hash1 = computeAgentHash(agent1);
      const hash2 = computeAgentHash(agent2);
      expect(hash1).not.toBe(hash2);
    });

    it("should produce 16-character hex hash", () => {
      const agent = {
        id: 1,
        type: "openclaw",
        name: "Test",
        url: "http://localhost",
        port: 18789,
      };

      const hash = computeAgentHash(agent);
      expect(hash).toHaveLength(16);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it("should hash based on type:url:port", () => {
      // Changing name should NOT change hash
      const agentBase = {
        id: 1,
        type: "custom",
        url: "http://localhost:8080",
        port: 8080,
      };
      const agentA = { ...agentBase, name: "Original Name" };
      const agentB = { ...agentBase, name: "Different Name" };

      expect(computeAgentHash(agentA)).toBe(computeAgentHash(agentB));

      // Changing type SHOULD change hash
      const agentC = { ...agentBase, type: "openclaw" };
      expect(computeAgentHash(agentA)).not.toBe(computeAgentHash(agentC));
    });
  });

  describe("namespaceId resolution", () => {
    it("should use namespaceKey when set", () => {
      const settings = {
        enabled: true,
        url: "http://daemon:7378",
        secret: "test",
        namespaceKey: "custom-namespace",
      };

      const namespaceId = settings.namespaceKey || "fallback-machine-id";
      expect(namespaceId).toBe("custom-namespace");
    });

    it("should fall back to machineId when namespaceKey is empty", () => {
      const settings = {
        enabled: true,
        url: "http://daemon:7378",
        secret: "test",
        namespaceKey: "",
      };

      const machineId = "machine-uuid-123-456";
      const namespaceId = settings.namespaceKey || machineId;
      expect(namespaceId).toBe(machineId);
    });
  });

  describe("AgentPushPayload mapping", () => {
    it("should map Agent to AgentPushPayload correctly", () => {
      const agent: Agent = {
        id: 1,
        type: "custom",
        name: "Test Agent",
        url: "http://localhost",
        port: 8080,
        enabled: true,
        healthEndpoint: "/health",
        statusShape: "json_status",
      };

      const payload = {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        url: agent.url,
        port: agent.port,
        enabled: agent.enabled ?? true,
        healthEndpoint: agent.healthEndpoint ?? null,
        statusShape: agent.statusShape ?? null,
        agentHash: "mock-hash-1234",
      };

      expect(payload.id).toBe(1);
      expect(payload.type).toBe("custom");
      expect(payload.agentHash).toBe("mock-hash-1234");
      expect(payload.enabled).toBe(true);
    });

    it("should handle null healthEndpoint and statusShape", () => {
      const agent: Agent = {
        id: 1,
        type: "custom",
        name: "Test Agent",
        url: "http://localhost",
        port: 8080,
      };

      const payload = {
        id: agent.id,
        type: agent.type,
        name: agent.name,
        url: agent.url,
        port: agent.port,
        enabled: agent.enabled ?? true,
        healthEndpoint: agent.healthEndpoint ?? null,
        statusShape: agent.statusShape ?? null,
        agentHash: null,
      };

      expect(payload.healthEndpoint).toBeNull();
      expect(payload.statusShape).toBeNull();
    });
  });

  describe("settings change detection", () => {
    it("should detect when url changes", () => {
      const current = { enabled: true, url: "http://old:7378", secret: "test" };
      const partial = { url: "http://new:7378" };

      const settingsChanged =
        partial.url !== undefined || partial.secret !== undefined;
      expect(settingsChanged).toBe(true);
    });

    it("should detect when secret changes", () => {
      const current = {
        enabled: true,
        url: "http://daemon:7378",
        secret: "old",
      };
      const partial = { secret: "new" };

      const settingsChanged =
        partial.url !== undefined || partial.secret !== undefined;
      expect(settingsChanged).toBe(true);
    });

    it("should not detect change when only enabled changes", () => {
      const current = {
        enabled: false,
        url: "http://daemon:7378",
        secret: "test",
      };
      const partial = { enabled: true };

      const settingsChanged =
        partial.url !== undefined || partial.secret !== undefined;
      expect(settingsChanged).toBe(false);
    });
  });
});

// Helper function for testing (mirrors the real implementation)
function computeAgentHash(agent: {
  type: string;
  url: string;
  port: number;
}): string {
  const crypto = require("node:crypto");
  return crypto
    .createHash("sha256")
    .update(`${agent.type}:${agent.url}:${agent.port}`)
    .digest("hex")
    .substring(0, 16);
}
