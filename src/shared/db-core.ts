// Shared Database Core - SQLite utilities for both main process and daemon
// Provides singleton pattern, PRAGMA configuration, and basic connection management

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logger } from "./logger";

export interface DatabaseInstances {
  db: ReturnType<typeof drizzle>;
  sqlite: Database;
}

interface DatabaseOptions {
  dbPath: string;
}

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database | null = null;

/**
 * Core database creation with singleton pattern and PRAGMA settings.
 * Used by both main app and daemon.
 *
 * This function ensures:
 * - Parent directory is created if needed
 * - WAL mode enabled for better concurrent read performance
 * - Busy timeout set to handle concurrent write contention
 * - Singleton pattern to reuse the same connection
 */
export function createDatabase(options: DatabaseOptions): DatabaseInstances {
  if (sqliteInstance && dbInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }

  const dbDir = dirname(options.dbPath);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(options.dbPath, { create: true });

  // Enable WAL mode for better concurrent read performance
  sqlite.run("PRAGMA journal_mode = WAL");
  // Set busy timeout to handle concurrent write contention
  sqlite.run("PRAGMA busy_timeout = 5000");

  const db = drizzle(sqlite);
  sqliteInstance = sqlite;
  dbInstance = db;

  logger.debug("db", `Database initialized: ${options.dbPath}`);

  return { db, sqlite };
}

/**
 * Get existing database instances (returns null if not initialized).
 * Useful for checking initialization state before creating.
 */
export function getDatabaseInstances(): DatabaseInstances | null {
  if (sqliteInstance && dbInstance) {
    return { db: dbInstance, sqlite: sqliteInstance };
  }
  return null;
}

/**
 * Reset database instances (for testing or reinitialization scenarios).
 * Note: This does not close the database connection, just clears the singleton.
 */
export function resetDatabaseInstances(): void {
  dbInstance = null;
  sqliteInstance = null;
}

/**
 * Execute operations within a database transaction.
 * Automatically handles BEGIN IMMEDIATE, COMMIT, and ROLLBACK.
 *
 * @param sqlite - The raw SQLite database instance
 * @param fn - Function containing database operations to execute
 * @returns The result of the function
 * @throws Re-throws the original error after rolling back
 */
export function runInTransaction<T>(sqlite: Database, fn: () => T): T {
  sqlite.run("BEGIN IMMEDIATE");
  try {
    const result = fn();
    sqlite.run("COMMIT");
    return result;
  } catch (err) {
    sqlite.run("ROLLBACK");
    throw err;
  }
}
