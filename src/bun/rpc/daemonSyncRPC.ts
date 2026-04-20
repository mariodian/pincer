import type {
  DaemonSettings,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import { logger } from "../services/loggerService";
import {
  getDaemonSettings as getDaemonSettingsFromDb,
  updateDaemonSettings as updateDaemonSettingsToDb,
} from "../storage/sqlite/daemonSettingsRepo";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { sync, testDaemonConnection } from "../services/daemonSyncService";

export type DaemonSyncRPCType = {
  bun: {
    requests: {
      getDaemonSettings: {
        params: Record<string, never>;
        response: DaemonSettings;
      };
      updateDaemonSettings: { params: Partial<DaemonSettings>; response: void };
      syncDaemon: { params: Record<string, never>; response: DaemonSyncResult };
      testDaemonConnection: {
        params: Record<string, never>;
        response: DaemonTestResult;
      };
      getLastDaemonSync: {
        params: Record<string, never>;
        response: number | null;
      };
    };
    messages: Record<string, never>;
  };
  webview: { requests: Record<string, never>; messages: Record<string, never> };
};

export const daemonRequestHandlers = {
  getDaemonSettings: async () => {
    try {
      return getDaemonSettingsFromDb();
    } catch (error) {
      logger.error("daemonRPC", "Failed to get daemon settings:", error);
      throw error;
    }
  },

  updateDaemonSettings: async (partial: Partial<DaemonSettings>) => {
    try {
      // Check if daemon is being enabled (transition from disabled to enabled)
      if (partial.enabled === true) {
        const currentSettings = getDaemonSettingsFromDb();
        if (!currentSettings.enabled) {
          // Daemon was disabled, now being enabled - reset sync timestamp
          // to prevent syncing duplicate data from the offline period
          setMeta("daemon_last_sync", Date.now().toString());
          logger.debug(
            "daemonRPC",
            "Daemon enabled - reset sync timestamp to prevent duplicate data",
          );
        }
      }
      updateDaemonSettingsToDb(partial);
    } catch (error) {
      logger.error("daemonRPC", "Failed to update daemon settings:", error);
      throw error;
    }
  },

  syncDaemon: async () => {
    try {
      return await sync();
    } catch (error) {
      logger.error("daemonRPC", "Daemon sync failed:", error);
      return { checksImported: 0, statsImported: 0, incidentsImported: 0 };
    }
  },

  testDaemonConnection: async () => {
    try {
      return await testDaemonConnection();
    } catch (error) {
      logger.error("daemonRPC", "Daemon connection test failed:", error);
      return { connected: false, error: String(error) };
    }
  },

  getLastDaemonSync: async () => {
    try {
      const value = getMeta("daemon_last_sync");
      return value ? parseInt(value, 10) : null;
    } catch (error) {
      logger.error("daemonRPC", "Failed to get last daemon sync:", error);
      return null;
    }
  },
};
