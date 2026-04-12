import { normalizeDateInput } from "$shared/date-helpers";

export function formatShortDate(timestamp: number): string {
  return formatDateTime(
    timestamp,
    {
      month: "short",
      day: "numeric",
      year:
        normalizeDateInput(timestamp, "milliseconds").getFullYear() !==
        new Date().getFullYear()
          ? "numeric"
          : undefined,
    },
    true,
  );
}

const DATE_TIME_DEFAULTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

export function formatDateTime(
  timestamp: number,
  options: Intl.DateTimeFormatOptions = {},
  replace = false,
): string {
  const date = normalizeDateInput(timestamp, "milliseconds");
  const resolved = replace ? options : { ...DATE_TIME_DEFAULTS, ...options };
  return date.toLocaleString("en-US", resolved);
}

/**
 * Format a duration in milliseconds to a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "500ms" or "1.23s")
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "N/A";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
