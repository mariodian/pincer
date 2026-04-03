import { getDatabase } from "./db";
import { settingsUpdate } from "./schema";
import { logger } from "../../services/loggerService";

export interface UpdateSettings {
  lastCheckTimestamp: number | null;
  autoCheckEnabled: boolean;
}

/**
 * Ensure the settings row exists (id=1).
 * This is a no-op if the row already exists.
 */
function ensureSettingsRowExists(): void {
  const { db } = getDatabase();
  const existing = db.select().from(settingsUpdate).get();
  if (!existing) {
    db.insert(settingsUpdate).values({ id: 1, autoCheckEnabled: true }).run();
    logger.debug("updateSettings", "Created initial settings row");
  }
}

/**
 * Read the update settings from the database.
 * Returns defaults for any unset fields.
 */
export function getUpdateSettings(): UpdateSettings {
  const { db } = getDatabase();
  ensureSettingsRowExists();
  const row = db.select().from(settingsUpdate).get();

  return {
    lastCheckTimestamp: row?.lastCheckTimestamp ?? null,
    autoCheckEnabled: row?.autoCheckEnabled ?? true,
  };
}

/**
 * Update update settings (partial update).
 */
export function updateUpdateSettings(partial: Partial<UpdateSettings>): void {
  const { db } = getDatabase();
  ensureSettingsRowExists();

  const set: Record<string, unknown> = {};

  if (partial.lastCheckTimestamp !== undefined) {
    set.lastCheckTimestamp = partial.lastCheckTimestamp;
  }
  if (partial.autoCheckEnabled !== undefined) {
    set.autoCheckEnabled = partial.autoCheckEnabled;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsUpdate).set(set).run();
    logger.debug(
      "updateSettings",
      `Update settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
