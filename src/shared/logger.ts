// Shared Logger - Works in both main process and daemon
// Supports file logging with rotation and log level filtering

import {
  appendFileSync,
  existsSync,
  renameSync,
  statSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

type LogLevel = "debug" | "info" | "warn" | "error";

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

const DEFAULT_MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface LoggerConfig {
  logFilePath?: string; // If not provided, no file logging
  minLevel?: LogLevel;
  consoleOutput?: boolean; // Whether to also output to console
  maxLogSizeBytes?: number;
  componentPrefix?: string; // e.g., "[daemon]"
}

let config: LoggerConfig = {
  minLevel: "info",
  consoleOutput: true,
  maxLogSizeBytes: DEFAULT_MAX_LOG_SIZE_BYTES,
};

function getLogDir(logFilePath: string): string {
  return dirname(logFilePath);
}

function ensureLogDir(logFilePath: string): void {
  const dir = getLogDir(logFilePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function rotateLogFile(logFilePath: string, maxSize: number): void {
  try {
    const stat = statSync(logFilePath);
    if (stat.size >= maxSize) {
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

function writeToFile(logFilePath: string, line: string, maxSize: number): void {
  rotateLogFile(logFilePath, maxSize);
  appendFileSync(logFilePath, line + "\n");
}

function formatLine(
  level: LogLevel,
  component: string,
  message: string,
  prefix: string | undefined,
  data: unknown[],
): string {
  const timestamp = new Date().toISOString();
  const label = LEVEL_LABELS[level];
  const prefixStr = prefix ? ` ${prefix}` : "";
  const extra =
    data.length > 0
      ? " " +
        data
          .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
          .join(" ")
      : "";
  return `[${timestamp}] [${label}]${prefixStr} [${component}] ${message}${extra}`;
}

function log(
  level: LogLevel,
  component: string,
  message: string,
  ...data: unknown[]
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[config.minLevel ?? "info"]) return;

  const line = formatLine(
    level,
    component,
    message,
    config.componentPrefix,
    data,
  );

  if (config.consoleOutput) {
    const method =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    method(line);
  }

  if (config.logFilePath) {
    writeToFile(
      config.logFilePath,
      line,
      config.maxLogSizeBytes ?? DEFAULT_MAX_LOG_SIZE_BYTES,
    );
  }
}

/**
 * Initialize the shared logger with configuration options.
 * Call this once at application startup.
 */
export function initLogger(userConfig: LoggerConfig): void {
  // Check for LOG_LEVEL env var override
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  const effectiveLevel =
    envLevel && envLevel in LOG_LEVELS
      ? envLevel
      : (userConfig.minLevel ?? "info");

  config = {
    ...userConfig,
    minLevel: effectiveLevel,
  };

  // Ensure log directory exists if file logging is enabled
  if (config.logFilePath) {
    ensureLogDir(config.logFilePath);
  }

  log(
    "info",
    "logger",
    `Initialized (level=${config.minLevel}, file=${config.logFilePath ?? "off"})`,
  );
}

/**
 * Get the current log file path, or null if file logging is not enabled.
 */
export function getLogFilePath(): string | null {
  return config.logFilePath ?? null;
}

/**
 * Shared logger interface compatible with the main process logger.
 * Use this for all logging throughout the application.
 */
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
