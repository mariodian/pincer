export type TimestampUnit = "seconds" | "milliseconds";

export function normalizeDateInput(
  value: Date | string | number,
  numberUnit: TimestampUnit = "seconds",
): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(numberUnit === "seconds" ? value * 1000 : value);
  }

  return new Date(value);
}

export function formatDate(d: Date | string | number): string {
  const date = normalizeDateInput(d, "seconds");
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
