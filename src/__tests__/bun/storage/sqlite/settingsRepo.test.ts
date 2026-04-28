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

const { getSettings, updateSettings } =
  await import("../../../../bun/storage/sqlite/settingsRepo");

describe("settingsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getSettings ───────────────────────────────────────────────────────────

  describe("getSettings", () => {
    it("should return hardcoded defaults when row is missing", () => {
      const s = getSettings();
      expect(s.retentionDays).toBe(90);
      expect(s.openMainWindow).toBe(true);
      expect(s.showDisabledAgents).toBe(false);
      expect(s.launchAtLogin).toBe(false);
    });

    it("should return values from DB after seeding", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_general (id, retention_days, open_main_window, show_disabled_agents, launch_at_login) VALUES (1, 30, 0, 1, 1)`,
      );
      const s = getSettings();
      expect(s.retentionDays).toBe(30);
      expect(s.openMainWindow).toBe(false);
      expect(s.showDisabledAgents).toBe(true);
      expect(s.launchAtLogin).toBe(true);
    });

    // NOTE: SQLite does not allow explicit NULL in NOT NULL columns,
    // so we test defaults by omitting the row entirely (tested above).
  });

  // ─── updateSettings ────────────────────────────────────────────────────────

  describe("updateSettings", () => {
    it("should update a single field and leave others unchanged", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_general (id, retention_days, open_main_window, show_disabled_agents, launch_at_login) VALUES (1, 90, 1, 0, 0)`,
      );

      updateSettings({ retentionDays: 7 });

      const s = getSettings();
      expect(s.retentionDays).toBe(7);
      expect(s.openMainWindow).toBe(true);
      expect(s.showDisabledAgents).toBe(false);
      expect(s.launchAtLogin).toBe(false);
    });

    it("should update multiple fields at once", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_general (id, retention_days, open_main_window, show_disabled_agents, launch_at_login) VALUES (1, 90, 1, 0, 0)`,
      );

      updateSettings({ openMainWindow: false, launchAtLogin: true });

      const s = getSettings();
      expect(s.retentionDays).toBe(90);
      expect(s.openMainWindow).toBe(false);
      expect(s.showDisabledAgents).toBe(false);
      expect(s.launchAtLogin).toBe(true);
    });

    it("should be a no-op when called with empty object", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_general (id, retention_days, open_main_window, show_disabled_agents, launch_at_login) VALUES (1, 90, 1, 0, 0)`,
      );

      updateSettings({});

      const s = getSettings();
      expect(s.retentionDays).toBe(90);
      expect(s.openMainWindow).toBe(true);
      expect(s.showDisabledAgents).toBe(false);
      expect(s.launchAtLogin).toBe(false);
    });
  });
});
