import { getDatabase } from "./db";
import { settingsGeneral } from "./schema";

export interface Settings {
  pollingInterval: number;
  retentionDays: number;
  openMainWindow: boolean;
}

/**
 * Read the general settings from the database.
 * Returns defaults if the table doesn't exist yet (e.g., before migration runs).
 */
export function getSettings(): Settings {
  const { sqlite } = getDatabase();

  // Guard: table may not exist if migration hasn't run yet
  const exists = sqlite
    .query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings_general'",
    )
    .get();

  if (!exists) {
    return { pollingInterval: 30000, retentionDays: 90, openMainWindow: true };
  }

  const { db } = getDatabase();
  const row = db.select().from(settingsGeneral).get();

  return {
    pollingInterval: row?.pollingInterval ?? 30000,
    retentionDays: row?.retentionDays ?? 90,
    openMainWindow: row?.openMainWindow ?? true,
  };
}

/**
 * Update general settings (partial update).
 */
export function updateSettings(partial: Partial<Settings>): void {
  const { db } = getDatabase();
  const set: Record<string, unknown> = {};

  if (partial.pollingInterval !== undefined) {
    set.pollingInterval = partial.pollingInterval;
  }
  if (partial.retentionDays !== undefined) {
    set.retentionDays = partial.retentionDays;
  }
  if (partial.openMainWindow !== undefined) {
    set.openMainWindow = partial.openMainWindow;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsGeneral).set(set).run();
  }
}
