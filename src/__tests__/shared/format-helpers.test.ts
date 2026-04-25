import { describe, it, expect } from "bun:test";
import {
  formatUptime,
  formatMs,
  formatNumber,
} from "../../shared/format-helpers";

describe("format-helpers", () => {
  describe("formatUptime", () => {
    it("should format uptime percentage with 2 decimals", () => {
      expect(formatUptime(99.5)).toBe("99.50%");
      expect(formatUptime(100)).toBe("100.00%");
      expect(formatUptime(0)).toBe("0.00%");
    });

    it("should handle numeric string", () => {
      expect(formatUptime("98.75")).toBe("98.75%");
    });

    it("should handle zero", () => {
      expect(formatUptime(0)).toBe("0.00%");
    });
  });

  describe("formatMs", () => {
    it("should format milliseconds", () => {
      expect(formatMs(123)).toBe("123ms");
      expect(formatMs(9999)).toBe("9999ms");
    });

    it("should convert to seconds when >= 10000ms", () => {
      expect(formatMs(10000)).toBe("10s");
      expect(formatMs(15000)).toBe("15s");
      expect(formatMs(12345)).toBe("12s");
    });

    it("should handle zero", () => {
      expect(formatMs(0)).toBe("0ms");
    });

    it("should handle numeric string", () => {
      expect(formatMs("5000")).toBe("5000ms");
      expect(formatMs("20000")).toBe("20s");
    });
  });

  describe("formatNumber", () => {
    it("should format with locale separators", () => {
      expect(formatNumber(1234)).toBe("1,234");
      expect(formatNumber(1000000)).toBe("1,000,000");
    });

    it("should handle zero", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("should handle numeric string", () => {
      expect(formatNumber("5678")).toBe("5,678");
    });

    it("should handle negative numbers", () => {
      expect(formatNumber(-1234)).toContain("1,234");
    });
  });
});
