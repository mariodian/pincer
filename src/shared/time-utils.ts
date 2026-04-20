// Shared Time Utilities - Time manipulation helpers
// Used across main process and daemon

/**
 * Truncate a unix timestamp (seconds) to the start of the hour.
 * Used for hourly statistics aggregation.
 *
 * @param timestampSecs - Unix timestamp in seconds
 * @returns Unix timestamp in seconds, truncated to the hour boundary
 */
export function truncateToHour(timestampSecs: number): number {
  return Math.floor(timestampSecs / 3600) * 3600;
}
