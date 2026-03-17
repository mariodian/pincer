import { Agent } from "../agentService";
import { readAgents, checkAllAgentsStatus } from "../agentService";

export async function getAgentsWithStatus(): Promise<(Agent & {
  status: string;
  lastChecked: number;
  errorMessage?: string;
})[]> {
  const agents = await readAgents();
  const statuses = await checkAllAgentsStatus();
  const statusMap = new Map(statuses.map((s) => [s.id, s]));
  return agents.map((agent) => ({
    ...agent,
    status: statusMap.get(agent.id)?.status || "offline",
    lastChecked: statusMap.get(agent.id)?.lastChecked || 0,
    errorMessage: statusMap.get(agent.id)?.errorMessage,
  }));
}