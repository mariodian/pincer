// Settings RPC - Shared RPC definition for settings management
import {
  getSettings as getSettingsFromDb,
  updateSettings as updateSettingsToDb,
} from "../storage/sqlite/settingsRepo";
import type { Settings } from "../../shared/types";
import { restartStatusUpdates } from "../services/statusService";

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
    return getSettingsFromDb();
  },
  updateSettings: async (partial: Partial<Settings>) => {
    updateSettingsToDb(partial);

    if (partial.pollingInterval !== undefined) {
      await restartStatusUpdates();
    }
  },
};
