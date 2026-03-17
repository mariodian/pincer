// Agents Service - Handles reading/writing agents.json in platform-specific locations
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const APP_NAME = "crabControl";

/**
 * Get platform-specific application data directory
 */
function getAppDataDir(): string {
  const isMacOS = process.platform === "darwin";
  const isWindows = process.platform === "win32";

  if (isMacOS) {
    // ~/Library/Application Support/crabControl
    return join(
      process.env.HOME || "",
      "Library",
      "Application Support",
      APP_NAME,
    );
  } else if (isWindows) {
    // %APPDATA%\crabControl
    const appdata = process.env.APPDATA || "";
    return join(appdata, APP_NAME);
  } else {
    // Linux: ~/.config/crabControl or ~/.local/share/crabControl
    // Following XDG Base Directory Specification
    const xdgConfigHome =
      process.env.XDG_CONFIG_HOME || join(process.env.HOME || "", ".config");
    return join(xdgConfigHome, APP_NAME);
  }
}
/**
 * Get the full path to the agents.json file
 */
function getAgentsFilePath(): string {
  return join(getAppDataDir(), "agents.json");
}

/**
 * Ensure the application data directory exists
 */
async function ensureAppDataDir(): Promise<void> {
  const appDataDir = getAppDataDir();
  try {
    await stat(appDataDir);
  } catch (error) {
    // Directory doesn't exist, create it
    await mkdir(appDataDir, { recursive: true });
  }
}

/**
 * Agent definition interface
 */
export interface Agent {
  id: string;
  name: string;
  url: string;
  port: number;
  enabled?: boolean;
}

/**
 * Configuration interface
 */
export interface Config {
  pollingInterval?: number; // milliseconds
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  pollingInterval: 30000, // 30 seconds
};

/**
 * Agent status interface
 */
export interface AgentStatus extends Agent {
  status: "ok" | "offline" | "error" | "warning";
  lastChecked: number; // timestamp
  errorMessage?: string;
}

/**
 * Read agents from agents.json file
 * Returns empty array if file doesn't exist or is invalid
 */
export async function readAgents(): Promise<Agent[]> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    try {
      await stat(filePath);
    } catch (error) {
      return [];
    }

    const data = await readFile(filePath, "utf8");
    const parsed = JSON.parse(data);

    // Handle both array format and object format with agents array
    let agentsData = parsed;
    if (!Array.isArray(parsed) && parsed.agents) {
      agentsData = parsed.agents;
    }

    // Validate that we have an array
    if (!Array.isArray(agentsData)) {
      return [];
    }

    // Validate each agent has required fields
    const validAgents: Agent[] = [];
    for (const agent of agentsData) {
      if (
        agent.id &&
        agent.name &&
        agent.url &&
        typeof agent.port === "number"
      ) {
        validAgents.push(agent);
      }
    }

    return validAgents;
  } catch (error) {
    console.error("Error reading agents:", error);
    return [];
  }
}

/**
 * Read configuration from agents.json file
 */
export async function readConfig(): Promise<Config> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    try {
      await stat(filePath);
    } catch (error) {
      return DEFAULT_CONFIG;
    }

    const data = await readFile(filePath, "utf8");
    const parsed = JSON.parse(data);

    // Extract config from object format
    if (!Array.isArray(parsed)) {
      return {
        pollingInterval:
          parsed.pollingInterval ?? DEFAULT_CONFIG.pollingInterval,
      };
    }

    return DEFAULT_CONFIG;
  } catch (error) {
    console.error("Error reading config:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Write configuration to agents.json file
 */
export async function writeConfig(config: Config): Promise<void> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    // Preserve existing agents
    const existingAgents = await readAgents();

    const data = JSON.stringify(
      {
        agents: existingAgents,
        pollingInterval:
          config.pollingInterval ?? DEFAULT_CONFIG.pollingInterval,
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

/**
 * Write agents to agents.json file
 */
export async function writeAgents(
  agents: Agent[],
  pollingInterval?: number,
): Promise<void> {
  try {
    await ensureAppDataDir();
    const filePath = getAgentsFilePath();

    // Preserve existing pollingInterval if not provided
    let interval = pollingInterval;
    if (interval === undefined) {
      const existingConfig = await readConfig();
      interval = existingConfig.pollingInterval;
    }

    const data = JSON.stringify({ agents, pollingInterval: interval }, null, 2);
    await writeFile(filePath, data, "utf8");
  } catch (error) {
    console.error("Error writing agents:", error);
    throw error;
  }
}

/**
 * Add a new agent
 */
export async function addAgent(agent: Omit<Agent, "id">): Promise<Agent> {
  const agents = await readAgents();
  const newAgent = {
    ...agent,
    id: Math.random().toString(36).substr(2, 9), // Simple ID generation
  };
  agents.push(newAgent);
  await writeAgents(agents);
  return newAgent;
}

/**
 * Update an existing agent
 */
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

/**
 * Delete an agent by ID
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const agents = await readAgents();
  const initialLength = agents.length;
  const filteredAgents = agents.filter((agent) => agent.id !== id);

  if (filteredAgents.length === initialLength) {
    return false; // Agent not found
  }

  await writeAgents(filteredAgents);
  return true;
}

/**
 * Check the status of an agent by attempting to connect to its URL:port
 */
export async function checkAgentStatus(agent: Agent): Promise<AgentStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`${agent.url}:${agent.port}/a2a/health`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      // Try to parse JSON response for more detailed status
      try {
        const data = await response.json();
        return {
          ...agent,
          status: data.status || "ok",
          lastChecked: Date.now(),
          errorMessage: undefined,
        };
      } catch (parseError) {
        // If not JSON, still consider it online if we got a successful response
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
    // Network error, timeout, etc.
    return {
      ...agent,
      status: "offline",
      lastChecked: Date.now(),
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check status for all agents
 */
export async function checkAllAgentsStatus(): Promise<AgentStatus[]> {
  const agents = await readAgents();
  const statusPromises = agents.map((agent) => checkAgentStatus(agent));
  return Promise.all(statusPromises);
}
