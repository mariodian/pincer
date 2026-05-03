import { Duration, DurationUnits } from "@layerstack/utils";
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

function resolveTimestamp(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}

function getDurationMinUnit(diffMs: number): DurationUnits {
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return DurationUnits.Day;
  if (hours > 0) return DurationUnits.Hour;
  if (minutes > 0) return DurationUnits.Minute;
  return DurationUnits.Second;
}

export function formatElapsedDuration(
  start: number | Date | null | undefined,
  end: number | Date = Date.now(),
): string | null {
  if (start === null || start === undefined) return null;

  const startMs = resolveTimestamp(start);
  const endMs = resolveTimestamp(end);
  const diffMs = Math.max(0, endMs - startMs);

  return new Duration({
    start: new Date(startMs),
    end: new Date(endMs),
  }).format({
    minUnits: getDurationMinUnit(diffMs),
    variant: "short",
  });
}

export function formatRelativeTime(
  timestamp: number | Date | null | undefined,
  now: number | Date = Date.now(),
): string {
  if (timestamp === null || timestamp === undefined) return "Never";

  const timestampMs = resolveTimestamp(timestamp);
  const nowMs = resolveTimestamp(now);
  const diffMs = Math.max(0, nowMs - timestampMs);

  if (diffMs < 5_000) return "just now";
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;

  const elapsed = formatElapsedDuration(timestampMs, nowMs);
  return elapsed ? `${elapsed} ago` : "Never";
}
