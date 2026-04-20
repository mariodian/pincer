import { homedir, platform } from "node:os";
import { join } from "node:path";
import { appConfig } from "../src/shared/appConfig";
import { initLogger } from "../src/shared/logger";

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

function getAppDataDir(): string {
  const plat = platform();
  const home = homedir();

  if (plat === "darwin") {
    return join(home, "Library", "Application Support", appConfig.identifier);
  }
  if (plat === "win32") {
    return join(
      process.env.APPDATA || join(home, "AppData", "Roaming"),
      appConfig.identifier,
    );
  }
  // Linux
  const xdgData = process.env.XDG_DATA_HOME || join(home, ".local", "share");
  return join(xdgData, appConfig.identifier);
}

const appDataDir = getAppDataDir();
const daemonDataDir = join(appDataDir, "daemon");
const defaultLogFilePath =
  process.env.LOG_FILE_PATH || join(daemonDataDir, "daemon.log");
const isDevelopment = process.env.NODE_ENV !== "production";
const fileLoggingOverride = parseBooleanEnv(process.env.DAEMON_FILE_LOGGING);

if (
  process.env.DAEMON_FILE_LOGGING !== undefined &&
  fileLoggingOverride === undefined
) {
  // eslint-disable-next-line no-console
  console.warn(
    "Invalid DAEMON_FILE_LOGGING value. Use one of: true/false, 1/0, yes/no, on/off.",
  );
}

const daemonLogLevel =
  (process.env.DAEMON_LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
  (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
  "info";

export const config = {
  port: parseInt(process.env.DAEMON_PORT || "7378", 10),
  secret: process.env.DAEMON_SECRET,
  dbPath: process.env.DB_PATH || join(daemonDataDir, "daemon.sqlite"),
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || "15000", 10),
  logFilePath: defaultLogFilePath,
  fileLoggingEnabled: fileLoggingOverride ?? isDevelopment,
  logLevel: daemonLogLevel,
};

// Initialize logger early so we can use it for config validation errors
initLogger({
  logFilePath: config.fileLoggingEnabled ? config.logFilePath : undefined,
  minLevel: config.logLevel,
  consoleOutput: true,
  componentPrefix: "[daemon]",
});

if (!config.secret) {
  // Use console.error since logger might not be fully initialized yet
  // eslint-disable-next-line no-console
  console.error("DAEMON_SECRET environment variable is required");
  process.exit(1);
}
