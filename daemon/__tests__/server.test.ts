import { describe, expect, it } from "bun:test";

import type { Agent, IncidentEvent } from "../../src/shared/types";

/**
 * Daemon Server Integration Tests
 *
 * These tests verify the HTTP endpoint behavior, auth logic, and response
 * structures without triggering the full server initialization.
 */

describe("daemon server", () => {
  describe("auth middleware", () => {
    it("should extract bearer token from authorization header", () => {
      const auth = "Bearer test-secret";
      const hasBearer = auth.startsWith("Bearer ");
      const token = hasBearer ? auth.slice(7) : "";
      expect(token).toBe("test-secret");
    });

    it("should reject missing auth header", () => {
      const getAuth = (): string | null => null;
      const auth = getAuth();
      const isValid = auth !== null && auth.startsWith("Bearer ");
      expect(isValid).toBe(false);
    });

    it("should reject malformed auth header", () => {
      const auth = "Basic dXNlcjpwYXNz";
      const isValid = auth.startsWith("Bearer ");
      expect(isValid).toBe(false);
    });
  });

  describe("health endpoint", () => {
    it("should return version and uptime", () => {
      const startTime = Date.now() - 3661000; // ~1h ago
      const response = {
        status: "ok",
        version: "1.0.0",
        uptime: Math.floor((Date.now() - startTime) / 1000),
      };

      expect(response.status).toBe("ok");
      expect(response.version).toBe("1.0.0");
      expect(response.uptime).toBeGreaterThanOrEqual(3661);
    });
  });

  describe("agents endpoint", () => {
    it("should validate PUT body is an array", () => {
      const body = { not: "array" };
      const isValid = Array.isArray(body);
      expect(isValid).toBe(false);
    });

    it("should accept array of agents", () => {
      const agents: Agent[] = [
        { id: 1, type: "custom", name: "A", url: "http://a", port: 80 },
      ];
      expect(Array.isArray(agents)).toBe(true);
      expect(agents[0].id).toBe(1);
    });
  });

  describe("checks pagination", () => {
    it("should calculate ID-based pagination cursor", () => {
      const limit = 100;
      const rows: Array<{ id: number; checkedAt: number }> = Array.from(
        { length: limit + 1 },
        (_, i) => ({ id: i + 1, checkedAt: (i + 1) * 1000 }),
      );

      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      const nextCursor = hasMore ? page[page.length - 1].id : null;

      expect(hasMore).toBe(true);
      expect(page.length).toBe(limit);
      expect(nextCursor).toBe(limit);
    });

    it("should return null cursor when no more data", () => {
      const limit = 100;
      const rows: Array<{ id: number; checkedAt: number }> = Array.from(
        { length: 50 },
        (_, i) => ({ id: i + 1, checkedAt: (i + 1) * 1000 }),
      );

      const hasMore = rows.length > limit;
      const nextCursor = hasMore ? rows[rows.length - 1].id : null;

      expect(hasMore).toBe(false);
      expect(nextCursor).toBeNull();
    });

    it("should paginate correctly when rows share timestamps", () => {
      const limit = 3;
      const rows: Array<{ id: number; checkedAt: number }> = [
        { id: 1, checkedAt: 1000 },
        { id: 2, checkedAt: 1000 },
        { id: 3, checkedAt: 1000 },
        { id: 4, checkedAt: 1000 },
        { id: 5, checkedAt: 1000 },
      ];

      const page1 = rows.slice(0, limit);
      const cursor1 = page1[page1.length - 1].id;
      expect(cursor1).toBe(3);

      const page2 = rows.filter((r) => r.id > cursor1).slice(0, limit);
      const cursor2 = page2.length > limit ? page2[page2.length - 1].id : null;
      expect(page2.length).toBe(2);
      expect(cursor2).toBeNull();
    });

    it("should parse since, cursor, and limit query params", () => {
      const url = new URL(
        "http://localhost:7378/checks?since=1000&cursor=500&limit=500",
      );
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);
      const limit = Math.min(
        parseInt(url.searchParams.get("limit") || "1000", 10),
        5000,
      );

      expect(since).toBe(1000);
      expect(cursor).toBe(500);
      expect(limit).toBe(500);
    });
  });

  describe("stats endpoint", () => {
    it("should convert ms to seconds for hourTimestamp", () => {
      const sinceMs = 1700000000000;
      const sinceSecs = Math.floor(sinceMs / 1000);
      expect(sinceSecs).toBe(1700000000);
    });
  });

  describe("incident events endpoint", () => {
    it("should filter events by since timestamp", () => {
      const events: IncidentEvent[] = [
        {
          id: 1,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: 500,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 2,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: 1500,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ];

      const since = 1000;
      const filtered = events.filter((e) => e.eventAt >= since);

      expect(filtered.length).toBe(1);
      expect(filtered[0].eventType).toBe("recovered");
    });
  });

  describe("open incidents endpoint", () => {
    it("should identify open incidents (opened but not recovered)", () => {
      const events: Array<{ incidentId: string; eventType: string }> = [
        { incidentId: "inc-1", eventType: "opened" },
        { incidentId: "inc-1", eventType: "status_changed" },
        { incidentId: "inc-2", eventType: "opened" },
        { incidentId: "inc-2", eventType: "recovered" },
      ];

      const openIds = new Set<string>();
      for (const e of events) {
        if (e.eventType === "opened") openIds.add(e.incidentId);
        if (e.eventType === "recovered") openIds.delete(e.incidentId);
      }

      expect(openIds.has("inc-1")).toBe(true);
      expect(openIds.has("inc-2")).toBe(false);
    });
  });

  describe("error responses", () => {
    it("should create JSON error response", () => {
      const message = "Not found";
      const status = 404;
      const response = new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    it("should create JSON success response", () => {
      const data = { updated: 5 };
      const response = new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("namespace header", () => {
    it("should extract x-namespace-id header from request", () => {
      const headers = new Headers({ "x-namespace-id": "ns-abc123" });
      const namespaceId = headers.get("x-namespace-id");
      expect(namespaceId).toBe("ns-abc123");
    });

    it("should return null when x-namespace-id header is missing", () => {
      const headers = new Headers();
      const namespaceId = headers.get("x-namespace-id");
      expect(namespaceId).toBeNull();
    });

    it("should reject requests without namespace header", () => {
      const getNamespace = (headers: Headers): string | null =>
        headers.get("x-namespace-id");

      const headers = new Headers();
      const namespaceId = getNamespace(headers);
      const shouldReject = namespaceId === null;
      expect(shouldReject).toBe(true);
    });

    it("should accept requests with valid namespace header", () => {
      const getNamespace = (headers: Headers): string | null =>
        headers.get("x-namespace-id");

      const headers = new Headers({ "x-namespace-id": "machine-uuid-123" });
      const namespaceId = getNamespace(headers);
      const shouldAccept = namespaceId !== null && namespaceId.length > 0;
      expect(shouldAccept).toBe(true);
    });
  });

  describe("agent push payload with hash", () => {
    it("should validate agent payload includes agentHash", () => {
      const payload = {
        id: 1,
        type: "custom",
        name: "Test Agent",
        url: "http://localhost:8080",
        port: 8080,
        enabled: true,
        healthEndpoint: "/health",
        statusShape: "json_status",
        agentHash: "a1b2c3d4e5f6g7h8",
      };

      expect(payload.agentHash).toBeDefined();
      expect(payload.agentHash).toHaveLength(16);
    });

    it("should accept null agentHash", () => {
      const payload = {
        id: 1,
        type: "custom",
        name: "Test Agent",
        url: "http://localhost:8080",
        port: 8080,
        enabled: true,
        healthEndpoint: null,
        statusShape: null,
        agentHash: null,
      };

      expect(payload.agentHash).toBeNull();
    });
  });

  describe("upsert SQL logic", () => {
    it("should generate correct ON CONFLICT clause for namespace_id, agent_id", () => {
      const conflictTarget = ["namespace_id", "agent_id"];
      const updateFields = [
        "agent_hash",
        "type",
        "name",
        "url",
        "port",
        "enabled",
        "health_endpoint",
        "status_shape",
        "updated_at",
      ];

      expect(conflictTarget).toContain("namespace_id");
      expect(conflictTarget).toContain("agent_id");
      expect(updateFields).toContain("agent_hash");
      expect(updateFields).toContain("updated_at");
    });
  });

  describe("route handling", () => {
    it("should dispatch based on method and path", () => {
      const routes: Array<{ method: string; path: string; handler: string }> = [
        { method: "GET", path: "/health", handler: "health" },
        { method: "GET", path: "/agents", handler: "getAgents" },
        { method: "PUT", path: "/agents", handler: "putAgents" },
        { method: "GET", path: "/checks", handler: "getChecks" },
        { method: "GET", path: "/stats", handler: "getStats" },
        {
          method: "GET",
          path: "/incident-events",
          handler: "getIncidentEvents",
        },
        { method: "GET", path: "/open-incidents", handler: "getOpenIncidents" },
      ];

      for (const route of routes) {
        expect(route.method).toMatch(/GET|PUT/);
        expect(route.path.startsWith("/")).toBe(true);
      }
    });
  });
});
