/**
 * macOS autostart service
 * Routes to SMAppService API on macOS 13+, falls back to LaunchAgent plist on older versions.
 *
 * SMAppService (macOS 13+):
 * - Shows "Pincer" in System Settings → Login Items
 * - Better user experience with proper app name
 * - No immediate launch (no duplicate instances)
 *
 * LaunchAgent (macOS < 13):
 * - Creates plist file in ~/Library/LaunchAgents/
 * - Shows "launcher" in background items
 * - Works without code signing requirements
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { $ } from "bun";
import { Updater, Utils } from "electrobun/bun";

import {
  getMainAppLoginItemStatus,
  isLoginItemEnabled,
  isSMAppServiceAvailable,
  openLoginItemsSettings,
  registerMainAppLoginItem,
  requiresUserApproval,
  unregisterMainAppLoginItem,
} from "../utils/macOSLoginItems";
import { isMacOS, supportsSMAppService } from "../utils/platform";
import { logger } from "./loggerService";

const BUNDLE_ID = "com.mariodian.pincer";

/**
 * Get the current channel (stable, dev, canary).
 */
async function getChannel(): Promise<string> {
  try {
    return await Updater.localInfo.channel();
  } catch (error) {
    logger.warn(
      "autostart",
      "Failed to get channel, defaulting to 'stable':",
      error,
    );
    return "stable";
  }
}

/**
 * Get the channel-specific bundle ID.
 */
async function getChannelBundleId(): Promise<string> {
  const channel = await getChannel();
  return channel === "stable" ? BUNDLE_ID : `${BUNDLE_ID}.${channel}`;
}

/**
 * Get the path to the launcher executable.
 * On macOS bundled apps, this points to the 'launcher' binary inside the .app bundle.
 */
function getLauncherPath(): string {
  if (isMacOS()) {
    // Replace the current executable name with 'launcher'
    // e.g., /Applications/Pincer.app/Contents/MacOS/bun -> /Applications/Pincer.app/Contents/MacOS/launcher
    return process.execPath.replace(/\/MacOS\/[^/]+$/, "/MacOS/launcher");
  }
  return process.execPath;
}

/**
 * Check if autostart is enabled using the appropriate method.
 */
export async function isMacOSAutostartEnabled(): Promise<boolean> {
  try {
    if (supportsSMAppService()) {
      // Use SMAppService API on macOS 13+
      // Check if native lib is available and functional
      if (isSMAppServiceAvailable()) {
        return isLoginItemEnabled();
      }
      // Native lib not available, fallback to checking LaunchAgent
      return checkLaunchAgentExists();
    } else {
      // Use LaunchAgent plist on macOS < 13
      return checkLaunchAgentExists();
    }
  } catch (error) {
    logger.error("autostart", "Failed to check macOS autostart state:", error);
    return false;
  }
}

/**
 * Enable autostart for macOS.
 */
export async function enableMacOSAutostart(): Promise<void> {
  try {
    if (supportsSMAppService()) {
      // Try SMAppService API on macOS 13+
      if (isSMAppServiceAvailable()) {
        const success = registerMainAppLoginItem();
        if (success) {
          logger.info("autostart", "SMAppService login item registered");
          return;
        }
        // Failed to register, might need user approval
        if (requiresUserApproval()) {
          logger.warn(
            "autostart",
            "SMAppService login item requires user approval in System Settings",
          );
          // Still counts as "enabled" from app perspective - user needs to approve
          return;
        }
      }
      // SMAppService not available or failed, fall back to LaunchAgent
      logger.warn(
        "autostart",
        "SMAppService unavailable or failed, falling back to LaunchAgent",
      );
    }

    // Use LaunchAgent fallback (all macOS versions)
    await enableLaunchAgent();
  } catch (error) {
    logger.error("autostart", "Failed to enable macOS autostart:", error);
    throw error;
  }
}

/**
 * Disable autostart for macOS.
 */
export async function disableMacOSAutostart(): Promise<void> {
  try {
    if (supportsSMAppService()) {
      // Try SMAppService API on macOS 13+
      if (isSMAppServiceAvailable()) {
        const success = unregisterMainAppLoginItem();
        if (success) {
          logger.info("autostart", "SMAppService login item unregistered");
          // Also clean up any old LaunchAgent if it exists
          await disableLaunchAgent();
          return;
        }
      }
    }

    // Use LaunchAgent fallback
    await disableLaunchAgent();
  } catch (error) {
    logger.error("autostart", "Failed to disable macOS autostart:", error);
    throw error;
  }
}

/**
 * Open System Settings to the Login Items section.
 * Useful when SMAppService requires user approval.
 */
export function openMacOSLoginItemsSettings(): boolean {
  if (supportsSMAppService() && isSMAppServiceAvailable()) {
    return openLoginItemsSettings();
  }
  return false;
}

/**
 * Get detailed status for macOS autostart.
 * Returns more granular info than just enabled/disabled.
 */
export async function getMacOSAutostartStatus(): Promise<{
  enabled: boolean;
  method: "smappservice" | "launchagent" | "none";
  requiresApproval: boolean;
}> {
  if (supportsSMAppService() && isSMAppServiceAvailable()) {
    const status = getMainAppLoginItemStatus();
    return {
      enabled: status === "enabled",
      method: "smappservice",
      requiresApproval: status === "requiresApproval",
    };
  }

  const launchAgentExists = await checkLaunchAgentExists();
  return {
    enabled: launchAgentExists,
    method: launchAgentExists ? "launchagent" : "none",
    requiresApproval: false,
  };
}

// --- LaunchAgent fallback (macOS < 13) ---

async function checkLaunchAgentExists(): Promise<boolean> {
  const bundleId = await getChannelBundleId();
  const plistPath = join(
    Utils.paths.home,
    "Library",
    "LaunchAgents",
    `${bundleId}.plist`,
  );
  return existsSync(plistPath);
}

async function enableLaunchAgent(): Promise<void> {
  const launchAgentsDir = join(Utils.paths.home, "Library", "LaunchAgents");
  const bundleId = await getChannelBundleId();
  const plistPath = join(launchAgentsDir, `${bundleId}.plist`);

  // Ensure LaunchAgents directory exists
  mkdirSync(launchAgentsDir, { recursive: true });

  // Get the launcher executable path (not the bun executable)
  const execPath = getLauncherPath();

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${bundleId}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>`;

  writeFileSync(plistPath, plistContent);

  // Note: We intentionally do NOT call `launchctl load` here.
  // Loading the agent would immediately launch a second instance of the app.
  // The agent will be automatically loaded by the system on next login.
  logger.debug(
    "autostart",
    `LaunchAgent created at ${plistPath}, will activate on next login`,
  );
}

async function disableLaunchAgent(): Promise<void> {
  const bundleId = await getChannelBundleId();
  const plistPath = join(
    Utils.paths.home,
    "Library",
    "LaunchAgents",
    `${bundleId}.plist`,
  );

  // Unload the launch agent if it exists
  if (existsSync(plistPath)) {
    try {
      await $`launchctl unload ${plistPath}`.quiet().nothrow();
    } catch {
      // Ignore errors during unload
    }
    unlinkSync(plistPath);
  }
}
