import { describe, expect, it, mock } from "bun:test";

mock.module("../../../../bun/services/loggerService", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

const { getDatabase } = await import("../../../../bun/storage/sqlite/db");

describe("mock test", () => {
  it("should not crash", () => {
    expect(typeof getDatabase).toBe("function");
  });
});
