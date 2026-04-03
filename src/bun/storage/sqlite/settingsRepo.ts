import { isMacOS } from "../../utils/platform";
import { getDatabase } from "./db";
import { settingsGeneral } from "./schema";
import { logger } from "../../services/loggerService";

export interface Settings {
  pollingInterval: number;
  retentionDays: number;
  openMainWindow: boolean;
  showDisabledAgents: boolean;
  useNativeTray: boolean;
}

/**
 * Read the general settings from the database.
 * Returns defaults for any unset fields.
 */
export function getSettings(): Settings {
  const { db } = getDatabase();
  const row = db.select().from(settingsGeneral).get();

  return {
    pollingInterval: row?.pollingInterval ?? 30000,
    retentionDays: row?.retentionDays ?? 90,
    openMainWindow: row?.openMainWindow ?? true,
    showDisabledAgents: row?.showDisabledAgents ?? false,
    useNativeTray: row?.useNativeTray ?? isMacOS(),
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
  if (partial.showDisabledAgents !== undefined) {
    set.showDisabledAgents = partial.showDisabledAgents;
  }
  if (partial.useNativeTray !== undefined) {
    set.useNativeTray = partial.useNativeTray;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsGeneral).set(set).run();
    logger.debug(
      "settings",
      `Settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
