import { getDatabase } from "./db";
import { settingsDaemon } from "./schema";
import { logger } from "../../services/loggerService";
import type { DaemonSettings } from "../../../shared/types";
import { setMeta } from "./appMetaRepo";

export function getDaemonSettings(): DaemonSettings {
  const { db } = getDatabase();
  const row = db.select().from(settingsDaemon).get();

  return {
    enabled: row?.enabled ?? false,
    url: row?.url ?? "",
    secret: row?.secret ?? "",
  };
}

export function updateDaemonSettings(partial: Partial<DaemonSettings>): void {
  const { db } = getDatabase();
  const set: Record<string, unknown> = {};

  if (partial.enabled !== undefined) set.enabled = partial.enabled;
  if (partial.url !== undefined) set.url = partial.url;
  if (partial.secret !== undefined) set.secret = partial.secret;

  if (Object.keys(set).length > 0) {
    db.update(settingsDaemon).set(set).run();
    const changes = Object.entries(set)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    logger.debug("daemon", `Daemon settings updated: ${changes}`);
  }
}

export function updateDaemonSettingsWithLifecycle(
  partial: Partial<DaemonSettings>,
): void {
  if (partial.enabled === true) {
    const current = getDaemonSettings();
    if (!current.enabled) {
      // Reset sync timestamp to prevent syncing duplicate data from the offline period
      setMeta("daemon_last_sync", Date.now().toString());
      logger.debug(
        "daemon",
        "Daemon enabled - reset sync timestamp to prevent duplicate data",
      );
    }
  }
  updateDaemonSettings(partial);
}
