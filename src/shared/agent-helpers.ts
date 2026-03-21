import type { Agent, AgentStatus, AgentStatusInfo } from "./types";

/**
 * Normalize a URL by stripping trailing slashes and ensuring http:// prefix.
 * Handles both bare hostnames (example.com) and full URLs (http://example.com/).
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, "");
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/** Fields whose change should trigger an immediate health check. */
export const HEALTH_AFFECTING_FIELDS = [
  "url",
  "port",
  "healthEndpoint",
  "statusShape",
  "type",
] as const;

/** Priority order for sorting: lower = shown first. */
export function getStatusPriority(status: string): number {
  switch (status) {
    case "ok":
      return 0;
    case "offline":
      return 2;
    default:
      return 1;
  }
}

/**
 * Merge agent definitions with their status info.
 * Agents without a matching status default to "offline".
 */
export function mergeAgentsWithStatuses(
  agents: Agent[],
  statuses: AgentStatusInfo[],
): AgentStatus[] {
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  return agents.map((agent) => ({
    ...agent,
    status: statusMap.get(agent.id)?.status ?? "offline",
    lastChecked: statusMap.get(agent.id)?.lastChecked ?? 0,
    errorMessage: statusMap.get(agent.id)?.errorMessage,
  }));
}

/**
 * Sort agents by enabled status (enabled first, disabled at bottom),
 * then by status priority (ok first, error middle, offline last),
 * then alphabetically by name.
 */
export function sortAgentsByStatus<T extends { enabled?: boolean; status: string; name: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const enabledDiff = Number(Boolean(b.enabled)) - Number(Boolean(a.enabled));
    if (enabledDiff !== 0) return enabledDiff;
    const orderDiff = getStatusPriority(a.status) - getStatusPriority(b.status);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}

/** True when update payload includes fields that affect health-check behavior. */
export function shouldTriggerHealthCheck(updates: Partial<Agent>): boolean {
  return HEALTH_AFFECTING_FIELDS.some((field) => field in updates);
}

/**
 * Build a stable signature used to detect meaningful agent-list changes.
 * Intentionally ignores `lastChecked` so periodic polls don't trigger no-op UI refreshes.
 */
export function createAgentSyncSignature(list: AgentStatus[]): string {
  const normalized = [...list]
    .sort((a, b) => a.id - b.id)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      type: agent.type,
      url: agent.url,
      port: agent.port,
      enabled: agent.enabled,
      healthEndpoint: agent.healthEndpoint ?? null,
      statusShape: agent.statusShape ?? null,
      status: agent.status,
      errorMessage: agent.errorMessage ?? null,
    }));

  return JSON.stringify(normalized);
}
