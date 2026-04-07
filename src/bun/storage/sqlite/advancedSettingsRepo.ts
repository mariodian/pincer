import { logger } from "../../services/loggerService";
import { getDatabase } from "./db";
import { settingsAdvanced } from "./schema";

export interface AdvancedSettings {
  pollingInterval: number;
  useNativeTray: boolean;
  autoCheckUpdate: boolean;
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
    autoCheckUpdate: row?.autoCheckUpdate ?? true,
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
  if (partial.autoCheckUpdate !== undefined) {
    set.autoCheckUpdate = partial.autoCheckUpdate;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsAdvanced).set(set).run();
    logger.debug(
      "advancedSettings",
      `Advanced settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
