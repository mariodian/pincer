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

const {
  getAppState,
  setAppState,
  getWindowBounds,
  setWindowBounds,
  getLastUpdateCheck,
  setLastUpdateCheck,
  removeAppState,
  clearAppState,
} = await import("../../../../bun/storage/sqlite/appStateRepo");

describe("appStateRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getAppState / setAppState ─────────────────────────────────────────────

  describe("getAppState / setAppState", () => {
    it("should round-trip a simple object", () => {
      setAppState("prefs", { theme: "dark", zoom: 1.5 });
      const prefs = getAppState<{ theme: string; zoom: number }>("prefs");
      expect(prefs).toEqual({ theme: "dark", zoom: 1.5 });
    });

    it("should return null for missing key", () => {
      expect(getAppState("missing")).toBeNull();
    });

    it("should return null for unparseable JSON", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO app_state (key, value) VALUES ('bad', 'not json')`,
      );
      expect(getAppState("bad")).toBeNull();
    });

    it("should overwrite existing key", () => {
      setAppState("counter", 1);
      setAppState("counter", 2);
      expect(getAppState<number>("counter")).toBe(2);
    });

    it("should handle arrays", () => {
      setAppState("list", [1, 2, 3]);
      expect(getAppState<number[]>("list")).toEqual([1, 2, 3]);
    });

    it("should handle null values", () => {
      setAppState("nullable", null);
      expect(getAppState<null>("nullable")).toBeNull();
    });
  });

  // ─── getWindowBounds / setWindowBounds ─────────────────────────────────────

  describe("getWindowBounds / setWindowBounds", () => {
    it("should round-trip window bounds", () => {
      setWindowBounds({ x: 10, y: 20, width: 800, height: 600 });
      const bounds = getWindowBounds();
      expect(bounds).toEqual({ x: 10, y: 20, width: 800, height: 600 });
    });

    it("should return null when not set", () => {
      expect(getWindowBounds()).toBeNull();
    });
  });

  // ─── getLastUpdateCheck / setLastUpdateCheck ───────────────────────────────

  describe("getLastUpdateCheck / setLastUpdateCheck", () => {
    it("should round-trip timestamp", () => {
      setLastUpdateCheck(1700000000000);
      expect(getLastUpdateCheck()).toBe(1700000000000);
    });

    it("should return null when not set", () => {
      expect(getLastUpdateCheck()).toBeNull();
    });
  });

  // ─── removeAppState ────────────────────────────────────────────────────────

  describe("removeAppState", () => {
    it("should remove a key", () => {
      setAppState("temp", "value");
      removeAppState("temp");
      expect(getAppState("temp")).toBeNull();
    });

    it("should not throw when removing non-existent key", () => {
      removeAppState("never-existed");
      expect(getAppState("never-existed")).toBeNull();
    });
  });

  // ─── clearAppState ─────────────────────────────────────────────────────────

  describe("clearAppState", () => {
    it("should remove all keys", () => {
      setAppState("a", 1);
      setAppState("b", 2);
      clearAppState();
      expect(getAppState("a")).toBeNull();
      expect(getAppState("b")).toBeNull();
    });

    it("should not throw on empty table", () => {
      clearAppState();
      expect(getAppState("any")).toBeNull();
    });
  });
});
