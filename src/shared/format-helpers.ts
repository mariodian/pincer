// Shared formatters for main and renderer processes

/** Format uptime percentage (e.g., 99.5 → "99.50%") */
export function formatUptime(val: number | unknown): string {
  const num = typeof val === "number" ? val : Number(val);
  return `${num.toFixed(2)}%`;
}

/** Format milliseconds (e.g., 123.45 → "123ms") */
export function formatMs(val: number | unknown): string {
  const num = typeof val === "number" ? val : Number(val);
  return `${Math.round(num)}ms`;
}

/** Format number with locale (e.g., 1234 → "1,234") */
export function formatNumber(val: number | unknown): string {
  const num = typeof val === "number" ? val : Number(val);
  return num.toLocaleString();
}
