import type {
  DaemonSettings,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import { withErrorLogging, withErrorResult } from "./rpcHelpers";
import {
  getDaemonSettings as getDaemonSettingsFromDb,
  updateDaemonSettingsWithLifecycle as updateDaemonSettingsWithLifecycleToDb,
} from "../storage/sqlite/daemonSettingsRepo";
import { getMeta } from "../storage/sqlite/appMetaRepo";
import { sync, testDaemonConnection, pushAgentsToDaemon } from "../services/daemonSyncService";
import { logger } from "../services/loggerService";

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
      const { settingsChanged } = updateDaemonSettingsWithLifecycleToDb(partial);
      // Push agents when connection details change (new daemon or reconnected)
      if (settingsChanged) {
        logger.debug("daemonRPC", "Connection settings changed - pushing agents to daemon");
        await pushAgentsToDaemon();
      }
    }),

  syncDaemon: () =>
    withErrorResult("daemonRPC", async () => {
      // Push agents first to ensure daemon has latest agent list before syncing
      await pushAgentsToDaemon();
      return sync();
    }, {
      success: false,
      error: "Sync failed",
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
