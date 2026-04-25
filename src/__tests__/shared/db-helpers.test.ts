import { describe, it, expect } from "bun:test";
import { rowToCheck, rowToIncidentEvent } from "../../shared/db-helpers";
import type { Check, IncidentEvent } from "../../shared/types";

describe("db-helpers", () => {
  describe("rowToCheck", () => {
    it("should convert row with number checkedAt", () => {
      const row = {
        id: 1,
        agentId: 2,
        checkedAt: 1700000000000,
        status: "ok",
        responseMs: 100,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      };

      const check = rowToCheck(row);
      expect(check.checkedAt).toBe(1700000000000);
      expect(check.status).toBe("ok");
    });

    it("should convert row with Date checkedAt", () => {
      const date = new Date("2024-01-01T00:00:00.000Z");
      const row = {
        id: 1,
        agentId: 2,
        checkedAt: date,
        status: "error",
        responseMs: null,
        httpStatus: 500,
        errorCode: "TIMEOUT",
        errorMessage: "Request timed out",
      };

      const check = rowToCheck(row);
      expect(check.checkedAt).toBe(date.getTime());
    });

    it("should preserve all fields", () => {
      const row = {
        id: 42,
        agentId: 7,
        checkedAt: 1000,
        status: "offline",
        responseMs: 0,
        httpStatus: null,
        errorCode: "CONN_REFUSED",
        errorMessage: "Connection refused",
      };

      const check = rowToCheck(row);
      expect(check.id).toBe(42);
      expect(check.agentId).toBe(7);
      expect(check.responseMs).toBe(0);
      expect(check.httpStatus).toBeNull();
      expect(check.errorCode).toBe("CONN_REFUSED");
      expect(check.errorMessage).toBe("Connection refused");
    });

    it("should cast status string to CheckStatus type", () => {
      const row = {
        id: 1,
        agentId: 1,
        checkedAt: 0,
        status: "degraded",
        responseMs: 50,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      };

      const check: Check = rowToCheck(row);
      expect(check.status).toBe("degraded");
    });
  });

  describe("rowToIncidentEvent", () => {
    it("should convert row with number eventAt", () => {
      const row = {
        id: 1,
        agentId: 2,
        incidentId: "inc-1",
        eventAt: 1700000000000,
        eventType: "opened",
        fromStatus: null,
        toStatus: "offline",
        reason: "Agent unreachable",
        linkedIncidentId: null,
      };

      const event = rowToIncidentEvent(row);
      expect(event.eventAt).toBe(1700000000000);
      expect(event.eventType).toBe("opened");
    });

    it("should convert row with Date eventAt", () => {
      const date = new Date("2024-01-01T00:00:00.000Z");
      const row = {
        id: 1,
        agentId: 2,
        incidentId: "inc-1",
        eventAt: date,
        eventType: "recovered",
        fromStatus: "offline",
        toStatus: "ok",
        reason: "Agent recovered",
        linkedIncidentId: "d-123",
      };

      const event = rowToIncidentEvent(row);
      expect(event.eventAt).toBe(date.getTime());
    });

    it("should handle undefined linkedIncidentId", () => {
      const row = {
        id: 1,
        agentId: 2,
        incidentId: "inc-1",
        eventAt: 0,
        eventType: "handoff",
        fromStatus: null,
        toStatus: null,
        reason: null,
        linkedIncidentId: undefined,
      };

      const event: IncidentEvent = rowToIncidentEvent(row);
      expect(event.linkedIncidentId).toBeNull();
    });

    it("should handle explicit null linkedIncidentId", () => {
      const row = {
        id: 1,
        agentId: 2,
        incidentId: "inc-1",
        eventAt: 0,
        eventType: "status_changed",
        fromStatus: "offline",
        toStatus: "error",
        reason: "Status degraded",
        linkedIncidentId: null,
      };

      const event = rowToIncidentEvent(row);
      expect(event.fromStatus).toBe("offline");
      expect(event.toStatus).toBe("error");
      expect(event.linkedIncidentId).toBeNull();
    });
  });
});
