import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
  countOldChecks,
  deleteOldChecks,
  getAgentLastNChecks,
  getAgentLatestCheck,
  getAllChecks,
  getChecksAggregatedBy10Min,
  getChecksAggregatedByHour,
  getRecentChecks,
  getTotalChecksCount,
  insertCheck,
  insertChecksBatch,
} from "../../../../bun/storage/sqlite/checksRepo";
import { resetTestDB, setupTestDB } from "./test-helpers";

mock.module("electrobun/bun", () => import("../../../mocks/electrobun"));

describe("checksRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── insertCheck ───────────────────────────────────────────────────────────

  describe("insertCheck", () => {
    it("should insert a check and return it with an id", () => {
      const check = insertCheck(1, "ok", 42, 200, null, null);
      expect(check.id).toBeGreaterThan(0);
      expect(check.agentId).toBe(1);
      expect(check.status).toBe("ok");
      expect(check.responseMs).toBe(42);
      expect(check.httpStatus).toBe(200);
      expect(check.errorCode).toBeNull();
      expect(check.errorMessage).toBeNull();
      expect(check.checkedAt).toBeGreaterThan(0);
    });

    it("should allow error checks with error details", () => {
      const check = insertCheck(
        2,
        "error",
        0,
        null,
        "TIMEOUT",
        "Request timed out",
      );
      expect(check.status).toBe("error");
      expect(check.errorCode).toBe("TIMEOUT");
      expect(check.errorMessage).toBe("Request timed out");
    });
  });

  // ─── insertChecksBatch ─────────────────────────────────────────────────────

  describe("insertChecksBatch", () => {
    it("should return 0 for empty array", () => {
      expect(insertChecksBatch([])).toBe(0);
    });

    it("should insert multiple checks and return count", () => {
      const inserted = insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: 1000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: 2000,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: "fail",
        },
      ]);
      expect(inserted).toBe(2);
      expect(getTotalChecksCount()).toBe(2);
    });

    it("should ignore duplicates (same agentId + checkedAt)", () => {
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: 1000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      const inserted = insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: 1000,
          status: "error",
          responseMs: 99,
          httpStatus: 500,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      expect(inserted).toBe(0);
      expect(getTotalChecksCount()).toBe(1);
    });
  });

  // ─── getRecentChecks ───────────────────────────────────────────────────────

  describe("getRecentChecks", () => {
    it("should return checks within time range sorted desc", () => {
      const now = Date.now();
      // Use manual inserts with controlled timestamps
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 5000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 1000,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 10000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);

      const recent = getRecentChecks(1, now - 6000);
      expect(recent.length).toBe(2); // -5000 and -1000
      expect(recent[0].status).toBe("error"); // most recent first
      expect(recent[1].status).toBe("ok");
    });

    it("should respect untilMs boundary", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 5000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 1000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);

      const recent = getRecentChecks(1, now - 6000, now - 2000);
      expect(recent.length).toBe(1);
      expect(recent[0].checkedAt).toBe(now - 5000);
    });

    it("should return empty array for empty table", () => {
      expect(getRecentChecks(1, 0)).toEqual([]);
    });

    it("should not return checks for other agents", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      expect(getRecentChecks(2, now - 1000)).toEqual([]);
    });
  });

  // ─── getAgentLastNChecks ───────────────────────────────────────────────────

  describe("getAgentLastNChecks", () => {
    it("should return exactly N most recent checks", () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        insertChecksBatch([
          {
            id: 0,
            agentId: 1,
            checkedAt: now - i * 1000,
            status: "ok",
            responseMs: 10,
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
          },
        ]);
      }

      const last3 = getAgentLastNChecks(1, 3);
      expect(last3.length).toBe(3);
      expect(last3[0].checkedAt).toBe(now); // most recent
      expect(last3[2].checkedAt).toBe(now - 2000);
    });

    it("should return fewer than N when not enough rows", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      expect(getAgentLastNChecks(1, 10).length).toBe(1);
    });

    it("should return empty array when no checks", () => {
      expect(getAgentLastNChecks(1, 5)).toEqual([]);
    });

    it("should not include checks from other agents", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 2,
          checkedAt: now - 100,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: null,
        },
      ]);
      expect(getAgentLastNChecks(1, 10).length).toBe(1);
      expect(getAgentLastNChecks(1, 10)[0].agentId).toBe(1);
    });
  });

  // ─── getAgentLatestCheck ───────────────────────────────────────────────────

  describe("getAgentLatestCheck", () => {
    it("should return the most recent check for the agent", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 2000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: null,
        },
      ]);
      const latest = getAgentLatestCheck(1);
      expect(latest).not.toBeNull();
      expect(latest!.status).toBe("error");
    });

    it("should return null when no checks exist", () => {
      expect(getAgentLatestCheck(1)).toBeNull();
    });

    it("should not return checks for other agents", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 2,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      expect(getAgentLatestCheck(1)).toBeNull();
    });
  });

  // ─── getAllChecks ──────────────────────────────────────────────────────────

  describe("getAllChecks", () => {
    it("should return checks across all agents", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 2,
          checkedAt: now - 100,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: null,
        },
      ]);
      const all = getAllChecks(now - 1000);
      expect(all.length).toBe(2);
    });

    it("should return empty array when no checks exist", () => {
      expect(getAllChecks(0)).toEqual([]);
    });
  });

  // ─── countOldChecks ────────────────────────────────────────────────────────

  describe("countOldChecks", () => {
    it("should count only checks older than cutoff", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 10000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 5000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      expect(countOldChecks(now - 3000)).toBe(2);
    });

    it("should return 0 for empty table", () => {
      expect(countOldChecks(999)).toBe(0);
    });
  });

  // ─── deleteOldChecks ───────────────────────────────────────────────────────

  describe("deleteOldChecks", () => {
    it("should delete checks older than cutoff and return count", () => {
      const now = Date.now();
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 10000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now - 5000,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: now,
          status: "ok",
          responseMs: 10,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);
      const deleted = deleteOldChecks(now - 3000);
      expect(deleted).toBe(2);
      expect(getTotalChecksCount()).toBe(1);
    });

    it("should return 0 when nothing to delete", () => {
      expect(deleteOldChecks(999)).toBe(0);
    });
  });

  // ─── getTotalChecksCount ───────────────────────────────────────────────────

  describe("getTotalChecksCount", () => {
    it("should return total count across all agents", () => {
      insertCheck(1, "ok", 10, 200, null, null);
      insertCheck(2, "error", 0, null, "ERR", "fail");
      expect(getTotalChecksCount()).toBe(2);
    });

    it("should return 0 for empty table", () => {
      expect(getTotalChecksCount()).toBe(0);
    });
  });

  // ─── getChecksAggregatedByHour ─────────────────────────────────────────────

  describe("getChecksAggregatedByHour", () => {
    it("should aggregate checks into hourly buckets", () => {
      const hourMs = 60 * 60 * 1000;
      const bucketStart = Math.floor(Date.now() / hourMs) * hourMs;
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: bucketStart + 1000,
          status: "ok",
          responseMs: 100,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: bucketStart + 2000,
          status: "ok",
          responseMs: 200,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: bucketStart + 3000,
          status: "error",
          responseMs: 0,
          httpStatus: null,
          errorCode: "ERR",
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 2,
          checkedAt: bucketStart + 4000,
          status: "ok",
          responseMs: 50,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);

      const buckets = getChecksAggregatedByHour(
        bucketStart,
        bucketStart + hourMs,
      );
      expect(buckets.length).toBe(2);

      const agent1Bucket = buckets.find((b) => b.agentId === 1);
      expect(agent1Bucket).toBeDefined();
      expect(agent1Bucket!.total).toBe(3);
      expect(agent1Bucket!.okCount).toBe(2);
      expect(agent1Bucket!.failedCount).toBe(1);
      expect(agent1Bucket!.avgResponseMs).toBeCloseTo(100, 0); // (100+200+0)/3

      const agent2Bucket = buckets.find((b) => b.agentId === 2);
      expect(agent2Bucket).toBeDefined();
      expect(agent2Bucket!.total).toBe(1);
    });

    it("should return empty array when no checks in range", () => {
      expect(getChecksAggregatedByHour(0, 1000)).toEqual([]);
    });
  });

  // ─── getChecksAggregatedBy10Min ────────────────────────────────────────────

  describe("getChecksAggregatedBy10Min", () => {
    it("should aggregate checks into 10-minute buckets", () => {
      const tenMinMs = 10 * 60 * 1000;
      const bucketStart = Math.floor(Date.now() / tenMinMs) * tenMinMs;
      insertChecksBatch([
        {
          id: 0,
          agentId: 1,
          checkedAt: bucketStart + 1000,
          status: "offline",
          responseMs: 0,
          httpStatus: null,
          errorCode: "CONN",
          errorMessage: null,
        },
        {
          id: 0,
          agentId: 1,
          checkedAt: bucketStart + 2000,
          status: "degraded",
          responseMs: 500,
          httpStatus: 200,
          errorCode: null,
          errorMessage: null,
        },
      ]);

      const buckets = getChecksAggregatedBy10Min(
        bucketStart,
        bucketStart + tenMinMs,
      );
      expect(buckets.length).toBe(1);
      expect(buckets[0].degradedCount).toBe(2); // offline + degraded both count toward degraded
      expect(buckets[0].failedCount).toBe(0);
    });

    it("should return empty array when no checks in range", () => {
      expect(getChecksAggregatedBy10Min(0, 1000)).toEqual([]);
    });
  });
});
