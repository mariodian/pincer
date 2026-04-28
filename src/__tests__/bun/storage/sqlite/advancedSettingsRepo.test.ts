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

const { getAdvancedSettings, updateAdvancedSettings } =
  await import("../../../../bun/storage/sqlite/advancedSettingsRepo");

describe("advancedSettingsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getAdvancedSettings ───────────────────────────────────────────────────

  describe("getAdvancedSettings", () => {
    it("should return hardcoded defaults when row is missing", () => {
      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(30000);
      expect(settings.useNativeTray).toBe(true);
      expect(settings.autoCheckUpdate).toBe(true);
    });

    it("should return values from DB after seeding", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_advanced (id, polling_interval, use_native_tray, auto_check_update) VALUES (1, 60000, 0, 0)`,
      );
      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(60000);
      expect(settings.useNativeTray).toBe(false);
      expect(settings.autoCheckUpdate).toBe(false);
    });

    // NOTE: SQLite does not allow explicit NULL in NOT NULL columns,
    // so we test defaults by omitting the row entirely (tested above)
    // and by inserting a row with all values set.
  });

  // ─── updateAdvancedSettings ────────────────────────────────────────────────

  describe("updateAdvancedSettings", () => {
    it("should update a single field and leave others unchanged", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_advanced (id, polling_interval, use_native_tray, auto_check_update) VALUES (1, 30000, 1, 1)`,
      );

      updateAdvancedSettings({ pollingInterval: 45000 });

      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(45000);
      expect(settings.useNativeTray).toBe(true);
      expect(settings.autoCheckUpdate).toBe(true);
    });

    it("should update multiple fields at once", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_advanced (id, polling_interval, use_native_tray, auto_check_update) VALUES (1, 30000, 1, 1)`,
      );

      updateAdvancedSettings({ useNativeTray: false, autoCheckUpdate: false });

      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(30000);
      expect(settings.useNativeTray).toBe(false);
      expect(settings.autoCheckUpdate).toBe(false);
    });

    it("should be a no-op when called with empty object", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_advanced (id, polling_interval, use_native_tray, auto_check_update) VALUES (1, 30000, 1, 1)`,
      );

      updateAdvancedSettings({});

      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(30000);
      expect(settings.useNativeTray).toBe(true);
      expect(settings.autoCheckUpdate).toBe(true);
    });

    it("should not crash when called without existing row", () => {
      // No seed — the repo will UPDATE nothing, but shouldn't crash
      updateAdvancedSettings({ pollingInterval: 10000 });
      // Since no row exists, getAdvancedSettings falls back to defaults
      const settings = getAdvancedSettings();
      expect(settings.pollingInterval).toBe(30000);
    });
  });
});
