/**
 * Test helpers for SQLite repo tests.
 *
 * Creates an in-memory SQLite database with all schema tables.
 * Call setupTestDB() beforeEach and resetTestDB() afterEach.
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import {
  createDatabase,
  resetDatabaseInstances,
} from "../../../../shared/db-core";

export interface TestDB {
  db: ReturnType<typeof drizzle>;
  sqlite: Database;
}

/**
 * Bootstrap an in-memory SQLite database with all application tables.
 * Must be called before using any repo function.
 */
export function setupTestDB(): TestDB {
  resetDatabaseInstances();
  const { db, sqlite } = createDatabase({ dbPath: ":memory:" });

  // ── agents ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      port INTEGER NOT NULL,
      enabled INTEGER DEFAULT true,
      health_endpoint TEXT,
      status_shape TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // ── checks ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      agent_id INTEGER NOT NULL,
      checked_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      response_ms REAL,
      http_status INTEGER,
      error_code TEXT,
      error_message TEXT
    )
  `);
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_checks_agent_time ON checks (agent_id, checked_at)`,
  );
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_checks_time ON checks (checked_at)`,
  );
  sqlite.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_checks_agent_time ON checks (agent_id, checked_at)`,
  );

  // ── stats ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS stats (
      agent_id INTEGER NOT NULL,
      hour_timestamp INTEGER NOT NULL,
      total_checks INTEGER NOT NULL,
      ok_count INTEGER NOT NULL,
      offline_count INTEGER NOT NULL,
      error_count INTEGER NOT NULL,
      uptime_pct REAL NOT NULL,
      avg_response_ms REAL NOT NULL,
      PRIMARY KEY (agent_id, hour_timestamp)
    )
  `);
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_stats_hour ON stats (hour_timestamp)`,
  );

  // ── incident_events ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS incident_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      agent_id INTEGER NOT NULL,
      incident_id TEXT NOT NULL,
      event_at INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      reason TEXT,
      linked_incident_id TEXT
    )
  `);
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_incident_events_agent_incident ON incident_events (agent_id, incident_id)`,
  );
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_incident_events_time ON incident_events (event_at)`,
  );
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_incident_events_incident_type ON incident_events (incident_id, event_type)`,
  );
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_incident_events_linked_type ON incident_events (linked_incident_id, event_type)`,
  );
  sqlite.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_incident_events ON incident_events (agent_id, incident_id, event_type, event_at)`,
  );

  // ── settings_general ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS settings_general (
      id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
      retention_days INTEGER DEFAULT 90 NOT NULL,
      open_main_window INTEGER DEFAULT true NOT NULL,
      show_disabled_agents INTEGER DEFAULT false NOT NULL,
      launch_at_login INTEGER DEFAULT false NOT NULL
    )
  `);

  // ── settings_advanced ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS settings_advanced (
      id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
      polling_interval INTEGER DEFAULT 15000 NOT NULL,
      use_native_tray INTEGER DEFAULT true NOT NULL,
      auto_check_update INTEGER DEFAULT true NOT NULL
    )
  `);

  // ── settings_notifications ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS settings_notifications (
      id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
      notifications_enabled INTEGER DEFAULT false NOT NULL,
      notify_on_status_change INTEGER DEFAULT true NOT NULL,
      notify_on_error INTEGER DEFAULT true NOT NULL,
      status_change_threshold INTEGER DEFAULT 2 NOT NULL,
      silent_notifications INTEGER DEFAULT false NOT NULL,
      failure_threshold INTEGER DEFAULT 3 NOT NULL,
      recovery_threshold INTEGER DEFAULT 2 NOT NULL
    )
  `);

  // ── settings_daemon ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS settings_daemon (
      id INTEGER PRIMARY KEY DEFAULT 1 NOT NULL,
      enabled INTEGER DEFAULT false NOT NULL,
      url TEXT DEFAULT '' NOT NULL,
      secret TEXT DEFAULT '' NOT NULL,
      namespace_key TEXT DEFAULT '' NOT NULL
    )
  `);

  // ── app_state ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  // ── app_meta ──
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    )
  `);

  return { db, sqlite };
}

/**
 * Reset singletons so the next test gets a fresh database.
 */
export function resetTestDB(): void {
  resetDatabaseInstances();
}
