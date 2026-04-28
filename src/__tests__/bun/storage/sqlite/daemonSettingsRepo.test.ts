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
  getDaemonSettings,
  updateDaemonSettings,
  updateDaemonSettingsWithLifecycle,
} = await import("../../../../bun/storage/sqlite/daemonSettingsRepo");

describe("daemonSettingsRepo", () => {
  beforeEach(() => setupTestDB());
  afterEach(() => resetTestDB());

  // ─── getDaemonSettings ─────────────────────────────────────────────────────

  describe("getDaemonSettings", () => {
    it("should return defaults when row is missing", () => {
      const s = getDaemonSettings();
      expect(s.enabled).toBe(false);
      expect(s.url).toBe("");
      expect(s.secret).toBe("");
      expect(s.namespaceKey).toBe("");
    });

    it("should return values from DB after seeding", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 1, 'http://daemon', 'sekrit', 'ns1')`,
      );
      const s = getDaemonSettings();
      expect(s.enabled).toBe(true);
      expect(s.url).toBe("http://daemon");
      expect(s.secret).toBe("sekrit");
      expect(s.namespaceKey).toBe("ns1");
    });
  });

  // ─── updateDaemonSettings ──────────────────────────────────────────────────

  describe("updateDaemonSettings", () => {
    it("should update a single field", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, '', '', '')`,
      );

      updateDaemonSettings({ url: "http://new" });

      const s = getDaemonSettings();
      expect(s.url).toBe("http://new");
      expect(s.enabled).toBe(false);
      expect(s.secret).toBe("");
    });

    it("should update multiple fields", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, '', '', '')`,
      );

      updateDaemonSettings({ enabled: true, secret: "abc" });

      const s = getDaemonSettings();
      expect(s.enabled).toBe(true);
      expect(s.secret).toBe("abc");
      expect(s.url).toBe("");
    });

    it("should be a no-op for empty object", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 1, 'u', 's', 'n')`,
      );

      updateDaemonSettings({});

      const s = getDaemonSettings();
      expect(s.enabled).toBe(true);
      expect(s.url).toBe("u");
    });
  });

  // ─── updateDaemonSettingsWithLifecycle ─────────────────────────────────────

  describe("updateDaemonSettingsWithLifecycle", () => {
    it("should detect daemonJustEnabled when enabling from disabled", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, '', '', '')`,
      );

      const result = updateDaemonSettingsWithLifecycle({ enabled: true });
      expect(result.daemonJustEnabled).toBe(true);
    });

    it("should not detect daemonJustEnabled when already enabled", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 1, '', '', '')`,
      );

      const result = updateDaemonSettingsWithLifecycle({ enabled: true });
      expect(result.daemonJustEnabled).toBe(false);
    });

    it("should detect settingsChanged when url changes and url/secret are non-empty", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, 'http://old', 'secret', '')`,
      );

      const result = updateDaemonSettingsWithLifecycle({ url: "http://new" });
      expect(result.settingsChanged).toBe(true);
    });

    it("should not detect settingsChanged when url changes but secret is empty", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, '', '', '')`,
      );

      const result = updateDaemonSettingsWithLifecycle({ url: "http://new" });
      expect(result.settingsChanged).toBe(false);
    });

    it("should write daemon_last_sync meta when enabling", () => {
      const { sqlite } = setupTestDB();
      sqlite.run(
        `INSERT INTO settings_daemon (id, enabled, url, secret, namespace_key) VALUES (1, 0, '', '', '')`,
      );

      updateDaemonSettingsWithLifecycle({ enabled: true });

      const meta = sqlite
        .prepare("SELECT value FROM app_meta WHERE key = 'daemon_last_sync'")
        .get() as { value: string } | undefined;
      expect(meta).toBeDefined();
      expect(Number(meta!.value)).toBeGreaterThan(0);
    });
  });
});
