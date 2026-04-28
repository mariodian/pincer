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

const { getNotificationSettings, updateNotificationSettings } =
  await import("../../../../bun/storage/sqlite/settingsNotificationsRepo");

describe("settingsNotificationsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getNotificationSettings ───────────────────────────────────────────────

  describe("getNotificationSettings", () => {
    it("should return hardcoded defaults when row is missing", () => {
      const s = getNotificationSettings();
      expect(s.notificationsEnabled).toBe(false);
      expect(s.notifyOnStatusChange).toBe(true);
      expect(s.notifyOnError).toBe(true);
      expect(s.statusChangeThreshold).toBe(1);
      expect(s.silentNotifications).toBe(false);
      expect(s.failureThreshold).toBe(3);
      expect(s.recoveryThreshold).toBe(2);
    });

    it("should return values from DB after seeding", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_notifications (id, notifications_enabled, notify_on_status_change, notify_on_error, status_change_threshold, silent_notifications, failure_threshold, recovery_threshold) VALUES (1, 1, 0, 0, 5, 1, 10, 5)`,
      );
      const s = getNotificationSettings();
      expect(s.notificationsEnabled).toBe(true);
      expect(s.notifyOnStatusChange).toBe(false);
      expect(s.notifyOnError).toBe(false);
      expect(s.statusChangeThreshold).toBe(5);
      expect(s.silentNotifications).toBe(true);
      expect(s.failureThreshold).toBe(10);
      expect(s.recoveryThreshold).toBe(5);
    });

    // NOTE: SQLite does not allow explicit NULL in NOT NULL columns,
    // so we test defaults by omitting the row entirely (tested above).
  });

  // ─── updateNotificationSettings ────────────────────────────────────────────

  describe("updateNotificationSettings", () => {
    it("should update a single field and leave others unchanged", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_notifications (id, notifications_enabled, notify_on_status_change, notify_on_error, status_change_threshold, silent_notifications, failure_threshold, recovery_threshold) VALUES (1, 0, 1, 1, 1, 0, 3, 2)`,
      );

      updateNotificationSettings({ failureThreshold: 5 });

      const s = getNotificationSettings();
      expect(s.failureThreshold).toBe(5);
      expect(s.notificationsEnabled).toBe(false);
      expect(s.recoveryThreshold).toBe(2);
    });

    it("should update multiple fields at once", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_notifications (id, notifications_enabled, notify_on_status_change, notify_on_error, status_change_threshold, silent_notifications, failure_threshold, recovery_threshold) VALUES (1, 0, 1, 1, 1, 0, 3, 2)`,
      );

      updateNotificationSettings({
        notificationsEnabled: true,
        silentNotifications: true,
        statusChangeThreshold: 10,
      });

      const s = getNotificationSettings();
      expect(s.notificationsEnabled).toBe(true);
      expect(s.silentNotifications).toBe(true);
      expect(s.statusChangeThreshold).toBe(10);
      expect(s.notifyOnStatusChange).toBe(true);
    });

    it("should be a no-op when called with empty object", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_notifications (id, notifications_enabled, notify_on_status_change, notify_on_error, status_change_threshold, silent_notifications, failure_threshold, recovery_threshold) VALUES (1, 1, 0, 0, 5, 1, 10, 5)`,
      );

      updateNotificationSettings({});

      const s = getNotificationSettings();
      expect(s.notificationsEnabled).toBe(true);
      expect(s.failureThreshold).toBe(10);
    });

    it("should handle threshold boundary values", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_notifications (id, notifications_enabled, notify_on_status_change, notify_on_error, status_change_threshold, silent_notifications, failure_threshold, recovery_threshold) VALUES (1, 0, 1, 1, 1, 0, 3, 2)`,
      );

      updateNotificationSettings({
        statusChangeThreshold: 0,
        failureThreshold: 1,
        recoveryThreshold: 1,
      });

      const s = getNotificationSettings();
      expect(s.statusChangeThreshold).toBe(0);
      expect(s.failureThreshold).toBe(1);
      expect(s.recoveryThreshold).toBe(1);
    });
  });
});
