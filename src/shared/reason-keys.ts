/**
 * Machine-readable placeholder keys for incident event reasons.
 * Stored in the database and mapped to user-facing messages in the UI layer.
 */
export const incidentReasonKeys = {
  connectivityRestored: "connectivity_restored",
  daemonHandoff: "daemon_handoff",
  daemonSwitched: "daemon_switched",
} as const;

export type IncidentReasonKey =
  (typeof incidentReasonKeys)[keyof typeof incidentReasonKeys];

export const REASON_MESSAGES: Record<IncidentReasonKey, string> = {
  [incidentReasonKeys.connectivityRestored]:
    "Agent confirmed healthy by daemon",
  [incidentReasonKeys.daemonHandoff]: "Handed off to daemon monitoring",
  [incidentReasonKeys.daemonSwitched]: "Switched to daemon monitoring",
};

export function formatReason(raw: string | null): string | null {
  if (!raw) return null;
  return REASON_MESSAGES[raw as IncidentReasonKey] ?? raw;
}
