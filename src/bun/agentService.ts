// Agents Service - Handles agent CRUD and health checking
import { agentStorage } from "./storage";
import { AgentStatusInfo } from "./storage/types";
import {
  readConfig as readConfigFromDb,
  writeConfig as writeConfigToDb,
  type Config,
} from "./storage/sqlite/configRepo";
import { upsertHourlyStat } from "./storage/sqlite/statsRepo";
import { initializeDatabase } from "./storage/sqlite/db";

export type { Config } from "./storage/sqlite/configRepo";

export interface Agent {
  id: string;
  type: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
}

export interface AgentStatus extends Agent {
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}

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
  const agents = await readAgents();
  const newAgent: Agent = {
    ...agent,
    id: Math.random().toString(36).substr(2, 9),
  };
  agents.push(newAgent);
  await writeAgents(agents);
  return newAgent;
}

export async function updateAgent(
  id: string,
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

export async function deleteAgent(id: string): Promise<boolean> {
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${agent.url}:${agent.port}/a2a/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);
    const responseMs = Date.now() - startTime;

    if (response.ok) {
      try {
        const data = await response.json();
        const status = data.status || "ok";
        upsertHourlyStat(agent.id, status, responseMs);
        return {
          ...agent,
          status,
          lastChecked: Date.now(),
          errorMessage: undefined,
        };
      } catch {
        upsertHourlyStat(agent.id, "ok", responseMs);
        return {
          ...agent,
          status: "ok",
          lastChecked: Date.now(),
          errorMessage: undefined,
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

/**
 * Initialize the database and run migrations.
 * Call this once at app startup before any other DB operations.
 */
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}
