// Shared status configuration for checks and incidents
// Centralizes icons, colors, and labels to avoid duplication across components

import type { CheckStatus, EventType } from "./types";

/**
 * Icon names for each check status
 */
export const statusIcons: Record<CheckStatus, string> = {
  ok: "checkCircle",
  offline: "wifiOff",
  error: "alertCircle",
  degraded: "alertTriangle",
};

/**
 * Tailwind color classes for each check status
 * Used for icon/text coloring
 */
export const statusColors: Record<CheckStatus, string> = {
  ok: "text-green-600 dark:text-green-800",
  offline: "text-muted-foreground",
  error: "text-amber-500",
  degraded: "text-red-500 dark:text-red-700",
};

/**
 * Background color classes for CheckDot component
 */
export const checkDotColors: Record<CheckStatus, string> = {
  ok: "bg-green-600 hover:bg-green-400 dark:bg-green-800 dark:hover:bg-green-600",
  offline: "bg-muted hover:bg-muted-foreground/35",
  error: "bg-amber-500 hover:bg-amber-300",
  degraded: "bg-red-500 hover:bg-red-300 dark:bg-red-700 dark:hover:bg-red-500",
};

/**
 * Human-readable labels for each check status
 */
export const statusLabels: Record<CheckStatus, string> = {
  ok: "OK",
  offline: "Offline",
  error: "Error",
  degraded: "Degraded",
};

/**
 * Badge configuration for incident event types
 */
export interface EventBadgeConfig {
  label: string;
  classes: string;
}

export const eventBadgeConfig: Record<EventType, EventBadgeConfig> = {
  opened: {
    label: "Opened",
    classes: "bg-red-500/20 dark:bg-red-700/20 text-red-500 dark:text-red-700",
  },
  status_changed: {
    label: "Changed",
    classes: "bg-amber-500/20 text-amber-500",
  },
  recovered: {
    label: "Recovered",
    classes: "bg-green-600/20 text-green-600",
  },
};
