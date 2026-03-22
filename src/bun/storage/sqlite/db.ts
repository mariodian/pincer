import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { PATHS, Utils } from "electrobun/bun";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../../services/loggerService";
import { ensureAppDataDir } from "../../utils/fs";
import { settingsGeneral } from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database | null = null;

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
      if (existsSync(join(dir, "drizzle", "migrations", "meta", "_journal.json"))) {
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
  if (sqliteInstance && dbInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  const dbPath = getDbPath();
  const sqlite = new Database(dbPath, { create: true });

  // Enable WAL mode for better concurrent read performance
  sqlite.exec("PRAGMA journal_mode = WAL");
  // Set busy timeout to handle concurrent write contention
  sqlite.exec("PRAGMA busy_timeout = 5000");

  const db = drizzle(sqlite);

  sqliteInstance = sqlite;
  dbInstance = db;

  return { db, sqlite };
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

  // Seed the settings_general row if it doesn't exist (first run without migration)
  try {
    db.insert(settingsGeneral)
      .values({ id: 1 })
      .onConflictDoNothing()
      .run();
  } catch (error) {
    logger.warn("db", "Failed to seed settings_general:", error);
  }

  // Start the pruning job
  startPruningJob(db);

  return { db, sqlite };
}

function startPruningJob(db: ReturnType<typeof drizzle>): void {
  // Run pruning on startup, then every 24 hours
  pruneOldStats(db);

  setInterval(() => {
    pruneOldStats(db);
  }, 24 * 60 * 60 * 1000);
}

async function pruneOldStats(db: ReturnType<typeof drizzle>): Promise<void> {
  try {
    // Import lazily to avoid circular dependency at module load time
    const { getSettings } = await import("./settingsRepo");
    const { retentionDays } = getSettings();

    // retentionDays === 0 means never prune
    if (retentionDays === 0) return;

    const cutoffTimestamp = Math.floor(Date.now() / 1000) - retentionDays * 86400;

    db.run(`DELETE FROM stats WHERE hour_timestamp < ${cutoffTimestamp}`);

    logger.info("db", `Pruned stats older than ${retentionDays} days`);
  } catch (error) {
    logger.warn("db", "Failed to prune old stats:", error);
  }
}
