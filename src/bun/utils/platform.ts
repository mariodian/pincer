import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Platform } from "../../shared/types";

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function isLinux(): boolean {
  return process.platform === "linux";
}

export function isBSD(): boolean {
  return ["freebsd", "openbsd"].includes(process.platform);
}

export function getPlatform(): Platform {
  const p = process.platform;
  switch (p) {
    case "darwin":
      return "macos";
    case "win32":
      return "win";
    case "linux":
      return "linux";
    case "freebsd":
    case "openbsd":
      return "bsd";
    default:
      return "linux"; // Default to linux for unknown platforms
  }
}

/**
 * Get the macOS version.
 * Returns 0 if not on macOS.
 * Returns the major version number (e.g., 13 for Ventura, 14 for Sonoma).
 * Uses sw_vers utility for reliable version detection.
 */
export function getMacOSVersion(): number {
  if (!isMacOS()) {
    return 0;
  }

  try {
    const output = execSync("sw_vers -productVersion", { encoding: "utf8" });
    const version = output.trim();
    const match = version.match(/^(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch {
    // Fallback: try parsing os.release()
    const release = process.env["OSTYPE"] || "";
    const match = release.match(/darwin(\d+)/i);
    if (match) {
      // Darwin kernel version = macOS version + 4 (roughly)
      return parseInt(match[1], 10) - 4;
    }
  }

  return 0;
}

/**
 * Check if the system supports SMAppService API.
 * SMAppService was introduced in macOS 13 (Ventura).
 */
export function supportsSMAppService(): boolean {
  return getMacOSVersion() >= 13;
}

/**
 * Detect whether Pincer was installed via Homebrew Cask.
 * Checks the Caskroom directory on both Apple Silicon and Intel Macs.
 * Always returns false on non-macOS platforms.
 */
export function isBrewInstall(): boolean {
  if (!isMacOS()) {
    return false;
  }

  let brewPaths = [
    "/opt/homebrew/Caskroom/pincer", // Apple Silicon
    "/usr/local/Caskroom/pincer", // Intel
  ];
  return brewPaths.some((path) => existsSync(path));
}
