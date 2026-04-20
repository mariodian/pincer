import { getDatabase } from "./db";
import { settingsDaemon } from "./schema";
import { logger } from "../../services/loggerService";
import type { DaemonSettings } from "../../../shared/types";

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
    logger.debug(
      "daemon",
      `Daemon settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
