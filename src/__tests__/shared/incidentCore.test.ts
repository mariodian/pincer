import { describe, it, expect } from "bun:test";
import {
  createIncidentTracker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
} from "../../shared/incidentCore";
import { createMockIncidentDeps } from "../setup";

describe("incidentCore", () => {
  describe("createIncidentTracker", () => {
    describe("recordCheck — state machine", () => {
      it("should not open an incident on a single non-OK check", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        expect(tracker.hasOpenIncident(1)).toBe(false);
        expect(deps._events.length).toBe(0);
      });

      it("should open an incident after failureThreshold consecutive non-OK checks", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");

        expect(tracker.hasOpenIncident(1)).toBe(true);
        expect(deps._events.length).toBe(1);
        expect(deps._events[0].eventType).toBe("opened");
        expect(deps._events[0].fromStatus).toBeNull();
        expect(deps._events[0].toStatus).toBe("offline");
      });

      it("should reset failure counter on an OK check", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "offline");

        expect(tracker.hasOpenIncident(1)).toBe(false);
      });

      it("should recover an incident after recoveryThreshold consecutive OK checks", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        // Open incident
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        expect(tracker.hasOpenIncident(1)).toBe(true);

        // Recover
        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "ok");

        expect(tracker.hasOpenIncident(1)).toBe(false);
        expect(deps._events.length).toBe(2);
        expect(deps._events[1].eventType).toBe("recovered");
        expect(deps._events[1].fromStatus).toBe("offline");
        expect(deps._events[1].toStatus).toBe("ok");
      });

      it("should record status_changed when non-OK status changes within an open incident", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // incident opened
        tracker.recordCheck(1, "error"); // status changed

        expect(deps._events.length).toBe(2);
        expect(deps._events[1].eventType).toBe("status_changed");
        expect(deps._events[1].fromStatus).toBe("offline");
        expect(deps._events[1].toStatus).toBe("error");
      });

      it("should not record status_changed when status stays the same", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // opened
        tracker.recordCheck(1, "offline"); // same status

        expect(deps._events.length).toBe(1);
      });

      it("should not record status_changed from ok to another non-ok (handled as new failure)", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "error");
        tracker.recordCheck(1, "error");
        tracker.recordCheck(1, "error"); // opened with error

        expect(deps._events.length).toBe(1);
        expect(deps._events[0].eventType).toBe("opened");
        expect(deps._events[0].fromStatus).toBe("ok");
        expect(deps._events[0].toStatus).toBe("error");
      });

      it("should track failureStartStatus as the status before the failure streak", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 1,
        });

        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // opened, fromStatus should be ok

        expect(deps._events[0].fromStatus).toBe("ok");
      });

      it("should handle multiple agents independently", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // agent 1: opened
        tracker.recordCheck(2, "offline");
        tracker.recordCheck(2, "offline"); // agent 2: opened

        expect(tracker.hasOpenIncident(1)).toBe(true);
        expect(tracker.hasOpenIncident(2)).toBe(true);
        expect(deps._events.length).toBe(2);
        expect(deps._events[0].agentId).toBe(1);
        expect(deps._events[1].agentId).toBe(2);
      });
    });

    describe("reconstructState", () => {
      it("should reconstruct open incident state from deps", () => {
        const deps = createMockIncidentDeps({
          getOpenIncidents: () => [
            { agentId: 1, incidentId: "1-123", openedAt: 123 },
          ],
        });
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([{ id: 1 }]);

        expect(tracker.hasOpenIncident(1)).toBe(true);
        expect(tracker.getOpenIncidentId(1)).toBe("1-123");
      });

      it("should reconstruct handed-off incident state when not resolved", () => {
        const deps = createMockIncidentDeps({
          getOpenIncidents: () => [],
          getHandedOffIncidents: () => [
            { agentId: 1, incidentId: "1-handoff", linkedIncidentId: "d-456" },
          ],
          hasIncidentRecovered: () => false,
        });
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([{ id: 1 }]);

        expect(tracker.hasOpenIncident(1)).toBe(true);
        expect(tracker.getOpenIncidentId(1)).toBe("1-handoff");
      });

      it("should not reconstruct handed-off incident if local incident recovered", () => {
        const deps = createMockIncidentDeps({
          getOpenIncidents: () => [],
          getHandedOffIncidents: () => [
            { agentId: 1, incidentId: "1-handoff", linkedIncidentId: null },
          ],
          hasIncidentRecovered: (id) => id === "1-handoff",
        });
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([{ id: 1 }]);

        expect(tracker.hasOpenIncident(1)).toBe(false);
      });

      it("should count consecutive non-OK checks during reconstruction", () => {
        const deps = createMockIncidentDeps({
          getAgentLastNChecks: () => [
            { status: "offline", checkedAt: 3000 },
            { status: "offline", checkedAt: 2000 },
            { status: "offline", checkedAt: 1000 },
            { status: "ok", checkedAt: 0 },
          ],
        });
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([{ id: 1 }]);
        const state = tracker.getAgentState(1);

        expect(state?.failureCounter).toBe(3);
        expect(state?.lastStatus).toBe("offline");
      });

      it("should handle empty agent list", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([]);
        expect(tracker.getAgentState(1)).toBeUndefined();
      });

      it("should handle agent with no check history", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.reconstructState([{ id: 1 }]);
        const state = tracker.getAgentState(1);

        expect(state?.failureCounter).toBe(0);
        expect(state?.lastStatus).toBeNull();
      });
    });

    describe("threshold updates", () => {
      it("should update thresholds without losing state", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // opened with threshold 3

        tracker.updateThresholds(2, 1);
        tracker.recordCheck(1, "ok"); // recovery with threshold 1

        expect(tracker.hasOpenIncident(1)).toBe(false);
      });
    });

    describe("agent state management", () => {
      it("should remove agent state", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        expect(tracker.hasOpenIncident(1)).toBe(true);

        tracker.removeAgentState(1);
        expect(tracker.getAgentState(1)).toBeUndefined();
      });

      it("should clear all state", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(2, "offline");
        tracker.recordCheck(2, "offline");

        tracker.clearState();
        expect(tracker.getAgentState(1)).toBeUndefined();
        expect(tracker.getAgentState(2)).toBeUndefined();
      });
    });

    describe("default thresholds", () => {
      it("should use default failure threshold of 3", () => {
        expect(DEFAULT_FAILURE_THRESHOLD).toBe(3);
      });

      it("should use default recovery threshold of 2", () => {
        expect(DEFAULT_RECOVERY_THRESHOLD).toBe(2);
      });
    });

    describe("edge cases", () => {
      it("should handle rapid alternating status without opening incident", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 3,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "ok");
        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "ok");

        expect(tracker.hasOpenIncident(1)).toBe(false);
        expect(deps._events.length).toBe(0);
      });

      it("should handle degraded status same as other non-OK statuses", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        tracker.recordCheck(1, "degraded");
        tracker.recordCheck(1, "degraded");

        expect(tracker.hasOpenIncident(1)).toBe(true);
        expect(deps._events[0].toStatus).toBe("degraded");
      });

      it("should handle single OK check after incident opens (recovery counter starts)", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 3,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // opened
        tracker.recordCheck(1, "ok"); // recovery counter = 1

        const state = tracker.getAgentState(1);
        expect(state?.openIncidentId).not.toBeNull();
        expect(state?.recoveryCounter).toBe(1);
      });

      it("should reset recovery counter on new non-OK check during recovery", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 3,
        });

        tracker.recordCheck(1, "offline");
        tracker.recordCheck(1, "offline"); // opened
        tracker.recordCheck(1, "ok"); // recovery = 1
        tracker.recordCheck(1, "ok"); // recovery = 2
        tracker.recordCheck(1, "error"); // recovery reset to 0

        const state = tracker.getAgentState(1);
        expect(state?.recoveryCounter).toBe(0);
        expect(state?.openIncidentId).not.toBeNull();
      });
    });

    describe("namespaceId support", () => {
      it("should include namespaceId in incident events when provided", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        // Mock calling recordCheck with namespace context (simulating daemon poll behavior)
        // The insertEvent mock now captures namespaceId
        deps.insertEvent(
          1,
          "inc-123",
          "opened",
          null,
          "offline",
          "Test",
          "ns-abc-123",
        );

        expect(deps._events.length).toBe(1);
        expect(deps._events[0].namespaceId).toBe("ns-abc-123");
        expect(deps._events[0].eventType).toBe("opened");
      });

      it("should propagate namespaceId through opened event", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        deps.insertEvent(
          1,
          "inc-1",
          "opened",
          "ok",
          "offline",
          "Incident opened",
          "namespace-1",
        );

        expect(deps._events[0].namespaceId).toBe("namespace-1");
        expect(deps._events[0].agentId).toBe(1);
      });

      it("should propagate namespaceId through recovered event", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        deps.insertEvent(
          1,
          "inc-1",
          "recovered",
          "offline",
          "ok",
          "Recovered after 2 checks",
          "namespace-2",
        );

        expect(deps._events[0].namespaceId).toBe("namespace-2");
        expect(deps._events[0].eventType).toBe("recovered");
      });

      it("should propagate namespaceId through status_changed event", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        deps.insertEvent(
          1,
          "inc-1",
          "status_changed",
          "offline",
          "error",
          "Status changed",
          "namespace-3",
        );

        expect(deps._events[0].namespaceId).toBe("namespace-3");
        expect(deps._events[0].eventType).toBe("status_changed");
      });

      it("should handle undefined namespaceId gracefully", () => {
        const deps = createMockIncidentDeps();
        const tracker = createIncidentTracker(deps, {
          failureThreshold: 2,
          recoveryThreshold: 2,
        });

        deps.insertEvent(1, "inc-1", "opened", null, "offline", "Test");

        expect(deps._events[0].namespaceId).toBeUndefined();
      });
    });
  });
});
