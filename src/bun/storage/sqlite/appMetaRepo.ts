import { eq } from "drizzle-orm";

import { logger } from "../../services/loggerService";
import { getDatabase } from "./db";
import { appMeta } from "./schema";

/**
 * Get a meta value by key.
 */
export function getMeta(key: string): string | null {
  const { db } = getDatabase();
  const row = db.select().from(appMeta).where(eq(appMeta.key, key)).get();
  return row?.value ?? null;
}

/**
 * Set a meta value (insert or update).
 */
export function setMeta(key: string, value: string): void {
  const { db } = getDatabase();
  db.insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appMeta.key,
      set: { value, updatedAt: new Date() },
    })
    .run();
  logger.debug("appMeta", `Set ${key} = ${value}`);
}

/**
 * Check if a meta key exists.
 */
export function hasMeta(key: string): boolean {
  const { db } = getDatabase();
  const row = db.select().from(appMeta).where(eq(appMeta.key, key)).get();
  return !!row;
}
