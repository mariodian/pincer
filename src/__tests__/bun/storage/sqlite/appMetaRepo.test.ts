import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { resetTestDB, setupTestDB } from "./test-helpers";

mock.module("electrobun/bun", () => import("../../../mocks/electrobun"));

mock.module("../../../../bun/services/loggerService", () => ({
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

const { getMeta, setMeta, hasMeta } =
  await import("../../../../bun/storage/sqlite/appMetaRepo");

describe("appMetaRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getMeta ───────────────────────────────────────────────────────────────

  describe("getMeta", () => {
    it("should return null for missing key", () => {
      expect(getMeta("missing")).toBeNull();
    });

    it("should return stored string value", () => {
      setMeta("version", "1.2.3");
      expect(getMeta("version")).toBe("1.2.3");
    });
  });

  // ─── setMeta ───────────────────────────────────────────────────────────────

  describe("setMeta", () => {
    it("should insert a new key", () => {
      setMeta("key1", "val1");
      expect(getMeta("key1")).toBe("val1");
    });

    it("should upsert an existing key", () => {
      setMeta("key1", "old");
      setMeta("key1", "new");
      expect(getMeta("key1")).toBe("new");
    });

    it("should store empty string", () => {
      setMeta("empty", "");
      expect(getMeta("empty")).toBe("");
    });

    it("should store numeric strings", () => {
      setMeta("ts", "1700000000000");
      expect(getMeta("ts")).toBe("1700000000000");
    });
  });

  // ─── hasMeta ───────────────────────────────────────────────────────────────

  describe("hasMeta", () => {
    it("should return false for missing key", () => {
      expect(hasMeta("missing")).toBe(false);
    });

    it("should return true for existing key", () => {
      setMeta("exists", "yes");
      expect(hasMeta("exists")).toBe(true);
    });

    it("should return false after key is removed", () => {
      setMeta("gone", "bye");
      const { sqlite } = setupTestDB();
      sqlite.run(`DELETE FROM app_meta WHERE key = 'gone'`);
      expect(hasMeta("gone")).toBe(false);
    });
  });
});
