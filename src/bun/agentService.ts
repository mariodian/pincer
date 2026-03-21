// Agents Service - Handles agent CRUD and health checking
import { agentStorage } from "./storage";
import type { Agent, AgentStatus, AgentStatusInfo } from "../shared/types";
import {
  readConfig as readConfigFromDb,
  writeConfig as writeConfigToDb,
  type Config,
} from "./storage/sqlite/configRepo";
import { upsertHourlyStat } from "./storage/sqlite/statsRepo";
import { initializeDatabase } from "./storage/sqlite/db";
import { getAgentType } from "./agentTypes";

export type { Config } from "./storage/sqlite/configRepo";
export type { Agent, AgentStatus, AgentStatusInfo } from "../shared/types";

export async function readAgents(): Promise<Agent[]> {
  return agentStorage.readAgents();
}

export async function writeAgents(agents: Agent[]): Promise<void> {
  return agentStorage.writeAgents(agents);
}

export async function readConfig(): Promise<Config> {
  return readConfigFromDb();
}

export async function writeConfig(config: Partial<Config>): Promise<void> {
  writeConfigToDb(config);
}

export async function addAgent(agent: Omit<Agent, "id">): Promise<Agent> {
  return agentStorage.insertAgent(agent);
}

export async function updateAgent(
  id: number,
  updates: Partial<Agent>,
): Promise<Agent | null> {
  const agents = await readAgents();
  const index = agents.findIndex((agent) => agent.id === id);

  if (index === -1) {
    return null;
  }

  agents[index] = { ...agents[index], ...updates };
  await writeAgents(agents);
  return agents[index];
}

export async function deleteAgent(id: number): Promise<boolean> {
  const agents = await readAgents();
  const initialLength = agents.length;
  const filteredAgents = agents.filter((agent) => agent.id !== id);

  if (filteredAgents.length === initialLength) {
    return false;
  }

  await writeAgents(filteredAgents);
  return true;
}

export async function checkAgentStatus(agent: Agent): Promise<AgentStatus> {
  const startTime = Date.now();
  const agentType = getAgentType(agent.type);

  if (!agentType) {
    upsertHourlyStat(agent.id, "error", 0);
    return {
      ...agent,
      status: "error",
      lastChecked: Date.now(),
      errorMessage: `Unknown agent type: ${agent.type}`,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      agentType.timeout ?? 5000,
    );

    let baseUrl = agent.url.replace(/\/+$/, "");
    if (!baseUrl.match(/^https?:\/\//)) {
      baseUrl = `http://${baseUrl}`;
    }

    const response = await fetch(
      `${baseUrl}:${agent.port}${agentType.healthEndpoint}`,
      {
        method: agentType.healthMethod,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...agentType.headers,
        },
      },
    );

    clearTimeout(timeoutId);
    const responseMs = Date.now() - startTime;

    if (response.ok) {
      try {
        const data = await response.json();
        const result = agentType.parseStatus(data);
        const status = result.status;
        upsertHourlyStat(agent.id, status, responseMs);
        return {
          ...agent,
          status,
          lastChecked: Date.now(),
          errorMessage: result.errorMessage,
        };
      } catch {
        // Response not valid JSON — fall back to type's parseStatus with null
        const result = agentType.parseStatus(null);
        upsertHourlyStat(agent.id, result.status, responseMs);
        return {
          ...agent,
          status: result.status,
          lastChecked: Date.now(),
          errorMessage: result.errorMessage,
        };
      }
    } else {
      upsertHourlyStat(agent.id, "error", responseMs);
      return {
        ...agent,
        status: "error",
        lastChecked: Date.now(),
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    const responseMs = Date.now() - startTime;
    upsertHourlyStat(agent.id, "offline", responseMs);
    return {
      ...agent,
      status: "offline",
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkAllAgentsStatus(): Promise<AgentStatusInfo[]> {
  const agents = await readAgents();
  const statusPromises = agents.map((agent) => checkAgentStatus(agent));
  const results = await Promise.all(statusPromises);
  return results.map(({ id, status, lastChecked, errorMessage }) => ({
    id,
    status,
    lastChecked,
    errorMessage,
  }));
}

export { getAgentTypeList, getAgentType } from "./agentTypes";

/**
 * Initialize the database and run migrations.
 * Call this once at app startup before any other DB operations.
 */
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}
