import { eq } from "drizzle-orm";
import { getDatabase } from "./db";
import { appState } from "./schema";
import { logger } from "../../services/loggerService";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const WINDOW_BOUNDS_KEY = "windowBounds";

/**
 * Get a value from app state by key.
 * Returns null if key doesn't exist or parsing fails.
 */
export function getAppState<T>(key: string): T | null {
  const { db } = getDatabase();
  const row = db.select().from(appState).where(eq(appState.key, key)).get();

  if (!row?.value) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    logger.warn("appState", `Failed to parse JSON for key: ${key}`);
    return null;
  }
}

/**
 * Set a value in app state by key.
 * Value is serialized to JSON.
 */
export function setAppState<T>(key: string, value: T): void {
  const { db } = getDatabase();
  const jsonValue = JSON.stringify(value);

  db.insert(appState)
    .values({
      key,
      value: jsonValue,
    })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value: jsonValue, updatedAt: new Date() },
    })
    .run();

  logger.debug("appState", `Set: ${key}`);
}

/**
 * Get window bounds from app state.
 * Convenience wrapper around getAppState.
 */
export function getWindowBounds(): WindowBounds | null {
  return getAppState<WindowBounds>(WINDOW_BOUNDS_KEY);
}

/**
 * Save window bounds to app state.
 * Convenience wrapper around setAppState.
 */
export function setWindowBounds(bounds: WindowBounds): void {
  setAppState(WINDOW_BOUNDS_KEY, bounds);
}

/**
 * Remove a key from app state.
 */
export function removeAppState(key: string): void {
  const { db } = getDatabase();
  db.delete(appState).where(eq(appState.key, key)).run();
  logger.debug("appState", `Removed: ${key}`);
}

/**
 * Clear all app state.
 */
export function clearAppState(): void {
  const { db } = getDatabase();
  db.delete(appState).run();
  logger.debug("appState", "Cleared all state");
}
