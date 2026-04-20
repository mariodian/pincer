import { daemonConfig } from "../src/shared/appConfig";
import { logger } from "../src/shared/logger";
import { config } from "./config";
import { initializeDatabase } from "./db";
import { reconstructState } from "./incidents";
import { startPolling, stopPolling } from "./poll";
import { startServer, stopServer } from "./server";

function isPortInUseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown };
  return err.code === "EADDRINUSE";
}

function startDaemon(): void {
  startPolling();

  try {
    startServer();
  } catch (error) {
    stopPolling();

    if (isPortInUseError(error)) {
      logger.error(
        "daemon",
        `Port ${config.port} is already in use. Stop the running daemon or set DAEMON_PORT to a different value.`,
      );
      process.exit(1);
    }

    throw error;
  }
}

logger.info("daemon", `Starting ${daemonConfig.name} v${daemonConfig.version}`);
logger.info("daemon", `Port: ${config.port}`);
logger.info("daemon", `DB: ${config.dbPath}`);
logger.info("daemon", `Polling interval: ${config.pollingIntervalMs}ms`);
logger.info("daemon", `Log level: ${config.logLevel}`);
logger.info(
  "daemon",
  config.fileLoggingEnabled
    ? `File logging: enabled (${config.logFilePath})`
    : "File logging: disabled",
);

await initializeDatabase();

// Reconstruct incident state from database before starting polling
reconstructState();

startDaemon();

function shutdown() {
  logger.info("daemon", "Shutting down...");
  stopPolling();
  stopServer();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("daemon", "Ready");
