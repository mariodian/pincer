/**
 * Cross-platform autostart service
 *
 * Delegates to platform-specific implementations:
 * - macOS: Uses SMAppService API (13+) with LaunchAgent fallback (<13)
 * - Windows: Registry-based autostart
 * - Linux: .desktop entry in autostart directory
 */
import { join } from "node:path";
import { mkdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { $ } from "bun";
import { Updater, Utils } from "electrobun/bun";
import { isMacOS, isWindows } from "../utils/platform";
import {
  enableMacOSAutostart,
  disableMacOSAutostart,
  isMacOSAutostartEnabled,
} from "./macOSAutostartService";
import { logger } from "./loggerService";

const APP_NAME = "Pincer";

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
 * Get the channel-specific app name.
 */
async function getChannelAppName(): Promise<string> {
  const channel = await getChannel();
  return channel === "stable" ? APP_NAME : `${APP_NAME}-${channel}`;
}

/**
 * Check if the app is currently set to launch at login.
 * Returns the current autostart state.
 */
export async function isAutostartEnabled(): Promise<boolean> {
  try {
    if (isMacOS()) {
      return isMacOSAutostartEnabled();
    } else if (isWindows()) {
      // Check Windows registry
      const appName = await getChannelAppName();
      const result =
        await $`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${appName}`
          .quiet()
          .nothrow();
      return result.exitCode === 0;
    } else {
      // Linux - check for desktop entry
      const channel = await getChannel();
      const desktopFileName =
        channel === "stable" ? "pincer.desktop" : `pincer-${channel}.desktop`;
      const autostartDir = join(Utils.paths.config, "autostart");
      const desktopFile = join(autostartDir, desktopFileName);
      return existsSync(desktopFile);
    }
  } catch (error) {
    logger.error("autostart", "Failed to check autostart state:", error);
    return false;
  }
}

/**
 * Enable autostart for the application.
 */
export async function enableAutostart(): Promise<void> {
  try {
    if (isMacOS()) {
      await enableMacOSAutostart();
    } else if (isWindows()) {
      await enableWindowsAutostart();
    } else {
      await enableLinuxAutostart();
    }
    logger.info("autostart", "Autostart enabled");
  } catch (error) {
    logger.error("autostart", "Failed to enable autostart:", error);
    throw error;
  }
}

/**
 * Disable autostart for the application.
 */
export async function disableAutostart(): Promise<void> {
  try {
    if (isMacOS()) {
      await disableMacOSAutostart();
    } else if (isWindows()) {
      await disableWindowsAutostart();
    } else {
      await disableLinuxAutostart();
    }
    logger.info("autostart", "Autostart disabled");
  } catch (error) {
    logger.error("autostart", "Failed to disable autostart:", error);
    throw error;
  }
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
 * Windows autostart implementation using registry.
 */
async function enableWindowsAutostart(): Promise<void> {
  const execPath = getLauncherPath();
  const appName = await getChannelAppName();
  await $`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${appName} /t REG_SZ /d "${execPath}" /f`.quiet();
}

async function disableWindowsAutostart(): Promise<void> {
  const appName = await getChannelAppName();
  await $`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ${appName} /f`
    .quiet()
    .nothrow();
}

/**
 * Linux autostart implementation using .desktop entry.
 */
async function enableLinuxAutostart(): Promise<void> {
  const autostartDir = join(Utils.paths.config, "autostart");
  const channel = await getChannel();
  const appName = await getChannelAppName();
  const desktopFileName =
    channel === "stable" ? "pincer.desktop" : `pincer-${channel}.desktop`;
  const desktopFile = join(autostartDir, desktopFileName);

  // Ensure autostart directory exists
  mkdirSync(autostartDir, { recursive: true });

  const execPath = getLauncherPath();

  const desktopContent = `[Desktop Entry]
Type=Application
Name=${appName}
Exec=${execPath}
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
Comment=Launch ${appName} at login
`;

  writeFileSync(desktopFile, desktopContent);
}

async function disableLinuxAutostart(): Promise<void> {
  const channel = await getChannel();
  const desktopFileName =
    channel === "stable" ? "pincer.desktop" : `pincer-${channel}.desktop`;
  const desktopFile = join(Utils.paths.config, "autostart", desktopFileName);

  if (existsSync(desktopFile)) {
    unlinkSync(desktopFile);
  }
}

/**
 * Apply the autostart setting based on the current preference.
 * Call this on app startup to ensure the system state matches the setting.
 */
export async function applyAutostartSetting(enabled: boolean): Promise<void> {
  try {
    if (enabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
  } catch (error) {
    logger.error("autostart", "Failed to apply autostart setting:", error);
    // Don't throw - app should continue even if autostart fails
  }
}
