import { daemonConfig } from "../src/shared/appConfig";
import { config } from "./config";
import { initializeDatabase } from "./db";
import { startPolling, stopPolling } from "./poll";
import { startServer, stopServer } from "./server";

console.log(`[daemon] Starting ${daemonConfig.name} v${daemonConfig.version}`);
console.log(`[daemon] Port: ${config.port}`);
console.log(`[daemon] DB: ${config.dbPath}`);
console.log(`[daemon] Polling interval: ${config.pollingIntervalMs}ms`);

await initializeDatabase();
startPolling();
startServer();

function shutdown() {
  console.log("[daemon] Shutting down...");
  stopPolling();
  stopServer();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[daemon] Ready");
