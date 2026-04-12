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
