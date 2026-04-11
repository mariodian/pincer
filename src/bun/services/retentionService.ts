import { logger } from "./loggerService";
import { countOldChecks, deleteOldChecks } from "../storage/sqlite/checksRepo";

// Retention configuration
const CHECK_RETENTION_DAYS = 7;
const CHECK_RETENTION_MS = CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Background cleanup interval
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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
 * Start the retention cleanup service.
 * Runs cleanup immediately (startup), then schedules background cleanup every hour.
 */
export function startRetentionService(): void {
  if (cleanupStarted) {
    logger.debug("retention", "Retention service already started");
    return;
  }

  cleanupStarted = true;

  // Run startup cleanup immediately
  logger.info("retention", "Running startup cleanup...");
  const startupDeleted = runRetentionCleanup();
  logger.info(
    "retention",
    `Startup cleanup complete: ${startupDeleted} checks deleted`,
  );

  // Schedule background cleanup
  startBackgroundCleanup();

  logger.info(
    "retention",
    `Retention service started (interval: ${CLEANUP_INTERVAL_MS}ms)`,
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
 */
function startBackgroundCleanup(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
  }

  cleanupIntervalId = setInterval(() => {
    logger.debug("retention", "Running scheduled background cleanup...");
    try {
      const deletedCount = runRetentionCleanup();
      if (deletedCount > 0) {
        logger.info(
          "retention",
          `Background cleanup: ${deletedCount} checks deleted`,
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
