import { describe, expect, it } from "bun:test";

import type { IncidentEvent } from "../../../../shared/types";

/**
 * incidentEventsRepo Unit Tests
 *
 * Tests the pure filtering, deduplication, and mapping logic embedded in
 * the repo functions without requiring a real SQLite database.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<IncidentEvent> & {
    eventType: IncidentEvent["eventType"];
  },
): IncidentEvent {
  return {
    id: 1,
    agentId: 1,
    incidentId: "inc-1",
    eventAt: 1000,
    fromStatus: null,
    toStatus: "offline",
    reason: null,
    linkedIncidentId: null,
    ...overrides,
  };
}

// ─── insertEventsBatch filtering logic ──────────────────────────────────────

/**
 * Mirror of the filtering logic in insertEventsBatch so it can be tested
 * in isolation without a real database.
 */
function filterBatchEvents(
  events: IncidentEvent[],
  existingOpenedIds: Set<string>,
  existingLifecycleEvents: Set<string>,
): IncidentEvent[] {
  // Augment opened IDs with any "opened" events in this batch
  const openedIds = new Set(existingOpenedIds);
  for (const event of events) {
    if (event.eventType === "opened") {
      openedIds.add(event.incidentId);
    }
  }

  return events.filter((e) => {
    if (e.eventType === "recovered" && !openedIds.has(e.incidentId)) {
      return false;
    }
    if (e.eventType === "opened" || e.eventType === "recovered") {
      const key = `${e.incidentId}:${e.eventType}`;
      if (existingLifecycleEvents.has(key)) {
        return false;
      }
    }
    return true;
  });
}

describe("incidentEventsRepo", () => {
  // ─── insertEventsBatch filtering ──────────────────────────────────────────

  describe("insertEventsBatch filtering logic", () => {
    describe("orphan recovered event filtering", () => {
      it("should filter out a recovered event with no matching opened event", () => {
        const events = [
          makeEvent({ eventType: "recovered", incidentId: "inc-orphan" }),
        ];
        const result = filterBatchEvents(events, new Set(), new Set());
        expect(result).toHaveLength(0);
      });

      it("should keep a recovered event when opened event is already in DB", () => {
        const events = [
          makeEvent({ eventType: "recovered", incidentId: "inc-1" }),
        ];
        const openedIds = new Set(["inc-1"]);
        const result = filterBatchEvents(events, openedIds, new Set());
        expect(result).toHaveLength(1);
      });

      it("should keep a recovered event when opened event is in the same batch", () => {
        const events = [
          makeEvent({ eventType: "opened", incidentId: "inc-new", id: 1 }),
          makeEvent({ eventType: "recovered", incidentId: "inc-new", id: 2 }),
        ];
        const result = filterBatchEvents(events, new Set(), new Set());
        expect(result).toHaveLength(2);
      });
    });

    describe("duplicate lifecycle event filtering", () => {
      it("should filter out a duplicate opened event for the same incident", () => {
        const events = [
          makeEvent({ eventType: "opened", incidentId: "inc-1" }),
        ];
        const existingLifecycle = new Set(["inc-1:opened"]);
        const result = filterBatchEvents(events, new Set(), existingLifecycle);
        expect(result).toHaveLength(0);
      });

      it("should filter out a duplicate recovered event for the same incident", () => {
        const events = [
          makeEvent({ eventType: "recovered", incidentId: "inc-1" }),
        ];
        const openedIds = new Set(["inc-1"]);
        const existingLifecycle = new Set(["inc-1:recovered"]);
        const result = filterBatchEvents(events, openedIds, existingLifecycle);
        expect(result).toHaveLength(0);
      });

      it("should not filter out status_changed events regardless of duplicates", () => {
        const events = [
          makeEvent({
            eventType: "status_changed",
            incidentId: "inc-1",
            fromStatus: "offline",
            toStatus: "error",
          }),
          makeEvent({
            eventType: "status_changed",
            incidentId: "inc-1",
            fromStatus: "offline",
            toStatus: "error",
          }),
        ];
        const result = filterBatchEvents(events, new Set(), new Set());
        expect(result).toHaveLength(2);
      });

      it("should not filter out handoff events", () => {
        const events = [
          makeEvent({ eventType: "handoff", incidentId: "inc-1" }),
        ];
        const existingLifecycle = new Set(["inc-1:handoff"]);
        const result = filterBatchEvents(
          events,
          new Set(["inc-1"]),
          existingLifecycle,
        );
        expect(result).toHaveLength(1);
      });
    });

    describe("mixed batch filtering", () => {
      it("should keep opened, filter orphan recovered, and keep status_changed", () => {
        const events = [
          makeEvent({ eventType: "opened", incidentId: "inc-1", id: 1 }),
          makeEvent({
            eventType: "status_changed",
            incidentId: "inc-1",
            id: 2,
          }),
          makeEvent({
            eventType: "recovered",
            incidentId: "inc-orphan",
            id: 3,
          }),
        ];
        const result = filterBatchEvents(events, new Set(), new Set());
        expect(result).toHaveLength(2);
        expect(result[0].eventType).toBe("opened");
        expect(result[1].eventType).toBe("status_changed");
      });

      it("should handle empty batch", () => {
        const result = filterBatchEvents([], new Set(), new Set());
        expect(result).toHaveLength(0);
      });

      it("should handle batch with all events filtered", () => {
        const events = [
          makeEvent({ eventType: "opened", incidentId: "inc-1" }),
          makeEvent({ eventType: "recovered", incidentId: "inc-orphan" }),
        ];
        const existingLifecycle = new Set(["inc-1:opened"]);
        const result = filterBatchEvents(events, new Set(), existingLifecycle);
        expect(result).toHaveLength(0);
      });
    });
  });

  // ─── findUnrecoveredLocalIncidentsBatch logic ──────────────────────────────

  describe("findUnrecoveredLocalIncidentsBatch mapping logic", () => {
    /**
     * Mirror of the JS portion of findUnrecoveredLocalIncidentsBatch:
     * given open locals and daemon-recovered IDs, produce the agent→incident map.
     */
    function buildUnrecoveredMap(
      agentIds: number[],
      openLocals: Array<{ agentId: number; incidentId: string }>,
      recoveredViaDaemon: Set<string>,
    ): Map<number, string | null> {
      const result = new Map<number, string | null>();
      for (const agentId of agentIds) {
        result.set(agentId, null);
      }

      const unrecovered = openLocals.filter(
        (r) => !recoveredViaDaemon.has(r.incidentId),
      );

      for (const r of unrecovered) {
        if (!result.has(r.agentId) || result.get(r.agentId) === null) {
          result.set(r.agentId, r.incidentId);
        }
      }

      return result;
    }

    it("should return null for all agents when no open locals exist", () => {
      const map = buildUnrecoveredMap([1, 2, 3], [], new Set());
      expect(map.get(1)).toBeNull();
      expect(map.get(2)).toBeNull();
      expect(map.get(3)).toBeNull();
    });

    it("should map agent to its open local incident", () => {
      const openLocals = [{ agentId: 1, incidentId: "local-1" }];
      const map = buildUnrecoveredMap([1, 2], openLocals, new Set());
      expect(map.get(1)).toBe("local-1");
      expect(map.get(2)).toBeNull();
    });

    it("should exclude incidents recovered via daemon", () => {
      const openLocals = [
        { agentId: 1, incidentId: "local-1" },
        { agentId: 2, incidentId: "local-2" },
      ];
      const recoveredViaDaemon = new Set(["local-1"]);
      const map = buildUnrecoveredMap([1, 2], openLocals, recoveredViaDaemon);
      expect(map.get(1)).toBeNull();
      expect(map.get(2)).toBe("local-2");
    });

    it("should use first unrecovered incident per agent when multiple exist", () => {
      const openLocals = [
        { agentId: 1, incidentId: "local-first" },
        { agentId: 1, incidentId: "local-second" },
      ];
      const map = buildUnrecoveredMap([1], openLocals, new Set());
      expect(map.get(1)).toBe("local-first");
    });

    it("should return empty map when agentIds is empty", () => {
      const map = buildUnrecoveredMap([], [], new Set());
      expect(map.size).toBe(0);
    });
  });

  // ─── linkAndCloseLocalIncidents mapping logic ──────────────────────────────

  describe("linkAndCloseLocalIncidents mapping logic", () => {
    /**
     * Mirror of the daemon-by-agent Map building step in linkAndCloseLocalIncidents.
     */
    function buildDaemonByAgentMap(
      daemonOpenIncidents: Array<{ agentId: number; incidentId: string }>,
    ): Map<number, string> {
      const map = new Map<number, string>();
      for (const di of daemonOpenIncidents) {
        map.set(di.agentId, di.incidentId);
      }
      return map;
    }

    it("should build a map from agentId to daemon incidentId", () => {
      const daemonMap = buildDaemonByAgentMap([
        { agentId: 1, incidentId: "daemon-1" },
        { agentId: 2, incidentId: "daemon-2" },
      ]);
      expect(daemonMap.get(1)).toBe("daemon-1");
      expect(daemonMap.get(2)).toBe("daemon-2");
    });

    it("should return empty map when no daemon incidents", () => {
      const daemonMap = buildDaemonByAgentMap([]);
      expect(daemonMap.size).toBe(0);
    });

    it("should handle agents with no daemon counterpart (returns undefined)", () => {
      const daemonMap = buildDaemonByAgentMap([
        { agentId: 1, incidentId: "daemon-1" },
      ]);
      expect(daemonMap.get(99)).toBeUndefined();
    });
  });

  // ─── self-link prevention logic ────────────────────────────────────────────

  describe("self-link prevention (finalLinkedId)", () => {
    /**
     * Mirror of the self-link prevention check inside insertEventsBatch:
     * don't link an incident to itself.
     */
    function resolveFinalLinkedId(
      eventIncidentId: string,
      linkedId: string | null,
    ): string | null {
      return linkedId === eventIncidentId ? null : linkedId;
    }

    it("should return null when linked ID equals the event's own incident ID", () => {
      expect(resolveFinalLinkedId("inc-1", "inc-1")).toBeNull();
    });

    it("should return the linked ID when it differs from the event's incident ID", () => {
      expect(resolveFinalLinkedId("inc-1", "daemon-1")).toBe("daemon-1");
    });

    it("should return null when linked ID is already null", () => {
      expect(resolveFinalLinkedId("inc-1", null)).toBeNull();
    });
  });
});
