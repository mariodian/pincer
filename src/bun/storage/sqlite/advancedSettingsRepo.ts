import { logger } from "../../services/loggerService";
import { getDatabase } from "./db";
import { settingsAdvanced } from "./schema";

export interface AdvancedSettings {
  pollingInterval: number;
  useNativeTray: boolean;
  autoCheckEnabled: boolean;
}

/**
 * Read the advanced settings from the database.
 * Assumes settings row exists (created by migration).
 */
export function getAdvancedSettings(): AdvancedSettings {
  const { db } = getDatabase();
  const row = db.select().from(settingsAdvanced).get();

  // Migration guarantees row exists, but keep fallbacks for safety
  return {
    pollingInterval: row?.pollingInterval ?? 30000,
    useNativeTray: row?.useNativeTray ?? true,
    autoCheckEnabled: row?.autoCheckEnabled ?? true,
  };
}

/**
 * Update advanced settings (partial update).
 * Assumes settings row exists (created by migration).
 */
export function updateAdvancedSettings(
  partial: Partial<AdvancedSettings>,
): void {
  const { db } = getDatabase();

  const set: Record<string, unknown> = {};

  if (partial.pollingInterval !== undefined) {
    set.pollingInterval = partial.pollingInterval;
  }
  if (partial.useNativeTray !== undefined) {
    set.useNativeTray = partial.useNativeTray;
  }
  if (partial.autoCheckEnabled !== undefined) {
    set.autoCheckEnabled = partial.autoCheckEnabled;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsAdvanced).set(set).run();
    logger.debug(
      "advancedSettings",
      `Advanced settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
