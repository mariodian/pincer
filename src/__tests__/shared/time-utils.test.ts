import { describe, expect, it } from "bun:test";

import { truncateToHour } from "../../shared/time-utils";

describe("time-utils", () => {
  describe("truncateToHour", () => {
    it("should truncate timestamp to hour boundary", () => {
      // 2024-01-01 12:34:56 UTC = 1704112496
      const ts = 1704112496;
      const hour = truncateToHour(ts);
      // Should be 2024-01-01 12:00:00 UTC = 1704110400
      expect(hour).toBe(1704110400);
    });

    it("should return same value if already on hour boundary", () => {
      const ts = 1704110400; // exactly on the hour
      expect(truncateToHour(ts)).toBe(ts);
    });

    it("should handle zero timestamp", () => {
      expect(truncateToHour(0)).toBe(0);
    });

    it("should handle timestamps at hour-1 second", () => {
      const ts = 1704112799; // 12:59:59
      expect(truncateToHour(ts)).toBe(1704110400); // back to 12:00:00
    });

    it("should handle large timestamps", () => {
      const ts = 2000000000;
      const hour = truncateToHour(ts);
      expect(hour % 3600).toBe(0);
      expect(hour).toBeLessThanOrEqual(ts);
    });
  });
});
