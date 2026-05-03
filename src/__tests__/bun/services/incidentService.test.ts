import { describe, expect, it } from "bun:test";

import {
  createIncidentTracker,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_RECOVERY_THRESHOLD,
  type IncidentTrackerDeps,
} from "../../../shared/incidentCore";
import type { CheckStatus } from "../../../shared/types";

/**
 * Incident Service Integration Tests
 *
 * These tests verify the incident detection pipeline by testing the
 * incidentCore tracker with realistic DB-like dependencies.
 */

describe("incidentService integration", () => {
  interface TestEvent {
    agentId: number;
    incidentId: string;
    eventType: "opened" | "recovered" | "status_changed";
    fromStatus: CheckStatus | null;
    toStatus: CheckStatus | null;
    reason: string | null;
  }

  function createTestDeps(): IncidentTrackerDeps & {
    events: Array<TestEvent>;
    checks: Map<number, Array<{ status: CheckStatus; checkedAt: number }>>;
  } {
    const events: Array<{
      agentId: number;
      incidentId: string;
      eventType: "opened" | "recovered" | "status_changed";
      fromStatus: CheckStatus | null;
      toStatus: CheckStatus | null;
      reason: string | null;
    }> = [];

    const checks = new Map<
      number,
      Array<{ status: CheckStatus; checkedAt: number }>
    >();

    return {
      insertEvent: (
        agentId,
        incidentId,
        eventType,
        fromStatus,
        toStatus,
        reason,
      ) => {
        events.push({
          agentId,
          incidentId,
          eventType,
          fromStatus,
          toStatus,
          reason,
        });
      },
      getAgentLastNChecks: (agentId, n) => {
        return (checks.get(agentId) ?? []).slice(0, n);
      },
      getOpenIncidents: () => {
        const open = new Set<string>();
        for (const e of events) {
          if (e.eventType === "opened") open.add(e.incidentId);
          if (e.eventType === "recovered") open.delete(e.incidentId);
        }
        return Array.from(open).map((incidentId) => {
          const e = events.find(
            (ev) => ev.incidentId === incidentId && ev.eventType === "opened",
          )!;
          return { agentId: e.agentId, incidentId, openedAt: Date.now() };
        });
      },
      getHandedOffIncidents: () => [],
      hasIncidentRecovered: (incidentId) => {
        return events.some(
          (e) => e.incidentId === incidentId && e.eventType === "recovered",
        );
      },
      getExistingOpenIncident: (agentId) => {
        // Check open incidents
        const open = new Set<string>();
        const recovered = new Set<string>();
        for (const e of events) {
          if (e.eventType === "opened") open.add(e.incidentId);
          if (e.eventType === "recovered") recovered.add(e.incidentId);
        }
        for (const incidentId of open) {
          if (!recovered.has(incidentId)) {
            const e = events.find(
              (ev) => ev.incidentId === incidentId && ev.eventType === "opened",
            )!;
            if (e.agentId === agentId) return incidentId;
          }
        }
        return null;
      },
      log: () => {},
      events,
      checks,
    };
  }

  describe("full pipeline: ok → failure → incident → recovery", () => {
    it("should detect incident after 3 consecutive failures and recover after 2 OK checks", () => {
      const deps = createTestDeps();
      const tracker = createIncidentTracker(deps, {
        failureThreshold: DEFAULT_FAILURE_THRESHOLD,
        recoveryThreshold: DEFAULT_RECOVERY_THRESHOLD,
      });

      // Agent starts healthy
      tracker.recordCheck(1, "ok");
      expect(tracker.hasOpenIncident(1)).toBe(false);
      expect(deps.events.length).toBe(0);

      // First failure - counter = 1
      tracker.recordCheck(1, "offline");
      expect(tracker.hasOpenIncident(1)).toBe(false);

      // Second failure - counter = 2
      tracker.recordCheck(1, "offline");
      expect(tracker.hasOpenIncident(1)).toBe(false);

      // Third failure - counter = 3, threshold reached, incident opened
      tracker.recordCheck(1, "offline");
      expect(tracker.hasOpenIncident(1)).toBe(true);
      expect(deps.events.length).toBe(1);
      expect(deps.events[0].eventType).toBe("opened");
      expect(deps.events[0].toStatus).toBe("offline");

      // First OK - recovery counter = 1
      tracker.recordCheck(1, "ok");
      expect(tracker.hasOpenIncident(1)).toBe(true);

      // Second OK - recovery threshold reached, incident recovered
      tracker.recordCheck(1, "ok");
      expect(tracker.hasOpenIncident(1)).toBe(false);
      expect(deps.events.length).toBe(2);
      expect(deps.events[1].eventType).toBe("recovered");
      expect(deps.events[1].toStatus).toBe("ok");
    });

    it("should handle status changes within an incident (offline → error → offline)", () => {
      const deps = createTestDeps();
      const tracker = createIncidentTracker(deps, {
        failureThreshold: 2,
        recoveryThreshold: 2,
      });

      // Open incident with offline
      tracker.recordCheck(1, "offline");
      tracker.recordCheck(1, "offline");
      expect(deps.events[0].eventType).toBe("opened");
      expect(deps.events[0].toStatus).toBe("offline");

      // Status changes to error
      tracker.recordCheck(1, "error");
      expect(deps.events[1].eventType).toBe("status_changed");
      expect(deps.events[1].fromStatus).toBe("offline");
      expect(deps.events[1].toStatus).toBe("error");

      // Status changes back to offline
      tracker.recordCheck(1, "offline");
      expect(deps.events[2].eventType).toBe("status_changed");
      expect(deps.events[2].fromStatus).toBe("error");
      expect(deps.events[2].toStatus).toBe("offline");

      // Recover
      tracker.recordCheck(1, "ok");
      tracker.recordCheck(1, "ok");
      expect(deps.events[3].eventType).toBe("recovered");
    });

    it("should reconstruct state from historical checks", () => {
      const deps = createTestDeps();
      deps.checks.set(1, [
        { status: "offline", checkedAt: 4000 },
        { status: "offline", checkedAt: 3000 },
        { status: "offline", checkedAt: 2000 },
        { status: "ok", checkedAt: 1000 },
      ]);

      const tracker = createIncidentTracker(deps, {
        failureThreshold: 3,
        recoveryThreshold: 2,
      });

      tracker.reconstructState([{ id: 1 }]);
      const state = tracker.getAgentState(1);

      expect(state?.failureCounter).toBe(3);
      expect(state?.lastStatus).toBe("offline");
      // failureStartStatus is only set when there's an open incident being reconstructed
      expect(state?.failureStartStatus).toBeNull();
    });

    it("should reconstruct failureStartStatus for open incidents", () => {
      const deps = createTestDeps();
      deps.getOpenIncidents = () => [
        { agentId: 1, incidentId: "inc-1", openedAt: 5000 },
      ];
      deps.checks.set(1, [
        { status: "offline", checkedAt: 4000 },
        { status: "offline", checkedAt: 3000 },
        { status: "offline", checkedAt: 2000 },
        { status: "ok", checkedAt: 1000 },
      ]);

      const tracker = createIncidentTracker(deps, {
        failureThreshold: 3,
        recoveryThreshold: 2,
      });

      tracker.reconstructState([{ id: 1 }]);
      const state = tracker.getAgentState(1);

      expect(state?.failureCounter).toBe(3);
      expect(state?.failureStartStatus).toBe("ok");
    });
  });

  describe("multi-agent pipeline", () => {
    it("should track incidents independently for multiple agents", () => {
      const deps = createTestDeps();
      const tracker = createIncidentTracker(deps, {
        failureThreshold: 2,
        recoveryThreshold: 2,
      });

      // Agent 1 fails twice - opens incident
      tracker.recordCheck(1, "offline");
      tracker.recordCheck(1, "offline");

      // Agent 2 stays healthy
      tracker.recordCheck(2, "ok");
      tracker.recordCheck(2, "ok");

      // Agent 3 fails twice - opens incident
      tracker.recordCheck(3, "error");
      tracker.recordCheck(3, "error");

      expect(tracker.hasOpenIncident(1)).toBe(true);
      expect(tracker.hasOpenIncident(2)).toBe(false);
      expect(tracker.hasOpenIncident(3)).toBe(true);

      expect(deps.events.length).toBe(2);
      expect(deps.events[0].agentId).toBe(1);
      expect(deps.events[1].agentId).toBe(3);
    });
  });

  describe("threshold configuration", () => {
    it("should use default thresholds from incidentCore", () => {
      expect(DEFAULT_FAILURE_THRESHOLD).toBe(3);
      expect(DEFAULT_RECOVERY_THRESHOLD).toBe(2);
    });

    it("should support custom thresholds", () => {
      const deps = createTestDeps();
      const tracker = createIncidentTracker(deps, {
        failureThreshold: 1,
        recoveryThreshold: 1,
      });

      tracker.recordCheck(1, "offline");
      expect(tracker.hasOpenIncident(1)).toBe(true);

      tracker.recordCheck(1, "ok");
      expect(tracker.hasOpenIncident(1)).toBe(false);
    });
  });

  describe("handed-off incident reconstruction", () => {
    it("should reconstruct handed-off incidents that are not yet resolved", () => {
      const deps = createTestDeps();
      deps.getHandedOffIncidents = () => [
        { agentId: 1, incidentId: "local-1", linkedIncidentId: "daemon-1" },
      ];
      deps.hasIncidentRecovered = () => false;

      const tracker = createIncidentTracker(deps, {
        failureThreshold: 3,
        recoveryThreshold: 2,
      });

      tracker.reconstructState([{ id: 1 }]);
      expect(tracker.hasOpenIncident(1)).toBe(true);
      expect(tracker.getOpenIncidentId(1)).toBe("local-1");
    });

    it("should not reconstruct resolved handed-off incidents (local incident recovered)", () => {
      const deps = createTestDeps();
      deps.getHandedOffIncidents = () => [
        { agentId: 1, incidentId: "local-1", linkedIncidentId: "daemon-1" },
      ];
      // hasIncidentRecovered is only called with handedOff.incidentId ("local-1")
      deps.hasIncidentRecovered = (id) => id === "local-1";

      const tracker = createIncidentTracker(deps, {
        failureThreshold: 3,
        recoveryThreshold: 2,
      });

      tracker.reconstructState([{ id: 1 }]);
      expect(tracker.hasOpenIncident(1)).toBe(false);
    });

    it("should reconstruct handed-off incident even if linkedIncidentId triggers false positive", () => {
      const deps = createTestDeps();
      deps.getHandedOffIncidents = () => [
        { agentId: 1, incidentId: "local-1", linkedIncidentId: "daemon-old" },
      ];
      // linkedIncidentId "daemon-old" would trigger hasIncidentRecovered true,
      // but local-1 itself is NOT recovered — so it should still be open
      deps.hasIncidentRecovered = (id) => id === "daemon-old";

      const tracker = createIncidentTracker(deps, {
        failureThreshold: 3,
        recoveryThreshold: 2,
      });

      tracker.reconstructState([{ id: 1 }]);
      // local-1 is not resolved — should be reconstructed as open
      expect(tracker.hasOpenIncident(1)).toBe(true);
      expect(tracker.getOpenIncidentId(1)).toBe("local-1");
    });
  });
});
