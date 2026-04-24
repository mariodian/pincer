import type {
  DaemonSettings,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import { withErrorLogging, withErrorResult } from "./rpcHelpers";
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
  getDaemonSettings: () =>
    withErrorLogging("daemonRPC", async () => getDaemonSettingsFromDb()),

  updateDaemonSettings: (partial: Partial<DaemonSettings>) =>
    withErrorLogging("daemonRPC", async () => {
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
    }),

  syncDaemon: () =>
    withErrorResult("daemonRPC", () => sync(), {
      checksImported: 0,
      statsImported: 0,
      incidentsImported: 0,
      openIncidents: [],
    }),

  testDaemonConnection: () =>
    withErrorResult("daemonRPC", () => testDaemonConnection(), {
      connected: false,
      error: "Connection test failed",
    }),

  getLastDaemonSync: () =>
    withErrorResult(
      "daemonRPC",
      async () => {
        const value = getMeta("daemon_last_sync");
        return value ? parseInt(value, 10) : null;
      },
      null,
    ),
};
