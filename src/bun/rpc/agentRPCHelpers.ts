import { shouldTriggerHealthCheck } from "../../shared/agent-helpers";
import type { Agent } from "../services/agentService";

export function shouldMarkOffline(updates: Partial<Agent>): boolean {
  return updates.enabled === false;
}

export function shouldRunHealthCheck(updates: Partial<Agent>): boolean {
  return updates.enabled === true || shouldTriggerHealthCheck(updates);
}
