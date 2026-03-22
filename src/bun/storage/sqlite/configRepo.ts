import { sql } from "drizzle-orm";
import { config as configTable } from "./schema";
import { getDatabase } from "./db";

export interface Config {
  pollingInterval: number;
  retentionDays: number;
  openMainWindow: boolean;
}

const DEFAULT_CONFIG: Config = {
  pollingInterval: 30000,
  retentionDays: 90,
  openMainWindow: true,
};

/**
 * Read a single config value by key.
 */
export function getConfigValue(key: string): string | undefined {
  const { db } = getDatabase();

  const row = db
    .select({ value: configTable.value })
    .from(configTable)
    .where(sql`${configTable.key} = ${key}`)
    .get();

  return row?.value;
}

/**
 * Set a single config value.
 */
export function setConfigValue(key: string, value: string): void {
  const { db } = getDatabase();

  db.insert(configTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: configTable.key,
      set: { value },
    })
    .run();
}

/**
 * Read the full app config.
 */
export function readConfig(): Config {
  return {
    pollingInterval:
      parseInt(getConfigValue("pollingInterval") ?? "", 10) ||
      DEFAULT_CONFIG.pollingInterval,
    retentionDays:
      parseInt(getConfigValue("retentionDays") ?? "", 10) ||
      DEFAULT_CONFIG.retentionDays,
    openMainWindow: getConfigValue("openMainWindow") === "1",
  };
}

/**
 * Write config values (merges with existing).
 */
export function writeConfig(config: Partial<Config>): void {
  if (config.pollingInterval !== undefined) {
    setConfigValue("pollingInterval", String(config.pollingInterval));
  }

  if (config.retentionDays !== undefined) {
    setConfigValue("retentionDays", String(config.retentionDays));
  }

  if (config.openMainWindow !== undefined) {
    setConfigValue("openMainWindow", String(config.openMainWindow));
  }
}

/**
 * Get the polling interval in milliseconds.
 */
export function getPollingInterval(): number {
  return readConfig().pollingInterval;
}

/**
 * Get whether the main window should open at startup.
 */
export function getOpenMainWindow(): boolean {
  return readConfig().openMainWindow;
}

/**
 * Set whether the main window should open at startup.
 */
export function setOpenMainWindow(value: boolean): void {
  setConfigValue("openMainWindow", String(value));
}
