import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { sql } from "drizzle-orm";
import { Utils } from "electrobun/bun";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureAppDataDir } from "../../utils/fs";
import { config as configTable } from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database | null = null;

const DEFAULT_CONFIG = {
  pollingInterval: "30000",
  retentionDays: "90",
  openMainWindow: "true",
};

function getMigrationDir(): string {
  // Resolve from this file's URL so it works in both dev and packaged contexts.
  // Dev: file:///.../src/bun/storage/sqlite/db.ts       → .../drizzle/migrations  (5 up)
  // Packaged: file:///.../bun/storage/sqlite/db.ts       → .../drizzle/migrations  (3 up)
  const thisFile = fileURLToPath(import.meta.url);
  const depth = import.meta.url.includes("/src/") ? 5 : 3;
  const root = join(thisFile, ...Array(depth).fill(".."));
  return join(root, "drizzle", "migrations");
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

  // Run migrations if the drizzle migrations directory exists
  try {
    migrate(db, { migrationsFolder: migrationDir });
    console.log("Database migrations applied successfully");
  } catch (error) {
    // If migrations folder is missing or has no journal file, that's fine
    // (e.g. first run with empty folder, or migrations not yet generated)
    if (
      error instanceof Error &&
      !error.message.includes("Can't find meta/_journal.json file")
    ) {
      console.error("Migration error:", error);
      throw error;
    }
  }

  // Seed default config values if they don't exist
  for (const [key, value] of Object.entries(DEFAULT_CONFIG)) {
    db.insert(configTable)
      .values({ key, value })
      .onConflictDoNothing()
      .run();
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
    const retentionRow = db
      .select({ value: configTable.value })
      .from(configTable)
      .where(sql`${configTable.key} = 'retentionDays'`)
      .get();

    const retentionDays = parseInt(retentionRow?.value ?? "90", 10);

    // retentionDays === 0 means never prune
    if (retentionDays === 0) return;

    const cutoffTimestamp = Math.floor(Date.now() / 1000) - retentionDays * 86400;

    db.run(sql`DELETE FROM stats WHERE hour_timestamp < ${cutoffTimestamp}`);

    console.log(`Pruned stats older than ${retentionDays} days`);
  } catch (error) {
    console.warn("Failed to prune old stats:", error);
  }
}
