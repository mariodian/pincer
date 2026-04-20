import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { PATHS, Utils } from "electrobun/bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  getDatabaseInstances,
} from "../../../shared/db-core";
import { runDatabaseInitialization } from "../../services/dbInitService";
import { logger } from "../../services/loggerService";
import { ONE_DAY_MS, ONE_DAY_SEC } from "../../utils/constants";
import { ensureAppDataDir } from "../../utils/fs";

function getMigrationDir(): string {
  // In source context, walk up from this file until we find drizzle/migrations
  if (import.meta.url.includes("/src/")) {
    let dir = fileURLToPath(import.meta.url);
    while (true) {
      const parent = join(dir, "..");
      if (parent === dir) {
        throw new Error("Could not find drizzle/migrations directory");
      }
      dir = parent;
      if (
        existsSync(join(dir, "drizzle", "migrations", "meta", "_journal.json"))
      ) {
        return join(dir, "drizzle", "migrations");
      }
    }
  }

  // In bundled context, derive from VIEWS_FOLDER (VIEWS_FOLDER = RESOURCES_FOLDER + '/app/views')
  return join(PATHS.VIEWS_FOLDER, "..", "..", "app", "drizzle", "migrations");
}

function getDbPath(): string {
  return join(Utils.paths.userData, "app.db");
}

export function getDatabase() {
  const existing = getDatabaseInstances();
  if (existing) return existing;
  return createDatabase({ dbPath: getDbPath() });
}

export async function initializeDatabase(): Promise<{
  db: ReturnType<typeof drizzle>;
  sqlite: Database;
}> {
  await ensureAppDataDir();

  const { db, sqlite } = getDatabase();
  const migrationDir = getMigrationDir();

  logger.debug("db", "Migration directory:", migrationDir);

  // Run migrations if the drizzle migrations directory exists
  try {
    migrate(db, { migrationsFolder: migrationDir });
    logger.info("db", "Database migrations applied successfully");
  } catch (error) {
    // Only ignore "missing journal" — that means no migrations exist yet
    // (first run with empty folder, or migrations not yet generated)
    if (
      error instanceof Error &&
      error.message.includes("Can't find meta/_journal.json file")
    ) {
      logger.info("db", "No migration journal found, skipping migrations");
    } else {
      logger.error("db", "Migration error:", error);
      throw error;
    }
  }

  // Run application-level initialization (seeding, platform defaults, etc.)
  await runDatabaseInitialization(db);

  // Start the pruning job
  startPruningJob(db);

  return { db, sqlite };
}

function startPruningJob(db: ReturnType<typeof drizzle>): void {
  // Run pruning on startup, then every 24 hours
  pruneOldStats(db);

  setInterval(() => {
    pruneOldStats(db);
  }, ONE_DAY_MS);
}

async function pruneOldStats(db: ReturnType<typeof drizzle>): Promise<void> {
  try {
    // Import lazily to avoid circular dependency at module load time
    const { getSettings } = await import("./settingsRepo");
    const { retentionDays } = getSettings();

    // retentionDays === 0 means never prune
    if (retentionDays === 0) return;

    const cutoffTimestamp =
      Math.floor(Date.now() / 1000) - retentionDays * ONE_DAY_SEC;

    db.run(`DELETE FROM stats WHERE hour_timestamp < ${cutoffTimestamp}`);

    logger.info("db", `Pruned stats older than ${retentionDays} days`);
  } catch (error) {
    logger.warn("db", "Failed to prune old stats:", error);
  }
}
