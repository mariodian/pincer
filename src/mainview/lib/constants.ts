export const MIN_UPTIME_THRESHOLDS = {
  ok: 99,
  good: 95,
  meh: 50,
};

export const MAX_RESPONSE_TIMES = {
  ok: 200,
  meh: 500,
};

export const NOT_AVAILABLE = "—";

// Time constants (milliseconds)
export const ONE_MINUTE_MS = 60 * 1000;
export const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;
export const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export const MIN_POLLING_INTERVAL_MS = 10_000;
