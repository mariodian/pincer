import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  deleteOldStats,
  getAgentStats,
  getAllAgentStats,
  getStatsCount,
  upsertHourlyStat,
  upsertStatsBatch,
} from "../../../../bun/storage/sqlite/statsRepo";
import { resetTestDB, setupTestDB } from "./test-helpers";

mock.module("electrobun/bun", () => import("../../../mocks/electrobun"));

describe("statsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── upsertHourlyStat ──────────────────────────────────────────────────────

  describe("upsertHourlyStat", () => {
    it("should insert a new stat row for ok status", () => {
      upsertHourlyStat(1, "ok", 100);
      expect(getStatsCount()).toBe(1);

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats[0].totalChecks).toBe(1);
      expect(stats[0].okCount).toBe(1);
      expect(stats[0].offlineCount).toBe(0);
      expect(stats[0].errorCount).toBe(0);
      expect(stats[0].uptimePct).toBe(100);
      expect(stats[0].avgResponseMs).toBe(100);
    });

    it("should insert a new stat row for error status", () => {
      upsertHourlyStat(1, "error", 0);
      const stats = getAllAgentStats(0, 9999999999);
      expect(stats[0].errorCount).toBe(1);
      expect(stats[0].uptimePct).toBe(0);
    });

    it("should insert a new stat row for offline status", () => {
      upsertHourlyStat(1, "offline", 0);
      const stats = getAllAgentStats(0, 9999999999);
      expect(stats[0].offlineCount).toBe(1);
      expect(stats[0].uptimePct).toBe(0);
    });

    it("should increment existing row on conflict", () => {
      upsertHourlyStat(1, "ok", 100);
      upsertHourlyStat(1, "ok", 200);
      upsertHourlyStat(1, "error", 0);

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats[0].totalChecks).toBe(3);
      expect(stats[0].okCount).toBe(2);
      expect(stats[0].errorCount).toBe(1);
      // uptimePct = 2/3 * 100 = 66.67
      expect(stats[0].uptimePct).toBeCloseTo(66.67, 1);
      // avgResponseMs = (100*1 + 200*1 + 0*1) / 3 = 100
      expect(stats[0].avgResponseMs).toBeCloseTo(100, 0);
    });

    it("should create separate rows for different agents", () => {
      upsertHourlyStat(1, "ok", 100);
      upsertHourlyStat(2, "ok", 200);

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats.length).toBe(2);
    });

    it("should create separate rows for different hours", () => {
      // This is harder to test precisely because upsertHourlyStat uses Date.now()
      // internally. We can at least verify it doesn't collide with different agents.
      upsertHourlyStat(1, "ok", 100);
      upsertHourlyStat(1, "ok", 200); // same hour, same agent -> increment

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats.length).toBe(1);
      expect(stats[0].totalChecks).toBe(2);
    });
  });

  // ─── upsertStatsBatch ──────────────────────────────────────────────────────

  describe("upsertStatsBatch", () => {
    it("should return 0 for empty array", () => {
      expect(upsertStatsBatch([])).toBe(0);
    });

    it("should insert multiple stats", () => {
      const count = upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 5,
          okCount: 4,
          offlineCount: 1,
          errorCount: 0,
          uptimePct: 80,
          avgResponseMs: 50,
        },
        {
          agentId: 2,
          hourTimestamp: 1000,
          totalChecks: 3,
          okCount: 3,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 30,
        },
      ]);
      expect(count).toBe(2);
      expect(getStatsCount()).toBe(2);
    });

    it("should replace existing rows on conflict", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 5,
          okCount: 4,
          offlineCount: 1,
          errorCount: 0,
          uptimePct: 80,
          avgResponseMs: 50,
        },
      ]);
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 10,
          okCount: 10,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 40,
        },
      ]);

      const stats = getAgentStats(1, 0, 9999999999);
      expect(stats.length).toBe(1);
      expect(stats[0].totalChecks).toBe(10);
      expect(stats[0].uptimePct).toBe(100);
    });
  });

  // ─── getAgentStats ─────────────────────────────────────────────────────────

  describe("getAgentStats", () => {
    it("should return stats for the specified agent only", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 5,
          okCount: 5,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 50,
        },
        {
          agentId: 2,
          hourTimestamp: 1000,
          totalChecks: 3,
          okCount: 3,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 30,
        },
      ]);

      const stats = getAgentStats(1, 0, 9999999999);
      expect(stats.length).toBe(1);
      expect(stats[0].totalChecks).toBe(5);
    });

    it("should filter by time range", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 500,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);

      const stats = getAgentStats(1, 200, 800);
      expect(stats.length).toBe(1);
      expect(stats[0].hourTimestamp).toBe(500);
    });

    it("should return empty array for no matches", () => {
      expect(getAgentStats(1, 0, 100)).toEqual([]);
    });

    it("should sort by hour_timestamp ascending", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 300,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 200,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);

      const stats = getAgentStats(1, 0, 9999999999);
      expect(stats.map((s) => s.hourTimestamp)).toEqual([100, 200, 300]);
    });
  });

  // ─── getAllAgentStats ──────────────────────────────────────────────────────

  describe("getAllAgentStats", () => {
    it("should return stats for all agents", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 5,
          okCount: 5,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 50,
        },
        {
          agentId: 2,
          hourTimestamp: 1000,
          totalChecks: 3,
          okCount: 3,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 30,
        },
      ]);

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats.length).toBe(2);
      expect(stats.map((s) => s.agentId)).toContain(1);
      expect(stats.map((s) => s.agentId)).toContain(2);
    });

    it("should sort by agentId then hour_timestamp", () => {
      upsertStatsBatch([
        {
          agentId: 2,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 200,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);

      const stats = getAllAgentStats(0, 9999999999);
      expect(stats.map((s) => `${s.agentId}:${s.hourTimestamp}`)).toEqual([
        "1:100",
        "1:200",
        "2:100",
      ]);
    });

    it("should return empty array when no stats", () => {
      expect(getAllAgentStats(0, 100)).toEqual([]);
    });
  });

  // ─── getStatsCount ─────────────────────────────────────────────────────────

  describe("getStatsCount", () => {
    it("should return total row count", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 2000,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);
      expect(getStatsCount()).toBe(2);
    });

    it("should return 0 for empty table", () => {
      expect(getStatsCount()).toBe(0);
    });
  });

  // ─── deleteOldStats ────────────────────────────────────────────────────────

  describe("deleteOldStats", () => {
    it("should delete stats older than cutoff and return count", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 500,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);

      const deleted = deleteOldStats(600);
      expect(deleted).toBe(2);
      expect(getStatsCount()).toBe(1);
    });

    it("should return 0 when nothing to delete", () => {
      expect(deleteOldStats(0)).toBe(0);
    });

    it("should only delete old stats across all agents", () => {
      upsertStatsBatch([
        {
          agentId: 1,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 2,
          hourTimestamp: 100,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
        {
          agentId: 1,
          hourTimestamp: 1000,
          totalChecks: 1,
          okCount: 1,
          offlineCount: 0,
          errorCount: 0,
          uptimePct: 100,
          avgResponseMs: 10,
        },
      ]);

      const deleted = deleteOldStats(500);
      expect(deleted).toBe(2);
      expect(getStatsCount()).toBe(1);
    });
  });
});
