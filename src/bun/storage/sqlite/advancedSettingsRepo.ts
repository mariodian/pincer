import { isMacOS } from "../../utils/platform";
import { getDatabase } from "./db";
import { settingsAdvanced } from "./schema";
import { logger } from "../../services/loggerService";

export interface AdvancedSettings {
  pollingInterval: number;
  useNativeTray: boolean;
  autoCheckEnabled: boolean;
}

/**
 * Ensure the settings row exists (id=1).
 * This is a no-op if the row already exists.
 */
function ensureSettingsRowExists(): void {
  const { db } = getDatabase();
  const existing = db.select().from(settingsAdvanced).get();
  if (!existing) {
    db.insert(settingsAdvanced)
      .values({
        id: 1,
        pollingInterval: 30000,
        useNativeTray: isMacOS(),
        autoCheckEnabled: true,
      })
      .run();
    logger.debug("advancedSettings", "Created initial settings row");
  }
}

/**
 * Read the advanced settings from the database.
 * Returns defaults for any unset fields.
 */
export function getAdvancedSettings(): AdvancedSettings {
  const { db } = getDatabase();
  ensureSettingsRowExists();
  const row = db.select().from(settingsAdvanced).get();

  return {
    pollingInterval: row?.pollingInterval ?? 30000,
    useNativeTray: row?.useNativeTray ?? isMacOS(),
    autoCheckEnabled: row?.autoCheckEnabled ?? true,
  };
}

/**
 * Update advanced settings (partial update).
 */
export function updateAdvancedSettings(
  partial: Partial<AdvancedSettings>,
): void {
  const { db } = getDatabase();
  ensureSettingsRowExists();

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
