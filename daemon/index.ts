import { daemonConfig } from "../src/shared/appConfig";
import { logger } from "../src/shared/logger";
import { config } from "./config";
import { initializeDatabase } from "./db";
import { startPolling, stopPolling } from "./poll";
import { startServer, stopServer } from "./server";

logger.info("daemon", `Starting ${daemonConfig.name} v${daemonConfig.version}`);
logger.info("daemon", `Port: ${config.port}`);
logger.info("daemon", `DB: ${config.dbPath}`);
logger.info("daemon", `Polling interval: ${config.pollingIntervalMs}ms`);

await initializeDatabase();
startPolling();
startServer();

function shutdown() {
  logger.info("daemon", "Shutting down...");
  stopPolling();
  stopServer();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("daemon", "Ready");
