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
import { getMeta } from "../storage/sqlite/appMetaRepo";
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
