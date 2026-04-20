import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { logger } from "../src/shared/logger";
import { config } from "./config";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database | null = null;

function getRuntimeBaseDir(): string {
  // In compiled Bun binaries, source modules are loaded from /$bunfs.
  // Use the executable directory to locate sibling resources like migrations.
  if (import.meta.dirname.startsWith("/$bunfs/")) {
    return dirname(process.execPath);
  }
  return import.meta.dirname;
}

export function getDatabase() {
  if (sqliteInstance && dbInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  const dbDir = dirname(config.dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(config.dbPath, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA busy_timeout = 5000");

  const db = drizzle(sqlite);
  sqliteInstance = sqlite;
  dbInstance = db;

  return { db, sqlite };
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
