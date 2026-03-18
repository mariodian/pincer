// Agents Service - Handles agent CRUD and health checking
import { Utils } from "electrobun/bun";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { agentStorage } from "./storage";
import { AgentStatusInfo } from "./storage/types";

export interface Agent {
  id: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
}

export interface Config {
  pollingInterval?: number;
  windows?: Record<string, unknown>;
}

const DEFAULT_CONFIG: Config = {
  pollingInterval: 30000,
};

export interface AgentStatus extends Agent {
  status: "ok" | "offline" | "error";
  lastChecked: number;
  errorMessage?: string;
}

function getAgentsFilePath(): string {
  return join(Utils.paths.userData, "agents.json");
}

async function ensureAppDataDir(): Promise<void> {
  const appDataDir = Utils.paths.userData;
  try {
    await stat(appDataDir);
  } catch {
    await mkdir(appDataDir, { recursive: true });
  }
}

export async function readAgents(): Promise<Agent[]> {
  return agentStorage.readAgents();
}

export async function writeAgents(agents: Agent[]): Promise<void> {
  return agentStorage.writeAgents(agents);
}

export async function readConfig(): Promise<Config> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    try {
      await stat(filePath);
    } catch {
      return DEFAULT_CONFIG;
    }

    const data = await readFile(filePath, "utf8");
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      const parsedWindows =
        parsed.windows ?? (parsed.window ? { main: parsed.window } : undefined);
      return {
        pollingInterval:
          parsed.pollingInterval ?? DEFAULT_CONFIG.pollingInterval,
        windows: parsedWindows,
      };
    }

    return DEFAULT_CONFIG;
  } catch (error) {
    console.error("Error reading config:", error);
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    const existingAgents = await readAgents();

    const data = JSON.stringify(
      {
        agents: existingAgents,
        pollingInterval:
          config.pollingInterval ?? DEFAULT_CONFIG.pollingInterval,
        windows: config.windows,
      },
      null,
      2,
    );

    await writeFile(filePath, data, "utf8");
  } catch (error) {
    console.error("Error writing config:", error);
    throw error;
  }
}

export async function addAgent(agent: Omit<Agent, "id">): Promise<Agent> {
  const agents = await readAgents();
  const newAgent = {
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

    if (response.ok) {
      try {
        const data = await response.json();
        return {
          ...agent,
          status: data.status || "ok",
          lastChecked: Date.now(),
          errorMessage: undefined,
        };
      } catch {
        return {
          ...agent,
          status: "ok",
          lastChecked: Date.now(),
          errorMessage: undefined,
        };
      }
    } else {
      return {
        ...agent,
        status: "error",
        lastChecked: Date.now(),
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
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
