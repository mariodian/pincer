// macOS Login Items - Native SMAppService bindings via FFI
import { existsSync } from "node:fs";
import { join } from "node:path";

import { dlopen, FFIType } from "bun:ffi";

import { logger } from "../services/loggerService";

export type LoginItemStatus =
  | "notRegistered"
  | "enabled"
  | "requiresApproval"
  | "notFound";

type MacSystemLibrary = {
  symbols: {
    registerMainAppLoginItem: () => boolean;
    unregisterMainAppLoginItem: () => boolean;
    getMainAppLoginItemStatus: () => number;
    openLoginItemsSettings: () => boolean;
    isSMAppServiceAvailable: () => boolean;
  };
};

let macSystemLib: MacSystemLibrary | null = null;

function getMacSystemLibrary(): MacSystemLibrary | null {
  if (macSystemLib !== null) {
    return macSystemLib;
  }

  const dylibPath = join(import.meta.dir, "libs", "libMacOS.dylib");

  if (!existsSync(dylibPath)) {
    logger.warn(
      "native",
      `Native macOS system lib not found at ${dylibPath}. SMAppService unavailable.`,
    );
    return null;
  }

  try {
    macSystemLib = dlopen(dylibPath, {
      registerMainAppLoginItem: {
        args: [],
        returns: FFIType.bool,
      },
      unregisterMainAppLoginItem: {
        args: [],
        returns: FFIType.bool,
      },
      getMainAppLoginItemStatus: {
        args: [],
        returns: FFIType.i32,
      },
      openLoginItemsSettings: {
        args: [],
        returns: FFIType.bool,
      },
      isSMAppServiceAvailable: {
        args: [],
        returns: FFIType.bool,
      },
    }) as unknown as MacSystemLibrary;
  } catch (error) {
    logger.warn("native", "Failed to load native macOS system lib:", error);
    return null;
  }

  return macSystemLib;
}

/**
 * Check if SMAppService API is available (macOS 13+).
 */
export function isSMAppServiceAvailable(): boolean {
  const lib = getMacSystemLibrary();
  if (lib === null) {
    return false;
  }

  try {
    return lib.symbols.isSMAppServiceAvailable();
  } catch (error) {
    logger.warn("native", "Failed to check SMAppService availability:", error);
    return false;
  }
}

/**
 * Register the main app as a login item (launch at login).
 * @returns true if successful, false otherwise
 */
export function registerMainAppLoginItem(): boolean {
  const lib = getMacSystemLibrary();
  if (lib === null) {
    logger.warn("native", "Cannot register login item: native lib not loaded");
    return false;
  }

  try {
    const result = lib.symbols.registerMainAppLoginItem();
    logger.info("native", `SMAppService registerMainAppLoginItem: ${result}`);
    return result;
  } catch (error) {
    logger.error("native", "Failed to register login item:", error);
    return false;
  }
}

/**
 * Unregister the main app as a login item.
 * @returns true if successful, false otherwise
 */
export function unregisterMainAppLoginItem(): boolean {
  const lib = getMacSystemLibrary();
  if (lib === null) {
    logger.warn(
      "native",
      "Cannot unregister login item: native lib not loaded",
    );
    return false;
  }

  try {
    const result = lib.symbols.unregisterMainAppLoginItem();
    logger.info("native", `SMAppService unregisterMainAppLoginItem: ${result}`);
    return result;
  } catch (error) {
    logger.error("native", "Failed to unregister login item:", error);
    return false;
  }
}

/**
 * Get the current status of the main app login item.
 * @returns Status string representation
 */
export function getMainAppLoginItemStatus(): LoginItemStatus {
  const lib = getMacSystemLibrary();
  if (lib === null) {
    return "notFound";
  }

  try {
    const status = lib.symbols.getMainAppLoginItemStatus();
    // Status mapping: 0=NotRegistered, 1=Enabled, 2=RequiresApproval, 3=NotFound
    switch (status) {
      case 0:
        return "notRegistered";
      case 1:
        return "enabled";
      case 2:
        return "requiresApproval";
      case 3:
      default:
        return "notFound";
    }
  } catch (error) {
    logger.error("native", "Failed to get login item status:", error);
    return "notFound";
  }
}

/**
 * Open the Login Items section in System Settings.
 * @returns true if successfully opened settings
 */
export function openLoginItemsSettings(): boolean {
  const lib = getMacSystemLibrary();
  if (lib === null) {
    return false;
  }

  try {
    return lib.symbols.openLoginItemsSettings();
  } catch (error) {
    logger.error("native", "Failed to open login items settings:", error);
    return false;
  }
}

/**
 * Check if the login item is currently enabled (registered and approved).
 * @returns true if enabled and can launch at login
 */
export function isLoginItemEnabled(): boolean {
  return getMainAppLoginItemStatus() === "enabled";
}

/**
 * Check if the login item requires user approval in System Settings.
 * @returns true if registered but waiting for approval
 */
export function requiresUserApproval(): boolean {
  return getMainAppLoginItemStatus() === "requiresApproval";
}
