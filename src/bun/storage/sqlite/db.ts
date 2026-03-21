import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { sql } from "drizzle-orm";
import { Utils } from "electrobun/bun";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { config as configTable } from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database | null = null;

const DEFAULT_CONFIG = {
  pollingInterval: "30000",
  retentionDays: "90",
};

async function ensureAppDataDir(): Promise<void> {
  const appDataDir = Utils.paths.userData;
  try {
    await stat(appDataDir);
  } catch {
    await mkdir(appDataDir, { recursive: true });
  }
}

async function ensureMigrationDir(): Promise<void> {
  const migrationDir = join(process.cwd(), "drizzle", "migrations");
  try {
    await stat(migrationDir);
  } catch {
    await mkdir(migrationDir, { recursive: true });
  }
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
  await ensureMigrationDir();

  const { db, sqlite } = getDatabase();

  // Run migrations if the drizzle migrations directory exists
  try {
    migrate(db, {
      migrationsFolder: join(process.cwd(), "drizzle", "migrations"),
    });
    console.log("Database migrations applied successfully");
  } catch (error) {
    // On first run, migrations folder may be empty — that's fine
    if (
      error instanceof Error &&
      !error.message.includes("No migration files found")
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
