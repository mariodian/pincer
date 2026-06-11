import type {
  DaemonSettings,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import {
  forceSync,
  sync,
  testDaemonConnection,
} from "../services/daemonSyncService";
import { logger } from "../services/loggerService";
import { getMeta } from "../storage/sqlite/appMetaRepo";
import {
  getDaemonSettings as getDaemonSettingsFromDb,
  updateDaemonSettingsWithLifecycle as updateDaemonSettingsWithLifecycleToDb,
} from "../storage/sqlite/daemonSettingsRepo";
import { withErrorLogging, withErrorResult } from "./rpcHelpers";

export type DaemonSyncRPCType = {
  bun: {
    requests: {
      getDaemonSettings: {
        params: Record<string, never>;
        response: DaemonSettings;
      };
      updateDaemonSettings: { params: Partial<DaemonSettings>; response: void };
      syncDaemon: { params: Record<string, never>; response: DaemonSyncResult };
      forceSyncDaemon: {
        params: Record<string, never>;
        response: { success: boolean };
      };
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
  webview: {
    requests: Record<string, never>;
    messages: {
      forceSyncComplete: DaemonSyncResult;
    };
  };
};

export const daemonRequestHandlers = {
  getDaemonSettings: () =>
    withErrorLogging("daemonRPC", async () => getDaemonSettingsFromDb()),

  updateDaemonSettings: (partial: Partial<DaemonSettings>) =>
    withErrorLogging("daemonRPC", async () => {
      const { settingsChanged } =
        updateDaemonSettingsWithLifecycleToDb(partial);
      // Sync agents when connection details change (new daemon or reconnected)
      if (settingsChanged) {
        logger.debug(
          "daemonRPC",
          "Connection settings changed - syncing agents and data",
        );
        await sync();
      }
    }),

  syncDaemon: () =>
    withErrorResult(
      "daemonRPC",
      async () => {
        return sync();
      },
      {
        success: false,
        error: "Sync failed",
        checksImported: 0,
        statsImported: 0,
        incidentsImported: 0,
        agentsImported: 0,
        openIncidents: [],
      },
    ),

  forceSyncDaemon: () =>
    withErrorResult(
      "daemonRPC",
      async () => {
        return forceSync();
      },
      { success: false },
    ),

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
