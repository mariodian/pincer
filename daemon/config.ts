import { join } from "node:path";
import { homedir, platform } from "node:os";
import { appConfig } from "../src/shared/appConfig";

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

export const config = {
  port: parseInt(process.env.DAEMON_PORT || "7378", 10),
  secret: process.env.DAEMON_SECRET,
  dbPath: process.env.DB_PATH || join(getAppDataDir(), "daemon.sqlite"),
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || "15000", 10),
};

if (!config.secret) {
  console.error("DAEMON_SECRET environment variable is required");
  process.exit(1);
}
