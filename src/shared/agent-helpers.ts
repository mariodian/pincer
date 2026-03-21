import type { Agent, AgentStatus, AgentStatusInfo } from "./types";

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
 * Sort agents by status priority (ok first, error middle, offline last),
 * then alphabetically by name.
 */
export function sortAgentsByStatus<T extends { status: string; name: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const orderDiff =
      getStatusPriority(a.status) - getStatusPriority(b.status);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });
}
