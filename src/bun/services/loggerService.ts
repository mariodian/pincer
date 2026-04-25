// Logger Service - Channel-aware logging with file output and renderer push
import { Updater, Utils } from "electrobun/bun";
import {
  appendFileSync,
  existsSync,
  renameSync,
  statSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import { getMainWindow } from "../rpc/windowRegistry";
import { type LogLevel, getDefaultLogLevel } from "../../shared/logger";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let channel: string | null = null;
let minLevel: LogLevel = "debug";
let fileLoggingEnabled = false;
let logFilePath: string | null = null;

function getLogDir(): string {
  return join(Utils.paths.userData, "logs");
}

function ensureLogDir(): void {
  const dir = getLogDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function rotateLogFile(): void {
  if (!logFilePath) return;

  try {
    const stat = statSync(logFilePath);
    if (stat.size >= MAX_LOG_SIZE_BYTES) {
      const oldPath = logFilePath + ".old";
      if (existsSync(oldPath)) {
        // Remove the previous .old file before rotating
        unlinkSync(oldPath);
      }
      renameSync(logFilePath, oldPath);
    }
  } catch {
    // File doesn't exist yet or can't be stat'd — safe to continue
  }
}

function writeToFile(line: string): void {
  if (!fileLoggingEnabled || !logFilePath) return;

  rotateLogFile();
  appendFileSync(logFilePath, line + "\n");
}

function pushToRenderer(
  level: "warn" | "error",
  component: string,
  message: string,
): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  try {
    const rpc = mainWindow.webview.rpc as {
      send?: {
        pushLog?: (data: {
          level: string;
          component: string;
          message: string;
          timestamp: string;
        }) => void;
      };
    } | null;

    rpc?.send?.pushLog?.({
      level,
      component,
      message,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Window may be closing — fail silently
  }
}

function formatLine(
  level: LogLevel,
  component: string,
  message: string,
  data: unknown[],
): string {
  const timestamp = new Date().toISOString();
  const label = LEVEL_LABELS[level];
  const extra =
    data.length > 0
      ? " " +
        data
          .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
          .join(" ")
      : "";
  return `[${timestamp}] [${label}] [${component}] ${message}${extra}`;
}

function log(
  level: LogLevel,
  component: string,
  message: string,
  ...data: unknown[]
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

  const line = formatLine(level, component, message, data);

  if (channel === "dev") {
    const method =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    method(line);
  }

  if (fileLoggingEnabled) {
    writeToFile(line);
  }

  if (level === "warn" || level === "error") {
    pushToRenderer(level, component, message);
  }
}

export async function initLogger(): Promise<void> {
  channel = await Updater.localInfo.channel();

  // Read env var overrides
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as
    | LogLevel
    | undefined;
  const envFileLogging = process.env.LOG_TO_FILE;

  // Determine minimum log level (dev=debug, canary/stable=info)
  if (envLevel && envLevel in LOG_LEVELS) {
    minLevel = envLevel;
  } else {
    minLevel = getDefaultLogLevel(channel ?? "stable");
  }

  // Determine file logging: dev/canary default on, stable default off
  if (envFileLogging === "true") {
    fileLoggingEnabled = true;
  } else if (envFileLogging === "false") {
    fileLoggingEnabled = false;
  } else if (channel === "dev" || channel === "canary") {
    fileLoggingEnabled = true;
  }

  // Set up log file path
  if (fileLoggingEnabled) {
    ensureLogDir();
    logFilePath = join(getLogDir(), "app.log");
  }

  // Log initialization
  log(
    "info",
    "logger",
    `Initialized (channel=${channel}, level=${minLevel}, file=${fileLoggingEnabled ? logFilePath : "off"})`,
  );
}

export function getLogFilePath(): string {
  if (!logFilePath) {
    throw new Error("Logger not initialized. Call initLogger() first.");
  }
  return logFilePath;
}

export const logger = {
  debug: (component: string, message: string, ...data: unknown[]) =>
    log("debug", component, message, ...data),
  info: (component: string, message: string, ...data: unknown[]) =>
    log("info", component, message, ...data),
  warn: (component: string, message: string, ...data: unknown[]) =>
    log("warn", component, message, ...data),
  error: (component: string, message: string, ...data: unknown[]) =>
    log("error", component, message, ...data),
  getLogFilePath,
};
