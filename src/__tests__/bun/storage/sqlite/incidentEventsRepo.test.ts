import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import * as electrobunMock from "../../../mocks/electrobun";
import { resetTestDB, setupTestDB } from "./test-helpers";

mock.module("electrobun/bun", () => electrobunMock);

const {
  insertEvent,
  insertEventsBatch,
  getOpenIncidents,
  getHandedOffIncidents,
  getEventsForAgent,
  getEventsForTimeRange,
  getEventsForIncident,
  getTotalEventsCount,
  deleteOldEvents,
  countOldEvents,
  linkAndCloseLocalIncidents,
  deleteIncident,
} = await import("../../../../bun/storage/sqlite/incidentEventsRepo");

describe("incidentEventsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── insertEvent ───────────────────────────────────────────────────────────

  describe("insertEvent", () => {
    it("should insert a single event and return it", () => {
      const event = insertEvent(
        1,
        "inc-1",
        "opened",
        null,
        "offline",
        "Agent went offline",
      );
      expect(event.id).toBeGreaterThan(0);
      expect(event.agentId).toBe(1);
      expect(event.incidentId).toBe("inc-1");
      expect(event.eventType).toBe("opened");
      expect(event.fromStatus).toBeNull();
      expect(event.toStatus).toBe("offline");
      expect(event.reason).toBe("Agent went offline");
      expect(event.linkedIncidentId).toBeNull();
      expect(event.eventAt).toBeGreaterThan(0);
    });

    it("should accept a linked incident id", () => {
      const event = insertEvent(
        1,
        "inc-1",
        "status_changed",
        "offline",
        "error",
        null,
        "daemon-1",
      );
      expect(event.linkedIncidentId).toBe("daemon-1");
    });
  });

  // ─── insertEventsBatch ─────────────────────────────────────────────────────

  describe("insertEventsBatch", () => {
    it("should return 0 for empty array", () => {
      expect(insertEventsBatch([])).toBe(0);
    });

    it("should insert events from daemon sync", () => {
      const now = Date.now();
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "daemon-1",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "daemon-1",
          eventAt: now + 1,
          eventType: "status_changed",
          fromStatus: "offline",
          toStatus: "error",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(2);
      expect(getTotalEventsCount()).toBe(2);
    });

    it("should filter out orphan recovered events (no matching opened)", () => {
      const now = Date.now();
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-orphan",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "error",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(0);
    });

    it("should keep recovered when opened is in the same batch", () => {
      const now = Date.now();
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now + 1,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(2);
    });

    it("should keep recovered when opened already exists in DB", () => {
      const now = Date.now();
      insertEvent(1, "inc-1", "opened", null, "offline", null);
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(1);
    });

    it("should filter out duplicate opened events for the same incident", () => {
      const now = Date.now();
      insertEvent(1, "inc-1", "opened", null, "offline", null);
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(0);
    });

    it("should filter out duplicate recovered events for the same incident", () => {
      const now = Date.now();
      insertEvent(1, "inc-1", "opened", null, "offline", null);
      insertEvent(1, "inc-1", "recovered", "offline", "ok", null);
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(0);
    });

    it("should not filter status_changed events", () => {
      const now = Date.now();
      const inserted = insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "status_changed",
          fromStatus: "offline",
          toStatus: "error",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now + 1,
          eventType: "status_changed",
          fromStatus: "error",
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      expect(inserted).toBe(2);
    });

    it("should not duplicate identical status_changed events on repeated sync (INSERT OR IGNORE)", () => {
      const now = Date.now();
      const event = {
        id: 0,
        agentId: 1,
        incidentId: "inc-1",
        eventAt: now,
        eventType: "status_changed" as const,
        fromStatus: "offline" as const,
        toStatus: "error" as const,
        reason: null,
        linkedIncidentId: null,
      };

      // First sync inserts 1 row
      const inserted1 = insertEventsBatch([event]);
      expect(inserted1).toBe(1);

      // Second sync with the same event should insert 0 (INSERT OR IGNORE)
      const inserted2 = insertEventsBatch([event]);
      expect(inserted2).toBe(0);

      // Only 1 row in DB
      expect(getTotalEventsCount()).toBe(1);
    });

    it("should link events to unrecovered local incidents", () => {
      insertEvent(1, "local-1", "opened", null, "offline", null);
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "daemon-1",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      const events = getEventsForIncident("daemon-1");
      expect(events.length).toBe(1);
      expect(events[0].linkedIncidentId).toBe("local-1");
    });

    it("should prevent self-linking (linkedId == event incidentId)", () => {
      insertEvent(1, "same-id", "opened", null, "offline", null);
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "same-id",
          eventAt: now,
          eventType: "status_changed",
          fromStatus: "offline",
          toStatus: "error",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      const events = getEventsForIncident("same-id");
      const batchEvent = events.find((e) => e.eventAt === now);
      expect(batchEvent?.linkedIncidentId).toBeNull();
    });

    it("should not link to recovered local incidents", () => {
      insertEvent(1, "local-1", "opened", null, "offline", null);
      insertEvent(1, "local-1", "recovered", "offline", "ok", null);
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "daemon-1",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);
      const events = getEventsForIncident("daemon-1");
      expect(events[0].linkedIncidentId).toBeNull();
    });
  });

  // ─── getOpenIncidents ──────────────────────────────────────────────────────

  describe("getOpenIncidents", () => {
    it("should return incidents with opened but no recovered/handoff", () => {
      insertEvent(1, "inc-open", "opened", null, "offline", null);
      insertEvent(2, "inc-recovered", "opened", null, "offline", null);
      insertEvent(2, "inc-recovered", "recovered", "offline", "ok", null);
      insertEvent(3, "inc-handoff", "opened", null, "offline", null);
      insertEvent(3, "inc-handoff", "handoff", "offline", "offline", null);

      const open = getOpenIncidents();
      expect(open.length).toBe(1);
      expect(open[0].incidentId).toBe("inc-open");
      expect(open[0].agentId).toBe(1);
    });

    it("should return empty array when no open incidents", () => {
      expect(getOpenIncidents()).toEqual([]);
    });
  });

  // ─── getHandedOffIncidents ─────────────────────────────────────────────────

  describe("getHandedOffIncidents", () => {
    it("should return incidents with handoff but no recovered", () => {
      insertEvent(1, "inc-handoff", "opened", null, "offline", null);
      insertEvent(1, "inc-handoff", "handoff", "offline", "offline", null);
      insertEvent(2, "inc-recovered", "opened", null, "offline", null);
      insertEvent(2, "inc-recovered", "handoff", "offline", "offline", null);
      insertEvent(2, "inc-recovered", "recovered", "offline", "ok", null);

      const handedOff = getHandedOffIncidents();
      expect(handedOff.length).toBe(1);
      expect(handedOff[0].incidentId).toBe("inc-handoff");
    });

    it("should include linkedIncidentId from handoff event", () => {
      insertEvent(1, "inc-handoff", "opened", null, "offline", null);
      insertEvent(
        1,
        "inc-handoff",
        "handoff",
        "offline",
        "offline",
        null,
        "daemon-1",
      );

      const handedOff = getHandedOffIncidents();
      expect(handedOff[0].linkedIncidentId).toBe("daemon-1");
    });

    it("should return empty array when no handed-off incidents", () => {
      expect(getHandedOffIncidents()).toEqual([]);
    });
  });

  // ─── getEventsForAgent ─────────────────────────────────────────────────────

  describe("getEventsForAgent", () => {
    it("should return events for a specific agent within time range", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 1000,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 2,
          incidentId: "inc-2",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const events = getEventsForAgent(1, now - 6000);
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe("recovered"); // most recent first (desc)
      expect(events[1].eventType).toBe("opened");
    });

    it("should respect untilMs boundary", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 1000,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const events = getEventsForAgent(1, now - 6000, now - 2000);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("opened");
    });

    it("should return empty array for non-existent agent", () => {
      expect(getEventsForAgent(99, 0)).toEqual([]);
    });
  });

  // ─── getEventsForTimeRange ─────────────────────────────────────────────────

  describe("getEventsForTimeRange", () => {
    it("should return events across all agents in time range", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 2,
          incidentId: "inc-2",
          eventAt: now - 1000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const events = getEventsForTimeRange(now - 6000);
      expect(events.length).toBe(2);
    });

    it("should respect untilMs boundary", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 1000,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const events = getEventsForTimeRange(now - 6000, now - 2000);
      expect(events.length).toBe(1);
    });

    it("should return empty array when no events in range", () => {
      expect(getEventsForTimeRange(0, 1)).toEqual([]);
    });
  });

  // ─── getEventsForIncident ──────────────────────────────────────────────────

  describe("getEventsForIncident", () => {
    it("should return all events for a specific incident ordered by eventAt", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 2000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const events = getEventsForIncident("inc-1");
      expect(events.length).toBe(2);
      expect(events[0].eventType).toBe("opened");
      expect(events[1].eventType).toBe("recovered");
    });

    it("should return empty array for non-existent incident", () => {
      expect(getEventsForIncident("nonexistent")).toEqual([]);
    });
  });

  // ─── getTotalEventsCount ───────────────────────────────────────────────────

  describe("getTotalEventsCount", () => {
    it("should return total count across all incidents", () => {
      insertEvent(1, "inc-1", "opened", null, "offline", null);
      insertEvent(2, "inc-2", "opened", null, "offline", null);
      expect(getTotalEventsCount()).toBe(2);
    });

    it("should return 0 for empty table", () => {
      expect(getTotalEventsCount()).toBe(0);
    });
  });

  // ─── countOldEvents ────────────────────────────────────────────────────────

  describe("countOldEvents", () => {
    it("should count only events older than cutoff", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 10000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "status_changed",
          fromStatus: "offline",
          toStatus: "error",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "error",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      expect(countOldEvents(now - 3000)).toBe(2);
    });

    it("should return 0 for empty table", () => {
      expect(countOldEvents(999)).toBe(0);
    });
  });

  // ─── deleteOldEvents ───────────────────────────────────────────────────────

  describe("deleteOldEvents", () => {
    it("should delete events older than cutoff and return count", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 10000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 5000,
          eventType: "status_changed",
          fromStatus: "offline",
          toStatus: "error",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "error",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const deleted = deleteOldEvents(now - 3000);
      expect(deleted).toBe(2);
      expect(getTotalEventsCount()).toBe(1);
    });

    it("should return 0 when nothing to delete", () => {
      expect(deleteOldEvents(Date.now() + 1000)).toBe(0);
    });
  });

  // ─── linkAndCloseLocalIncidents ────────────────────────────────────────────

  describe("linkAndCloseLocalIncidents", () => {
    it("should create handoff events and link to daemon incidents", () => {
      insertEvent(1, "local-1", "opened", null, "offline", null);
      insertEvent(2, "local-2", "opened", null, "error", null);

      const closed = linkAndCloseLocalIncidents([
        { agentId: 1, incidentId: "daemon-1" },
        { agentId: 2, incidentId: "daemon-2" },
      ]);

      expect(closed).toBe(2);
      expect(getOpenIncidents().length).toBe(0);

      const handedOff = getHandedOffIncidents();
      expect(handedOff.length).toBe(2);
      expect(
        handedOff.find((h) => h.incidentId === "local-1")?.linkedIncidentId,
      ).toBe("daemon-1");
      expect(
        handedOff.find((h) => h.incidentId === "local-2")?.linkedIncidentId,
      ).toBe("daemon-2");
    });

    it("should handle agents with no daemon counterpart", () => {
      insertEvent(1, "local-1", "opened", null, "offline", null);

      const closed = linkAndCloseLocalIncidents([]);

      expect(closed).toBe(1);

      const handedOff = getHandedOffIncidents();
      expect(handedOff.length).toBe(1);
      expect(handedOff[0].linkedIncidentId).toBeNull();
    });

    it("should return 0 when no local open incidents", () => {
      expect(
        linkAndCloseLocalIncidents([{ agentId: 1, incidentId: "daemon-1" }]),
      ).toBe(0);
    });
  });

  // ─── deleteIncident ────────────────────────────────────────────────────────

  describe("deleteIncident", () => {
    it("should delete all events for an incident and return count", () => {
      const now = Date.now();
      insertEventsBatch([
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now - 2000,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 1,
          incidentId: "inc-1",
          eventAt: now,
          eventType: "recovered",
          fromStatus: "offline",
          toStatus: "ok",
          reason: null,
          linkedIncidentId: null,
        },
        {
          id: 0,
          agentId: 2,
          incidentId: "inc-2",
          eventAt: now,
          eventType: "opened",
          fromStatus: null,
          toStatus: "offline",
          reason: null,
          linkedIncidentId: null,
        },
      ]);

      const deleted = deleteIncident("inc-1");
      expect(deleted).toBe(2);
      expect(getTotalEventsCount()).toBe(1);
      expect(getEventsForIncident("inc-1")).toEqual([]);
    });

    it("should return 0 for non-existent incident", () => {
      expect(deleteIncident("nonexistent")).toBe(0);
    });
  });
});
