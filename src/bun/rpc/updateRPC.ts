// Update RPC - Shared RPC definition for update management
import { Updater } from "electrobun/bun";
import {
  getAdvancedSettings as getAdvancedSettingsFromDb,
  updateAdvancedSettings as updateAdvancedSettingsToDb,
} from "../storage/sqlite/advancedSettingsRepo";
import {
  getLastUpdateCheck as getLastUpdateCheckFromDb,
  setLastUpdateCheck as setLastUpdateCheckToDb,
} from "../storage/sqlite/appStateRepo";
import { ONE_DAY_MS } from "../utils/constants";
import { isBrewInstall } from "../utils/platform";

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
  autoCheckUpdate: boolean;
  updateAvailable: boolean;
  newVersion?: string;
  newHash?: string;
  isBrewInstall: boolean;
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

/**
 * Perform the actual update check, cache the result, and update the timestamp.
 * Returns the check result for further processing by callers.
 */
async function checkAndCacheUpdate(): Promise<{
  updateAvailable: boolean;
  version?: string;
  hash?: string;
}> {
  const result = await Updater.checkForUpdate();

  // Update the last check timestamp in app state
  setLastUpdateCheckToDb(Date.now());

  // Cache the result
  cachedUpdateCheck = {
    updateAvailable: result.updateAvailable,
    version: result.version,
    hash: result.hash,
  };

  return result;
}

export const updateRequestHandlers = {
  getUpdateInfo: async (): Promise<UpdateInfoResponse> => {
    try {
      const settings = getAdvancedSettingsFromDb();
      const lastCheckTimestamp = getLastUpdateCheckFromDb();
      const version = await Updater.localInfo.version();
      const hash = await Updater.localInfo.hash();
      const channel = await Updater.localInfo.channel();

      // Use cached check result if available
      const updateAvailable = cachedUpdateCheck?.updateAvailable ?? false;

      return {
        version,
        hash,
        channel,
        lastCheckTimestamp,
        autoCheckUpdate: settings.autoCheckUpdate,
        updateAvailable,
        newVersion: cachedUpdateCheck?.version,
        newHash: cachedUpdateCheck?.hash,
        isBrewInstall: isBrewInstall(),
      };
    } catch (error) {
      logger.error("updateRPC", "Failed to get update info:", error);
      throw error;
    }
  },

  checkForUpdate: async (): Promise<UpdateCheckResponse> => {
    try {
      const result = await checkAndCacheUpdate();

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
      updateAdvancedSettingsToDb({ autoCheckUpdate: enabled });
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
    const settings = getAdvancedSettingsFromDb();

    if (!settings.autoCheckUpdate) {
      logger.debug("update", "Auto-check disabled, skipping");
      return;
    }

    const now = Date.now();

    const lastCheckTimestamp = getLastUpdateCheckFromDb();
    if (lastCheckTimestamp && now - lastCheckTimestamp < ONE_DAY_MS) {
      logger.debug(
        "update",
        `Last check was ${new Date(lastCheckTimestamp).toLocaleString()}, skipping auto-check`,
      );
      return;
    }

    logger.info("update", "Performing automatic update check...");
    const result = await checkAndCacheUpdate();

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
