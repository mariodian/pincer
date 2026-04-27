// Retention Core - Pure cleanup logic, dependency-injected for testability.
// This module does NOT import Bun/Electrobun runtime modules.

import { ONE_HOUR_MS, SEVEN_DAYS_MS } from "../utils/constants";

export interface RetentionLogger {
  debug(channel: string, message: string): void;
  info(channel: string, message: string): void;
  error(channel: string, message: string, error?: unknown): void;
}

export interface RetentionDeps {
  countOldChecks(cutoffMs: number): number;
  deleteOldChecks(cutoffMs: number): number;
  countOldEvents(cutoffMs: number): number;
  deleteOldEvents(cutoffMs: number): number;
  getRetentionDays(): number;
  logger: RetentionLogger;
  now?(): number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export interface RetentionService {
  runRetentionCleanup(): number;
  runIncidentRetentionCleanup(retentionDays: number): number;
  startRetentionService(): void;
  stopRetentionService(): void;
  triggerManualCleanup(): number;
  getRetentionConfig(): {
    retentionDays: number;
    retentionMs: number;
    intervalMs: number;
  };
}

// Retention configuration for raw checks (7 days - hardcoded minimum)
const CHECK_RETENTION_DAYS = 7;
const CHECK_RETENTION_MS = SEVEN_DAYS_MS;

// Background cleanup interval (1 hour)
const CLEANUP_INTERVAL_MS = ONE_HOUR_MS;

export function createRetentionService(deps: RetentionDeps): RetentionService {
  const now = deps.now ?? (() => Date.now());
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;

  let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
  let cleanupStarted = false;

  /**
   * Run retention cleanup - delete checks older than the retention window.
   * Returns the number of deleted rows.
   */
  function runRetentionCleanup(): number {
    const cutoffMs = now() - CHECK_RETENTION_MS;
    const countBefore = deps.countOldChecks(cutoffMs);

    if (countBefore === 0) {
      deps.logger.debug("retention", "No old checks to clean up");
      return 0;
    }

    const deletedCount = deps.deleteOldChecks(cutoffMs);

    deps.logger.info(
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
  function runIncidentRetentionCleanup(retentionDays: number): number {
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const cutoffMs = now() - retentionMs;
    const countBefore = deps.countOldEvents(cutoffMs);
    if (countBefore === 0) {
      deps.logger.debug("retention", "No old incident events to clean up");
      return 0;
    }
    const deletedCount = deps.deleteOldEvents(cutoffMs);
    deps.logger.info(
      "retention",
      `Cleaned up ${deletedCount} incident events older than ${retentionDays} days`,
    );
    return deletedCount;
  }

  /**
   * Start the background cleanup interval.
   * @param retentionDays Number of days to retain incident events
   */
  function startBackgroundCleanup(retentionDays: number): void {
    if (cleanupIntervalId !== null) {
      clearIntervalFn(cleanupIntervalId);
    }

    cleanupIntervalId = setIntervalFn(() => {
      deps.logger.debug("retention", "Running scheduled background cleanup...");
      try {
        const deletedChecks = runRetentionCleanup();
        const deletedIncidents = runIncidentRetentionCleanup(retentionDays);
        if (deletedChecks > 0 || deletedIncidents > 0) {
          deps.logger.info(
            "retention",
            `Background cleanup: ${deletedChecks} checks, ${deletedIncidents} incidents deleted`,
          );
        }
      } catch (error) {
        deps.logger.error("retention", "Background cleanup failed:", error);
      }
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Start the retention cleanup service.
   * Runs cleanup immediately (startup), then schedules background cleanup every hour.
   * Uses settings.retentionDays for incident events retention.
   */
  function startRetentionService(): void {
    if (cleanupStarted) {
      deps.logger.debug("retention", "Retention service already started");
      return;
    }

    cleanupStarted = true;

    // Get retention days from settings
    const retentionDays = deps.getRetentionDays();

    // Run startup cleanup immediately
    deps.logger.info("retention", "Running startup cleanup...");
    const startupDeleted = runRetentionCleanup();
    deps.logger.info(
      "retention",
      `Startup cleanup complete: ${startupDeleted} checks deleted`,
    );

    // Run startup cleanup for incident events using settings value
    const incidentDeleted = runIncidentRetentionCleanup(retentionDays);
    deps.logger.info(
      "retention",
      `Startup incident retention cleanup: ${incidentDeleted} events deleted (${retentionDays} days)`,
    );

    // Schedule background cleanup with retention days
    startBackgroundCleanup(retentionDays);

    deps.logger.info(
      "retention",
      `Retention service started (interval: ${CLEANUP_INTERVAL_MS}ms, incident retention: ${retentionDays} days)`,
    );
  }

  /**
   * Stop the background cleanup job.
   */
  function stopRetentionService(): void {
    if (cleanupIntervalId !== null) {
      clearIntervalFn(cleanupIntervalId);
      cleanupIntervalId = null;
    }
    cleanupStarted = false;
    deps.logger.info("retention", "Retention service stopped");
  }

  /**
   * Get the retention configuration.
   */
  function getRetentionConfig(): {
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
  function triggerManualCleanup(): number {
    deps.logger.info("retention", "Manual cleanup triggered");
    return runRetentionCleanup();
  }

  return {
    runRetentionCleanup,
    runIncidentRetentionCleanup,
    startRetentionService,
    stopRetentionService,
    triggerManualCleanup,
    getRetentionConfig,
  };
}
