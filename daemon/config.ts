import { join } from "node:path";
import { homedir, platform } from "node:os";
import { appConfig } from "../src/shared/appConfig";
import { initLogger } from "../src/shared/logger";

function getAppDataDir(): string {
  const plat = platform();
  const home = homedir();

  if (plat === "darwin") {
    return join(home, "Library", "Application Support", appConfig.identifier);
  }
  if (plat === "win32") {
    return join(process.env.APPDATA || join(home, "AppData", "Roaming"), appConfig.identifier);
  }
  // Linux
  const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
  return join(xdgData, appConfig.identifier);
}

const appDataDir = getAppDataDir();

export const config = {
  port: parseInt(process.env.DAEMON_PORT || "7378", 10),
  secret: process.env.DAEMON_SECRET,
  dbPath: process.env.DB_PATH || join(appDataDir, "daemon.sqlite"),
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || "15000", 10),
  logFilePath: process.env.LOG_FILE_PATH || join(appDataDir, "logs", "daemon.log"),
};

// Initialize logger early so we can use it for config validation errors
initLogger({
  logFilePath: config.logFilePath,
  minLevel: (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") || "info",
  consoleOutput: true,
  componentPrefix: "[daemon]",
});

if (!config.secret) {
  // Use console.error since logger might not be fully initialized yet
  // eslint-disable-next-line no-console
  console.error("DAEMON_SECRET environment variable is required");
  process.exit(1);
}
