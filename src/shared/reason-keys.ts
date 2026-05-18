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
