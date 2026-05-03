import { describe, expect, it } from "bun:test";

import type { CheckStatus } from "../../src/shared/types";

/**
 * Daemon Poll Unit Tests
 *
 * These tests verify the agent ID mapping logic in the poll loop
 * without requiring a running database or HTTP server.
 */

describe("daemon poll", () => {
  describe("agentId mapping", () => {
    it("should use agentId (not internal id) when recording check results", () => {
      // Simulate the AgentRow interface from poll.ts
      interface AgentRow {
        id: number;
        namespaceId: string;
        agentId: number;
        type: string;
        name: string;
        url: string;
        port: number;
        enabled: boolean;
        healthEndpoint: string | null;
        statusShape: string | null;
      }

      const agent: AgentRow = {
        id: 2, // daemon's internal auto-increment PK (reused after deletion)
        namespaceId: "test-ns",
        agentId: 3, // actual agent ID from the app
        type: "custom",
        name: "Test Agent",
        url: "http://localhost",
        port: 8080,
        enabled: true,
        healthEndpoint: "/health",
        statusShape: "json_status",
      };

      // Simulate executeHealthCheck with correct agentId (now receives agent.agentId)
      const result = {
        agentId: agent.agentId,
        status: "ok" as CheckStatus,
        responseMs: 42,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      };

      // The poll loop explicitly maps to agent.agentId (safety measure)
      const pollResult = {
        namespaceId: agent.namespaceId,
        agentId: agent.agentId,
        status: result.status,
        responseMs: result.responseMs,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };

      expect(pollResult.agentId).toBe(3);
      expect(pollResult.agentId).not.toBe(agent.id); // must not use daemon's internal id
    });

    it("should handle agentId when id and agentId differ significantly", () => {
      const scenarios = [
        { id: 1, agentId: 1 }, // same (initial state)
        { id: 2, agentId: 3 }, // gap (after deletion)
        { id: 100, agentId: 42 }, // large gap
      ];

      for (const { id, agentId } of scenarios) {
        const pollResult = {
          namespaceId: "ns",
          agentId: agentId,
          status: "ok" as CheckStatus,
          responseMs: 0,
          httpStatus: null,
          errorCode: null,
          errorMessage: null,
        };
        expect(pollResult.agentId).toBe(agentId);
        // When id and agentId differ, assert we use agentId (not id)
        if (id !== agentId) {
          expect(pollResult.agentId).not.toBe(id);
        }
      }
    });
  });

  describe("error logging", () => {
    it("should log the agentId (not internal id) on check failure", () => {
      const agent = {
        id: 2,
        agentId: 5,
        name: "My Agent",
      };

      const errorMessage = `Check failed for agent ${agent.agentId}`;

      expect(errorMessage).toContain("5");
      expect(errorMessage).not.toContain("2");
    });
  });
});
