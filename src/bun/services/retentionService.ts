import { logger } from "./loggerService";
import { countOldChecks, deleteOldChecks } from "../storage/sqlite/checksRepo";
import {
  countOldEvents,
  deleteOldEvents,
} from "../storage/sqlite/incidentEventsRepo";
import { SEVEN_DAYS_MS, ONE_HOUR_MS } from "../utils/constants";

// Retention configuration for raw checks (7 days - hardcoded minimum)
const CHECK_RETENTION_DAYS = 7;
const CHECK_RETENTION_MS = SEVEN_DAYS_MS;

// Background cleanup interval (1 hour)
const CLEANUP_INTERVAL_MS = ONE_HOUR_MS;

let cleanupIntervalId: NodeJS.Timeout | null = null;
let cleanupStarted = false;

/**
 * Run retention cleanup - delete checks older than the retention window.
 * Returns the number of deleted rows.
 */
export function runRetentionCleanup(): number {
  const cutoffMs = Date.now() - CHECK_RETENTION_MS;
  const countBefore = countOldChecks(cutoffMs);

  if (countBefore === 0) {
    logger.debug("retention", "No old checks to clean up");
    return 0;
  }

  const deletedCount = deleteOldChecks(cutoffMs);

  logger.info(
    "retention",
    `Cleaned up ${deletedCount} checks older than ${CHECK_RETENTION_DAYS} days`,
  );

  return deletedCount;
}

/**
 * Run incident events retention cleanup - delete events older than the retention window.
 * Returns the number of deleted rows.
 * @param retentionDays Number of days to retain incident events (uses settings.retentionDays)
 */
export function runIncidentRetentionCleanup(retentionDays: number): number {
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const cutoffMs = Date.now() - retentionMs;
  const countBefore = countOldEvents(cutoffMs);
  if (countBefore === 0) {
    logger.debug("retention", "No old incident events to clean up");
    return 0;
  }
  const deletedCount = deleteOldEvents(cutoffMs);
  logger.info(
    "retention",
    `Cleaned up ${deletedCount} incident events older than ${retentionDays} days`,
  );
  return deletedCount;
}

/**
 * Start the retention cleanup service.
 * Runs cleanup immediately (startup), then schedules background cleanup every hour.
 * Uses settings.retentionDays for incident events retention.
 */
export async function startRetentionService(): Promise<void> {
  if (cleanupStarted) {
    logger.debug("retention", "Retention service already started");
    return;
  }

  cleanupStarted = true;

  // Get retention days from settings
  const { getSettings } = await import("../storage/sqlite/settingsRepo");
  const { retentionDays } = getSettings();

  // Run startup cleanup immediately
  logger.info("retention", "Running startup cleanup...");
  const startupDeleted = runRetentionCleanup();
  logger.info(
    "retention",
    `Startup cleanup complete: ${startupDeleted} checks deleted`,
  );

  // Run startup cleanup for incident events using settings value
  const incidentDeleted = runIncidentRetentionCleanup(retentionDays);
  logger.info(
    "retention",
    `Startup incident retention cleanup: ${incidentDeleted} events deleted (${retentionDays} days)`,
  );

  // Schedule background cleanup with retention days
  startBackgroundCleanup(retentionDays);

  logger.info(
    "retention",
    `Retention service started (interval: ${CLEANUP_INTERVAL_MS}ms, incident retention: ${retentionDays} days)`,
  );
}

/**
 * Stop the background cleanup job.
 */
export function stopRetentionService(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  cleanupStarted = false;
  logger.info("retention", "Retention service stopped");
}

/**
 * Start the background cleanup interval.
 * @param retentionDays Number of days to retain incident events
 */
function startBackgroundCleanup(retentionDays: number): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
  }

  cleanupIntervalId = setInterval(() => {
    logger.debug("retention", "Running scheduled background cleanup...");
    try {
      const deletedChecks = runRetentionCleanup();
      const deletedIncidents = runIncidentRetentionCleanup(retentionDays);
      if (deletedChecks > 0 || deletedIncidents > 0) {
        logger.info(
          "retention",
          `Background cleanup: ${deletedChecks} checks, ${deletedIncidents} incidents deleted`,
        );
      }
    } catch (error) {
      logger.error("retention", "Background cleanup failed:", error);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Get the retention configuration.
 */
export function getRetentionConfig(): {
  retentionDays: number;
  retentionMs: number;
  intervalMs: number;
} {
  return {
    retentionDays: CHECK_RETENTION_DAYS,
    retentionMs: CHECK_RETENTION_MS,
    intervalMs: CLEANUP_INTERVAL_MS,
  };
}

/**
 * Manually trigger a cleanup (for testing/debugging).
 */
export function triggerManualCleanup(): number {
  logger.info("retention", "Manual cleanup triggered");
  return runRetentionCleanup();
}
