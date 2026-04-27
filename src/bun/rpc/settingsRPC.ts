// Settings RPC - Shared RPC definition for settings management
import { Utils } from "electrobun/bun";

import type {
  AdvancedSettings,
  NotificationSettings,
  Settings,
} from "../../shared/types";
import {
  disableAutostart,
  enableAutostart,
} from "../services/autostartService";
import { logger } from "../services/loggerService";
import { restartStatusUpdates } from "../services/statusService";
import {
  getAdvancedSettings as getAdvancedSettingsFromDb,
  updateAdvancedSettings as updateAdvancedSettingsToDb,
} from "../storage/sqlite/advancedSettingsRepo";
import {
  getNotificationSettings as getNotificationSettingsFromDb,
  updateNotificationSettings as updateNotificationSettingsToDb,
} from "../storage/sqlite/settingsNotificationsRepo";
import {
  getSettings as getSettingsFromDb,
  updateSettings as updateSettingsToDb,
} from "../storage/sqlite/settingsRepo";
import { withErrorLogging } from "./rpcHelpers";

export type SettingsRPCType = {
  bun: {
    requests: {
      getSettings: {
        params: Record<string, never>;
        response: Settings;
      };
      updateSettings: {
        params: Partial<Settings>;
        response: void;
      };
      getAdvancedSettings: {
        params: Record<string, never>;
        response: AdvancedSettings;
      };
      updateAdvancedSettings: {
        params: Partial<AdvancedSettings>;
        response: void;
      };
      getNotificationSettings: {
        params: Record<string, never>;
        response: NotificationSettings;
      };
      updateNotificationSettings: {
        params: Partial<NotificationSettings>;
        response: void;
      };
      requestNotificationPermission: {
        params: Record<string, never>;
        response: void;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const settingsRequestHandlers = {
  getSettings: () =>
    withErrorLogging("settingsRPC", async () => getSettingsFromDb()),
  updateSettings: async (partial: Partial<Settings>) => {
    try {
      updateSettingsToDb(partial);

      // Handle autostart setting changes
      if (partial.launchAtLogin !== undefined) {
        try {
          if (partial.launchAtLogin) {
            await enableAutostart();
          } else {
            await disableAutostart();
          }
        } catch (autostartError) {
          logger.error(
            "settingsRPC",
            "Failed to update autostart:",
            autostartError,
          );
          // Don't throw - setting is saved even if autostart fails
        }
      }
    } catch (error) {
      logger.error("settingsRPC", "Failed to update settings:", error);
      throw error;
    }
  },
  getAdvancedSettings: () =>
    withErrorLogging("settingsRPC", async () => getAdvancedSettingsFromDb()),
  updateAdvancedSettings: async (partial: Partial<AdvancedSettings>) => {
    try {
      updateAdvancedSettingsToDb(partial);

      if (partial.pollingInterval !== undefined) {
        await restartStatusUpdates();
      }
    } catch (error) {
      logger.error("settingsRPC", "Failed to update advanced settings:", error);
      throw error;
    }
  },
  getNotificationSettings: () =>
    withErrorLogging("settingsRPC", async () =>
      getNotificationSettingsFromDb(),
    ),

  updateNotificationSettings: async (
    partial: Partial<NotificationSettings>,
  ) => {
    try {
      updateNotificationSettingsToDb(partial);
    } catch (error) {
      logger.error(
        "settingsRPC",
        "Failed to update notification settings:",
        error,
      );
      throw error;
    }
  },
  requestNotificationPermission: async () => {
    try {
      // Send a silent notification to trigger the OS permission prompt
      Utils.showNotification({
        title: "Notifications Enabled",
        body: "You will now receive notifications when agent status changes.",
        silent: true,
      });
      logger.debug("settingsRPC", "Notification permission requested");
    } catch (error) {
      logger.error(
        "settingsRPC",
        "Failed to request notification permission:",
        error,
      );
    }
  },
};
