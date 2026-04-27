import type { DaemonSettings } from "../../../shared/types";
import { logger } from "../../services/loggerService";
import { setMeta } from "./appMetaRepo";
import { getDatabase } from "./db";
import { settingsDaemon } from "./schema";

export function getDaemonSettings(): DaemonSettings {
  const { db } = getDatabase();
  const row = db.select().from(settingsDaemon).get();

  return {
    enabled: row?.enabled ?? false,
    url: row?.url ?? "",
    secret: row?.secret ?? "",
    namespaceKey: row?.namespaceKey ?? "",
  };
}

export function updateDaemonSettings(partial: Partial<DaemonSettings>): void {
  const { db } = getDatabase();
  const set: Record<string, unknown> = {};

  if (partial.enabled !== undefined) set.enabled = partial.enabled;
  if (partial.url !== undefined) set.url = partial.url;
  if (partial.secret !== undefined) set.secret = partial.secret;
  if (partial.namespaceKey !== undefined) {
    set.namespaceKey = partial.namespaceKey;
  }

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
): { settingsChanged: boolean; daemonJustEnabled: boolean } {
  const current = getDaemonSettings();
  const daemonJustEnabled = partial.enabled === true && !current.enabled;

  if (daemonJustEnabled) {
    // Reset sync timestamp to prevent syncing duplicate data from the offline period
    setMeta("daemon_last_sync", Date.now().toString());
    logger.debug(
      "daemon",
      "Daemon enabled - reset sync timestamp to prevent duplicate data",
    );
  }

  updateDaemonSettings(partial);

  // Push agents when connection details change (new daemon or reconnected)
  const updated = getDaemonSettings();
  const settingsChanged =
    (partial.url !== undefined || partial.secret !== undefined) &&
    updated.url !== "" &&
    updated.secret !== "";
  return { settingsChanged, daemonJustEnabled };
}
