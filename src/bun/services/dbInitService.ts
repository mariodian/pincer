import { getMeta, hasMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { settingsGeneral, settingsAdvanced } from "../storage/sqlite/schema";
import { isMacOS } from "../utils/platform";
import { logger } from "./loggerService";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

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

  // Handle fresh install platform-specific defaults
  await handleFreshInstallDefaults(db);
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
