import { homedir, platform } from "node:os";
import { join } from "node:path";
import { appConfig, daemonConfig } from "../src/shared/appConfig";
import { initLogger, type LogLevel, getDefaultLogLevel } from "../src/shared/logger";

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

type ChannelName = "stable" | "dev" | "canary" | string;

function inferChannelFromRuntime(): ChannelName {
  const combined = [process.execPath, ...process.argv]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Prefer explicit channel directory hints to avoid accidental matches from version strings.
  if (combined.includes("/canary/")) return "canary";
  if (combined.includes("/stable/")) return "stable";

  const runningWithBun =
    process.execPath.toLowerCase().includes("bun") ||
    process.execArgv.some((arg) => arg.toLowerCase().includes("bun"));

  const entrypoint = process.argv[1]?.toLowerCase() ?? "";
  const looksLikeSourceRun =
    entrypoint.endsWith(".ts") ||
    entrypoint.endsWith(".js") ||
    entrypoint.includes("/daemon/");

  if (runningWithBun && looksLikeSourceRun) {
    return "dev";
  }

  if (process.env.NODE_ENV === "development" && runningWithBun) {
    return "dev";
  }

  return "stable";
}

function resolveDaemonChannel(): { channel: ChannelName; source: string } {
  const envValue = process.env.DAEMON_CHANNEL?.trim();
  if (envValue) {
    return { channel: envValue.toLowerCase(), source: "DAEMON_CHANNEL" };
  }

  const version = daemonConfig.version.trim();
  if (version !== "unknown" && version.includes("-")) {
    return { channel: "canary", source: "version" };
  }

  return { channel: inferChannelFromRuntime(), source: "auto" };
}

const appDataDir = getAppDataDir();
const channelResolution = resolveDaemonChannel();
const daemonChannel = channelResolution.channel;
const channelDataDir = join(appDataDir, daemonChannel);
const defaultLogFilePath =
  process.env.LOG_FILE_PATH || join(channelDataDir, "logs", "daemon.log");
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

const daemonLogLevel: LogLevel =
  (process.env.DAEMON_LOG_LEVEL?.toLowerCase() as LogLevel | undefined) ||
  (process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined) ||
  getDefaultLogLevel(daemonChannel);

// File logging: dev/canary default on, stable default off
const defaultFileLogging = daemonChannel === "dev" || daemonChannel === "canary";

export const config = {
  channel: daemonChannel,
  channelSource: channelResolution.source,
  port: parseInt(process.env.DAEMON_PORT || "7378", 10),
  secret: process.env.DAEMON_SECRET,
  dbPath: process.env.DB_PATH || join(channelDataDir, "daemon.db"),
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || "15000", 10),
  logFilePath: defaultLogFilePath,
  fileLoggingEnabled: fileLoggingOverride ?? defaultFileLogging,
  logLevel: daemonLogLevel,
};

// Initialize logger early so we can use it for config validation errors
initLogger({
  logFilePath: config.fileLoggingEnabled ? config.logFilePath : undefined,
  minLevel: config.logLevel,
  consoleOutput: true,
  componentPrefix: "[pincerd]",
});

if (!config.secret) {
  // Use console.error since logger might not be fully initialized yet
  // eslint-disable-next-line no-console
  console.error("DAEMON_SECRET environment variable is required");
  process.exit(1);
}
