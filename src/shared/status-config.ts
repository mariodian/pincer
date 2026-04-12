// Shared status configuration for checks and incidents
// Centralizes icons, colors, and labels to avoid duplication across components

import type { CheckStatus, EventType } from "./types";

export type StatusTone = "success" | "neutral" | "warning" | "danger";

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
 * Semantic tone mapping for each check status
 */
export const statusTones: Record<CheckStatus, StatusTone> = {
  ok: "success",
  offline: "neutral",
  error: "warning",
  degraded: "danger",
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
  tone: "danger" | "warning" | "success";
}

export const eventBadgeConfig: Record<EventType, EventBadgeConfig> = {
  opened: {
    label: "Opened",
    tone: "danger",
  },
  status_changed: {
    label: "Changed",
    tone: "warning",
  },
  recovered: {
    label: "Recovered",
    tone: "success",
  },
};
