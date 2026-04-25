import { describe, it, expect } from "bun:test";
import { normalizeDateInput, formatDate } from "../../shared/date-helpers";

describe("date-helpers", () => {
  describe("normalizeDateInput", () => {
    it("should return Date object as-is", () => {
      const date = new Date("2024-01-15");
      expect(normalizeDateInput(date)).toEqual(date);
    });

    it("should parse string to Date", () => {
      const result = normalizeDateInput("2024-01-15");
      expect(result instanceof Date).toBe(true);
      expect(result.toISOString().startsWith("2024-01-15")).toBe(true);
    });

    it("should treat number as seconds by default", () => {
      const result = normalizeDateInput(1700000000);
      expect(result.getTime()).toBe(1700000000 * 1000);
    });

    it("should treat number as milliseconds when specified", () => {
      const result = normalizeDateInput(1700000000000, "milliseconds");
      expect(result.getTime()).toBe(1700000000000);
    });

    it("should handle epoch zero", () => {
      const result = normalizeDateInput(0);
      expect(result.getTime()).toBe(0);
    });
  });

  describe("formatDate", () => {
    it("should format a Date object", () => {
      const result = formatDate(new Date("2024-01-15"));
      expect(result).toContain("2024");
      expect(result).toContain("15");
    });

    it("should format a string date", () => {
      const result = formatDate("2024-06-20");
      expect(result).toContain("2024");
      expect(result).toContain("20");
    });

    it("should format a number (seconds)", () => {
      const result = formatDate(1700000000);
      expect(result).toContain("2023");
    });
  });
});
