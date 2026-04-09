// Shared time range definitions for consistent UI and export formatting
import type { TimeRange } from "./types";

export const REPORT_RANGES: TimeRange[] = ["7d", "30d", "90d"];

export const RANGE_LABELS: Record<TimeRange, string> = {
  "24h": "Last 24 Hours",
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
};

export const RANGE_SHORT_LABELS: Record<TimeRange, string> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
};
