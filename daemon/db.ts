import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { createDatabase, getDatabaseInstances } from "../src/shared/db-core";
import { logger } from "../src/shared/logger";
import { config } from "./config";

function getRuntimeBaseDir(): string {
  // In compiled Bun binaries, source modules are loaded from /$bunfs.
  // Use the executable directory to locate sibling resources like migrations.
  if (import.meta.dirname.startsWith("/$bunfs/")) {
    return dirname(process.execPath);
  }
  return import.meta.dirname;
}

export function getDatabase() {
  const existing = getDatabaseInstances();
  if (existing) return existing;
  return createDatabase({ dbPath: config.dbPath });
}

export async function initializeDatabase(): Promise<void> {
  const { db } = getDatabase();
  const migrationDir = join(getRuntimeBaseDir(), "migrations");

  if (existsSync(migrationDir)) {
    migrate(db, { migrationsFolder: migrationDir });
    logger.info("db", "Database migrations applied");
  } else {
    logger.error("db", "Migration directory not found");
    process.exit(1);
  }
}
