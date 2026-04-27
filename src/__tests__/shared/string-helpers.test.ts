import { describe, expect, it } from "bun:test";

import { stringToOklch } from "../../shared/string-helpers";

describe("string-helpers", () => {
  describe("stringToOklch", () => {
    it("should return a valid oklch string", () => {
      const result = stringToOklch("test");
      expect(result).toMatch(/^oklch\([\d.]+\s+[\d.]+\s+[\d.]+\)$/);
    });

    it("should be deterministic for the same input", () => {
      const r1 = stringToOklch("hello");
      const r2 = stringToOklch("hello");
      expect(r1).toBe(r2);
    });

    it("should produce different colors for different inputs", () => {
      const r1 = stringToOklch("hello");
      const r2 = stringToOklch("world");
      expect(r1).not.toBe(r2);
    });

    it("should respect lightness range", () => {
      const result = stringToOklch("test", { lightness: [0.5, 0.6] });
      const l = parseFloat(result.match(/oklch\(([\d.]+)/)![1]);
      expect(l).toBeGreaterThanOrEqual(0.5);
      expect(l).toBeLessThanOrEqual(0.6);
    });

    it("should respect chroma range", () => {
      const result = stringToOklch("test", { chroma: [0.1, 0.15] });
      const c = parseFloat(result.match(/oklch\([\d.]+\s+([\d.]+)/)![1]);
      expect(c).toBeGreaterThanOrEqual(0.1);
      expect(c).toBeLessThanOrEqual(0.15);
    });

    it("should produce hue between 0 and 360", () => {
      const result = stringToOklch("test");
      const h = parseFloat(
        result.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/)![1],
      );
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    });

    it("should handle empty string", () => {
      const result = stringToOklch("");
      expect(result).toMatch(/^oklch\(/);
    });

    it("should handle unicode strings", () => {
      const result = stringToOklch("Hello World 🌍");
      expect(result).toMatch(/^oklch\(/);
    });
  });
});
