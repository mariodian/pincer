// Settings RPC - Shared RPC definition for settings management
import {
  getSettings as getSettingsFromDb,
  updateSettings as updateSettingsToDb,
} from "../storage/sqlite/settingsRepo";
import {
  getAdvancedSettings as getAdvancedSettingsFromDb,
  updateAdvancedSettings as updateAdvancedSettingsToDb,
} from "../storage/sqlite/advancedSettingsRepo";
import type { Settings, AdvancedSettings } from "../../shared/types";
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
      getAdvancedSettings: {
        params: Record<string, never>;
        response: AdvancedSettings;
      };
      updateAdvancedSettings: {
        params: Partial<AdvancedSettings>;
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
    } catch (error) {
      logger.error("settingsRPC", "Failed to update settings:", error);
      throw error;
    }
  },
  getAdvancedSettings: async () => {
    try {
      return getAdvancedSettingsFromDb();
    } catch (error) {
      logger.error("settingsRPC", "Failed to get advanced settings:", error);
      throw error;
    }
  },
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
};
