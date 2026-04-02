// Settings RPC - Shared RPC definition for settings management
import {
  getSettings as getSettingsFromDb,
  updateSettings as updateSettingsToDb,
} from "../storage/sqlite/settingsRepo";
import type { Settings } from "../../shared/types";
import { restartStatusUpdates } from "../services/statusService";
import { logger } from "../services/loggerService";

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
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const settingsRequestHandlers = {
  getSettings: async () => {
    try {
      return getSettingsFromDb();
    } catch (error) {
      logger.error("settingsRPC", "Failed to get settings:", error);
      throw error;
    }
  },
  updateSettings: async (partial: Partial<Settings>) => {
    try {
      updateSettingsToDb(partial);

      if (partial.pollingInterval !== undefined) {
        await restartStatusUpdates();
      }
    } catch (error) {
      logger.error("settingsRPC", "Failed to update settings:", error);
      throw error;
    }
  },
};
