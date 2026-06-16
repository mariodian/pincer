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

function getMigrationDir(): string {
  // 1. Explicit override
  if (process.env.PINCERD_MIGRATIONS_DIR) {
    return process.env.PINCERD_MIGRATIONS_DIR;
  }

  const base = getRuntimeBaseDir();
  const primary = join(base, "drizzle/migrations");
  if (existsSync(primary)) {
    return primary;
  }

  // 2. Homebrew pkgetc location: /opt/homebrew/etc/pincerd/migrations
  //    Formula installs with `pkgetc.install "drizzle/migrations"`
  const homebrewPrefix = process.env.HOMEBREW_PREFIX || "/opt/homebrew";
  const pkgetc = join(homebrewPrefix, "etc/pincerd/migrations");
  if (existsSync(pkgetc)) {
    return pkgetc;
  }

  // 3. Return primary path so the caller gets a clear error
  return primary;
}

export async function initializeDatabase(): Promise<void> {
  const { db } = getDatabase();
  const migrationDir = getMigrationDir();

  if (existsSync(migrationDir)) {
    migrate(db, { migrationsFolder: migrationDir });
    logger.info("db", "Database migrations applied");
  } else {
    logger.error("db", "Migration directory not found");
    process.exit(1);
  }
}
