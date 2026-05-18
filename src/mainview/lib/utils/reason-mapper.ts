import { incidentReasonKeys } from "$shared/reason-keys";

export const reasonKeyToMessage: Record<string, string> = {
  [incidentReasonKeys.connectivityRestored]:
    "Agent confirmed healthy by daemon",
  [incidentReasonKeys.daemonHandoff]: "Handed off to daemon monitoring",
  [incidentReasonKeys.daemonSwitched]: "Switched to daemon monitoring",
};

export function formatReason(raw: string | null): string | null {
  if (!raw) return null;
  return reasonKeyToMessage[raw] ?? raw;
}
