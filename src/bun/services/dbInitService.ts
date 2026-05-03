import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

import { getDatabaseInstances } from "../../shared/db-core";
import { getMeta, hasMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import {
  settingsAdvanced,
  settingsDaemon,
  settingsGeneral,
  settingsNotifications,
} from "../storage/sqlite/schema";
import { isMacOS } from "../utils/platform";
import { logger } from "./loggerService";

/**
 * Handles all database initialization tasks that run after migrations.
 * This includes seeding default data, setting platform-specific defaults,
 * and any future one-time setup logic.
 */
export async function runDatabaseInitialization(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): Promise<void> {
  // Seed the settings_general row if it doesn't exist
  // (handles first run before any migrations exist)
  seedSettingsGeneral(db);

  // Seed the settings_advanced row if it doesn't exist
  // Required for fresh installs - migrations create the table but not the row
  seedSettingsAdvanced(db);

  // Seed the settings_notifications row if it doesn't exist
  seedSettingsNotifications(db);

  // Seed the settings_daemon row if it doesn't exist
  seedSettingsDaemon(db);

  // Handle fresh install platform-specific defaults
  await handleFreshInstallDefaults(db);

  // Fix for broken migrations 0022/0024 — see migration file comments for details
  fixMissingUniqueIndexes();
}

function seedSettingsGeneral(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): void {
  try {
    db.insert(settingsGeneral).values({ id: 1 }).onConflictDoNothing().run();
  } catch (error) {
    logger.warn("db-init", "Failed to seed settings_general:", error);
  }
}

function seedSettingsAdvanced(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): void {
  try {
    // Insert default row - uses schema defaults (useNativeTray=true, etc.)
    // macOS override happens in handleFreshInstallDefaults
    db.insert(settingsAdvanced).values({ id: 1 }).onConflictDoNothing().run();
    logger.debug("db-init", "Seeded settings_advanced row");
  } catch (error) {
    logger.warn("db-init", "Failed to seed settings_advanced:", error);
  }
}

function seedSettingsNotifications(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): void {
  try {
    // Insert default row - uses schema defaults (notificationsEnabled=false by default)
    db.insert(settingsNotifications)
      .values({ id: 1 })
      .onConflictDoNothing()
      .run();
    logger.debug("db-init", "Seeded settings_notifications row");
  } catch (error) {
    logger.warn("db-init", "Failed to seed settings_notifications:", error);
  }
}

function seedSettingsDaemon(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): void {
  try {
    // Insert default row - uses schema defaults (enabled=false by default)
    db.insert(settingsDaemon).values({ id: 1 }).onConflictDoNothing().run();
    logger.debug("db-init", "Seeded settings_daemon row");
  } catch (error) {
    logger.warn("db-init", "Failed to seed settings_daemon:", error);
  }
}

async function handleFreshInstallDefaults(
  db: BunSQLiteDatabase<Record<string, unknown>>,
): Promise<void> {
  if (hasMeta("initialized")) {
    return; // Already initialized, skip
  }

  // Migration 0012+ creates settings_advanced with useNativeTray=1 (native) by default
  // For macOS, we want popover (useNativeTray=false), so override it
  if (isMacOS()) {
    try {
      db.update(settingsAdvanced).set({ useNativeTray: false }).run();
      logger.info("db-init", "Fresh install: set macOS to use popover tray");
    } catch (error) {
      logger.warn("db-init", "Failed to set macOS tray default:", error);
    }
  }

  setMeta("initialized", "true");
  logger.info("db-init", "Fresh install initialization complete");
}

/**
 * Check if this is a fresh install (never been initialized).
 * Useful for conditional logic outside of the init flow.
 */
export function isFreshInstall(): boolean {
  return !hasMeta("initialized");
}

/**
 * Get the app version when first initialized.
 * Useful for tracking which version introduced certain settings.
 */
export function getInitialVersion(): string | null {
  return hasMeta("initialized") ? getMeta("initial_version") : null;
}

/**
 * Set the initial version marker. Should be called during first init.
 */
export function setInitialVersion(version: string): void {
  if (!hasMeta("initial_version")) {
    setMeta("initial_version", version);
  }
}

/**
 * Fix missing unique indexes from broken migrations 0022 and 0024.
 *
 * The original migration files were missing --> statement-breakpoint between
 * their two SQL statements (DELETE + CREATE UNIQUE INDEX). Drizzle splits .sql
 * files by that delimiter, and bun:sqlite's prepare() only executes the first
 * statement in a multi-statement string. So the CREATE UNIQUE INDEX was
 * silently skipped, even though the migration was recorded as applied.
 *
 * This one-time fix re-applies both deduplication and unique index creation
 * for databases that ran the broken version (v0.3.6 and earlier).
 * Fresh databases are handled by the fixed migration files.
 *
 * Fixed 2026-05-03.
 */
function fixMissingUniqueIndexes(): void {
  if (hasMeta("fix_0022_0024_unique_indexes")) return;

  const { sqlite } = getDatabaseInstances() ?? {};
  if (!sqlite) return;

  try {
    // 0022: Deduplicate checks + add unique index
    sqlite.exec(`
      DELETE FROM checks
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM checks
        GROUP BY agent_id, checked_at
      );
    `);
    sqlite.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_checks_agent_time ON checks (agent_id, checked_at)`,
    );

    // 0024: Deduplicate incident_events + add unique index
    sqlite.exec(`
      DELETE FROM incident_events
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM incident_events
        GROUP BY agent_id, incident_id, event_type, event_at
      );
    `);
    sqlite.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_incident_events ON incident_events (agent_id, incident_id, event_type, event_at)`,
    );

    setMeta("fix_0022_0024_unique_indexes", "true");
    logger.info(
      "db-init",
      "Applied fix for missing unique indexes from migrations 0022/0024",
    );
  } catch (error) {
    logger.warn("db-init", "Failed to apply unique index fix:", error);
  }
}
