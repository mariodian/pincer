import { logger } from "../../services/loggerService";
import { getDatabase } from "./db";
import { settingsNotifications } from "./schema";

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notifyOnStatusChange: boolean;
  notifyOnError: boolean;
  statusChangeThreshold: number;
  silentNotifications: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
}

/**
 * Read the notification settings from the database.
 * Returns defaults for any unset fields.
 */
export function getNotificationSettings(): NotificationSettings {
  const { db } = getDatabase();
  const row = db.select().from(settingsNotifications).get();

  return {
    notificationsEnabled: row?.notificationsEnabled ?? false,
    notifyOnStatusChange: row?.notifyOnStatusChange ?? true,
    notifyOnError: row?.notifyOnError ?? true,
    statusChangeThreshold: row?.statusChangeThreshold ?? 1,
    silentNotifications: row?.silentNotifications ?? false,
    failureThreshold: row?.failureThreshold ?? 3,
    recoveryThreshold: row?.recoveryThreshold ?? 2,
  };
}

/**
 * Update notification settings (partial update).
 */
export function updateNotificationSettings(
  partial: Partial<NotificationSettings>,
): void {
  const { db } = getDatabase();
  const set: Record<string, unknown> = {};

  if (partial.notificationsEnabled !== undefined) {
    set.notificationsEnabled = partial.notificationsEnabled;
  }
  if (partial.notifyOnStatusChange !== undefined) {
    set.notifyOnStatusChange = partial.notifyOnStatusChange;
  }
  if (partial.notifyOnError !== undefined) {
    set.notifyOnError = partial.notifyOnError;
  }
  if (partial.statusChangeThreshold !== undefined) {
    set.statusChangeThreshold = partial.statusChangeThreshold;
  }
  if (partial.silentNotifications !== undefined) {
    set.silentNotifications = partial.silentNotifications;
  }
  if (partial.failureThreshold !== undefined) {
    set.failureThreshold = partial.failureThreshold;
  }
  if (partial.recoveryThreshold !== undefined) {
    set.recoveryThreshold = partial.recoveryThreshold;
  }

  if (Object.keys(set).length > 0) {
    db.update(settingsNotifications).set(set).run();
    logger.debug(
      "notificationSettings",
      `Notification settings updated: ${Object.keys(set).join(", ")}`,
    );
  }
}
