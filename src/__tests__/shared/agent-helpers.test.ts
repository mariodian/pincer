import { describe, expect, it } from "bun:test";

import {
  createAgentSyncSignature,
  getAgentColor,
  getStatusPriority,
  HEALTH_AFFECTING_FIELDS,
  isPrivateOrInternalNetwork,
  mergeAgentsWithStatuses,
  normalizeUrl,
  shouldTriggerHealthCheck,
  sortAgentsByStatus,
} from "../../shared/agent-helpers";
import type {
  Agent,
  AgentStatus,
  AgentStatusInfo,
  Status,
} from "../../shared/types";

describe("agent-helpers", () => {
  describe("normalizeUrl", () => {
    it("should add http:// to bare hostname", () => {
      expect(normalizeUrl("example.com")).toBe("http://example.com");
    });

    it("should preserve http:// prefix", () => {
      expect(normalizeUrl("http://example.com")).toBe("http://example.com");
    });

    it("should preserve https:// prefix", () => {
      expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    });

    it("should strip trailing slashes", () => {
      expect(normalizeUrl("http://example.com/")).toBe("http://example.com");
      expect(normalizeUrl("http://example.com///")).toBe("http://example.com");
    });

    it("should trim whitespace", () => {
      expect(normalizeUrl("  example.com  ")).toBe("http://example.com");
    });

    it("should handle localhost", () => {
      expect(normalizeUrl("localhost")).toBe("http://localhost");
      expect(normalizeUrl("localhost:8080")).toBe("http://localhost:8080");
    });
  });

  describe("isPrivateOrInternalNetwork", () => {
    it("should detect localhost", () => {
      expect(isPrivateOrInternalNetwork("http://localhost:8080")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://127.0.0.1:3000")).toBe(true);
      // IPv6 literal [::1] is parsed as "[::1]" by URL, so it's not matched
    });

    it("should detect .local domains", () => {
      expect(isPrivateOrInternalNetwork("http://myagent.local")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://myagent.local:8080")).toBe(
        true,
      );
    });

    it("should detect 10.x.x.x range", () => {
      expect(isPrivateOrInternalNetwork("http://10.0.0.1")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://10.255.255.255:8080")).toBe(
        true,
      );
    });

    it("should detect 172.16-31.x.x range", () => {
      expect(isPrivateOrInternalNetwork("http://172.16.0.1")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://172.31.255.255")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://172.15.0.1")).toBe(false);
      expect(isPrivateOrInternalNetwork("http://172.32.0.1")).toBe(false);
    });

    it("should detect 192.168.x.x range", () => {
      expect(isPrivateOrInternalNetwork("http://192.168.0.1")).toBe(true);
      expect(isPrivateOrInternalNetwork("http://192.168.255.255")).toBe(true);
    });

    it("should return false for public IPs", () => {
      expect(isPrivateOrInternalNetwork("http://8.8.8.8")).toBe(false);
      expect(isPrivateOrInternalNetwork("https://example.com")).toBe(false);
    });

    it("should return false for invalid URLs", () => {
      expect(isPrivateOrInternalNetwork("not-a-url")).toBe(false);
    });
  });

  describe("getStatusPriority", () => {
    it("should return 0 for ok", () => {
      expect(getStatusPriority("ok")).toBe(0);
    });

    it("should return 2 for offline", () => {
      expect(getStatusPriority("offline")).toBe(2);
    });

    it("should return 1 for error", () => {
      expect(getStatusPriority("error")).toBe(1);
    });
  });

  describe("mergeAgentsWithStatuses", () => {
    it("should merge agents with their statuses", () => {
      const agents: Agent[] = [
        { id: 1, type: "custom", name: "A", url: "http://a", port: 80 },
        { id: 2, type: "custom", name: "B", url: "http://b", port: 80 },
      ];
      const statuses: AgentStatusInfo[] = [
        { id: 1, status: "ok", lastChecked: 1000 },
        { id: 2, status: "error", lastChecked: 2000, errorMessage: "fail" },
      ];

      const merged = mergeAgentsWithStatuses(agents, statuses);

      expect(merged[0].status).toBe("ok");
      expect(merged[1].status).toBe("error");
      expect(merged[1].errorMessage).toBe("fail");
    });

    it("should default missing status to offline", () => {
      const agents: Agent[] = [
        { id: 1, type: "custom", name: "A", url: "http://a", port: 80 },
      ];
      const statuses: AgentStatusInfo[] = [];

      const merged = mergeAgentsWithStatuses(agents, statuses);

      expect(merged[0].status).toBe("offline");
      expect(merged[0].lastChecked).toBe(0);
    });
  });

  describe("sortAgentsByStatus", () => {
    it("should sort enabled agents first", () => {
      const agents = [
        { id: 1, name: "A", enabled: false, status: "ok" as Status },
        { id: 2, name: "B", enabled: true, status: "ok" as Status },
      ];

      const sorted = sortAgentsByStatus(agents);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });

    it("should sort by status priority within same enabled state", () => {
      const agents = [
        { id: 1, name: "A", enabled: true, status: "offline" as Status },
        { id: 2, name: "B", enabled: true, status: "ok" as Status },
        { id: 3, name: "C", enabled: true, status: "error" as Status },
      ];

      const sorted = sortAgentsByStatus(agents);
      expect(sorted[0].status).toBe("ok");
      expect(sorted[1].status).toBe("error");
      expect(sorted[2].status).toBe("offline");
    });

    it("should sort alphabetically by name as final tiebreaker", () => {
      const agents = [
        { id: 1, name: "Z", enabled: true, status: "ok" as Status },
        { id: 2, name: "A", enabled: true, status: "ok" as Status },
        { id: 3, name: "M", enabled: true, status: "ok" as Status },
      ];

      const sorted = sortAgentsByStatus(agents);
      expect(sorted[0].name).toBe("A");
      expect(sorted[1].name).toBe("M");
      expect(sorted[2].name).toBe("Z");
    });
  });

  describe("shouldTriggerHealthCheck", () => {
    it("should return true for health-affecting fields", () => {
      expect(shouldTriggerHealthCheck({ url: "new" })).toBe(true);
      expect(shouldTriggerHealthCheck({ port: 8080 })).toBe(true);
      expect(shouldTriggerHealthCheck({ healthEndpoint: "/health" })).toBe(
        true,
      );
      expect(shouldTriggerHealthCheck({ statusShape: "json_status" })).toBe(
        true,
      );
      expect(shouldTriggerHealthCheck({ type: "openclaw" })).toBe(true);
    });

    it("should return false for non-health-affecting fields", () => {
      expect(shouldTriggerHealthCheck({ name: "New Name" })).toBe(false);
      expect(shouldTriggerHealthCheck({ enabled: false })).toBe(false);
    });

    it("should return true if any field in the update is health-affecting", () => {
      expect(shouldTriggerHealthCheck({ name: "New", port: 8080 })).toBe(true);
    });
  });

  describe("createAgentSyncSignature", () => {
    it("should create a stable signature for identical agent lists", () => {
      const agents: AgentStatus[] = [
        {
          id: 2,
          type: "custom",
          name: "B",
          url: "http://b",
          port: 80,
          status: "ok",
          lastChecked: 100,
        },
        {
          id: 1,
          type: "custom",
          name: "A",
          url: "http://a",
          port: 80,
          status: "ok",
          lastChecked: 200,
        },
      ];

      const sig1 = createAgentSyncSignature(agents);
      const sig2 = createAgentSyncSignature([...agents].reverse());

      expect(sig1).toBe(sig2);
    });

    it("should ignore lastChecked field", () => {
      const agents: AgentStatus[] = [
        {
          id: 1,
          type: "custom",
          name: "A",
          url: "http://a",
          port: 80,
          status: "ok",
          lastChecked: 100,
        },
      ];

      const sig1 = createAgentSyncSignature(agents);
      agents[0].lastChecked = 999;
      const sig2 = createAgentSyncSignature(agents);

      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different statuses", () => {
      const agents1: AgentStatus[] = [
        {
          id: 1,
          type: "custom",
          name: "A",
          url: "http://a",
          port: 80,
          status: "ok",
          lastChecked: 100,
        },
      ];
      const agents2: AgentStatus[] = [
        {
          id: 1,
          type: "custom",
          name: "A",
          url: "http://a",
          port: 80,
          status: "error",
          lastChecked: 100,
        },
      ];

      expect(createAgentSyncSignature(agents1)).not.toBe(
        createAgentSyncSignature(agents2),
      );
    });
  });

  describe("getAgentColor", () => {
    it("should return a deterministic color for the same name", () => {
      const c1 = getAgentColor("MyAgent", 0);
      const c2 = getAgentColor("MyAgent", 0);
      expect(c1).toBe(c2);
    });

    it("should return different colors for different names", () => {
      const c1 = getAgentColor("AgentA", 0);
      const c2 = getAgentColor("AgentB", 0);
      expect(c1).not.toBe(c2);
    });

    it("should return an oklch color string", () => {
      const color = getAgentColor("Test", 0);
      expect(color).toMatch(/^oklch\(/);
    });
  });

  describe("HEALTH_AFFECTING_FIELDS", () => {
    it("should contain the expected fields", () => {
      expect(HEALTH_AFFECTING_FIELDS).toContain("url");
      expect(HEALTH_AFFECTING_FIELDS).toContain("port");
      expect(HEALTH_AFFECTING_FIELDS).toContain("healthEndpoint");
      expect(HEALTH_AFFECTING_FIELDS).toContain("statusShape");
      expect(HEALTH_AFFECTING_FIELDS).toContain("type");
    });
  });
});
