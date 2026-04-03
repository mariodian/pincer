// Update RPC - Shared RPC definition for update management
import { Updater } from "electrobun/bun";
import {
  getUpdateSettings as getUpdateSettingsFromDb,
  updateUpdateSettings as updateUpdateSettingsToDb,
} from "../storage/sqlite/updateSettingsRepo";

import { logger } from "../services/loggerService";

export type UpdateRPCType = {
  bun: {
    requests: {
      getUpdateInfo: {
        params: Record<string, never>;
        response: UpdateInfoResponse;
      };
      checkForUpdate: {
        params: Record<string, never>;
        response: UpdateCheckResponse;
      };
      setAutoCheck: {
        params: { enabled: boolean };
        response: void;
      };
      downloadAndApplyUpdate: {
        params: Record<string, never>;
        response: { success: boolean };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export interface UpdateInfoResponse {
  version: string;
  hash: string;
  channel: string;
  lastCheckTimestamp: number | null;
  autoCheckEnabled: boolean;
  updateAvailable: boolean;
  newVersion?: string;
  newHash?: string;
}

export interface UpdateCheckResponse {
  updateAvailable: boolean;
  version?: string;
  hash?: string;
  message: string;
}

// In-memory cache for update status to avoid checking multiple times
let cachedUpdateCheck: {
  updateAvailable: boolean;
  version?: string;
  hash?: string;
} | null = null;

export function clearUpdateCache(): void {
  cachedUpdateCheck = null;
}

export const updateRequestHandlers = {
  getUpdateInfo: async (): Promise<UpdateInfoResponse> => {
    try {
      const settings = getUpdateSettingsFromDb();
      const version = await Updater.localInfo.version();
      const hash = await Updater.localInfo.hash();
      const channel = await Updater.localInfo.channel();

      // Use cached check result if available
      const updateAvailable = cachedUpdateCheck?.updateAvailable ?? false;

      return {
        version,
        hash,
        channel,
        lastCheckTimestamp: settings.lastCheckTimestamp,
        autoCheckEnabled: settings.autoCheckEnabled,
        updateAvailable,
        newVersion: cachedUpdateCheck?.version,
        newHash: cachedUpdateCheck?.hash,
      };
    } catch (error) {
      logger.error("updateRPC", "Failed to get update info:", error);
      throw error;
    }
  },

  checkForUpdate: async (): Promise<UpdateCheckResponse> => {
    try {
      const result = await Updater.checkForUpdate();

      // Update the last check timestamp
      updateUpdateSettingsToDb({
        lastCheckTimestamp: Date.now(),
      });

      // Cache the result
      cachedUpdateCheck = {
        updateAvailable: result.updateAvailable,
        version: result.version,
        hash: result.hash,
      };

      if (result.updateAvailable) {
        return {
          updateAvailable: true,
          version: result.version,
          hash: result.hash,
          message: `Update available: ${result.version}`,
        };
      } else {
        return {
          updateAvailable: false,
          message: "You're up to date!",
        };
      }
    } catch (error) {
      logger.error("updateRPC", "Failed to check for update:", error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  },

  setAutoCheck: async ({ enabled }: { enabled: boolean }): Promise<void> => {
    try {
      updateUpdateSettingsToDb({ autoCheckEnabled: enabled });
      logger.debug(
        "updateRPC",
        `Auto-check ${enabled ? "enabled" : "disabled"}`,
      );
    } catch (error) {
      logger.error("updateRPC", "Failed to set auto-check:", error);
      throw error;
    }
  },

  downloadAndApplyUpdate: async (): Promise<{ success: boolean }> => {
    try {
      if (!cachedUpdateCheck?.updateAvailable) {
        return { success: false };
      }

      logger.info("updateRPC", "Downloading update...");
      await Updater.downloadUpdate();

      const status = Updater.updateInfo();
      if (status?.updateReady) {
        logger.info("updateRPC", "Applying update and restarting...");
        await Updater.applyUpdate();
        return { success: true };
      } else {
        logger.warn("updateRPC", "Update not ready after download");
        return { success: false };
      }
    } catch (error) {
      logger.error("updateRPC", "Failed to download/apply update:", error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  },
};

/**
 * Perform automatic update check if enabled and last check was over 24 hours ago.
 * This is called on app startup.
 */
export async function performAutoUpdateCheck(): Promise<void> {
  try {
    const settings = getUpdateSettingsFromDb();

    if (!settings.autoCheckEnabled) {
      logger.debug("update", "Auto-check disabled, skipping");
      return;
    }

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (
      settings.lastCheckTimestamp &&
      now - settings.lastCheckTimestamp < oneDayMs
    ) {
      logger.debug(
        "update",
        `Last check was ${new Date(settings.lastCheckTimestamp).toLocaleString()}, skipping auto-check`,
      );
      return;
    }

    logger.info("update", "Performing automatic update check...");
    const result = await Updater.checkForUpdate();

    // Update the last check timestamp
    updateUpdateSettingsToDb({
      lastCheckTimestamp: now,
    });

    // Cache the result for UI display
    cachedUpdateCheck = {
      updateAvailable: result.updateAvailable,
      version: result.version,
      hash: result.hash,
    };

    if (result.updateAvailable) {
      logger.info(
        "update",
        `Update available: ${result.version} (${result.hash})`,
      );
    } else {
      logger.debug("update", "No update available");
    }
  } catch (error) {
    logger.error(
      "update",
      "Auto update check failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
