// Agents Service - Handles agent CRUD and health checking
import { agentStorage } from "../storage";
import type {
  Agent,
  AgentStatus,
  AgentStatusInfo,
  CheckStatus,
} from "../../shared/types";
import { normalizeUrl } from "../../shared/agent-helpers";
import {
  getSettings as getSettingsFromDb,
  updateSettings as updateSettingsToDb,
  type Settings,
} from "../storage/sqlite/settingsRepo";
import { upsertHourlyStat } from "../storage/sqlite/statsRepo";
import { initializeDatabase } from "../storage/sqlite/db";
import { logger } from "./loggerService";
import {
  getAgentType,
  STATUS_PARSERS,
  type StatusShape,
  type StatusParser,
} from "../agentTypes";
import { recordCheck } from "./incidentService";

export type { Settings } from "../storage/sqlite/settingsRepo";
export type { Agent, AgentStatus, AgentStatusInfo } from "../../shared/types";

/**
 * Extended result from a health check including fields needed for incident tracking.
 */
export interface AgentCheckResult {
  id: number;
  status: CheckStatus;
  lastChecked: number;
  errorMessage?: string;
  responseMs: number;
  httpStatus: number | null;
  errorCode: string | null;
}

export async function readAgents(): Promise<Agent[]> {
  return agentStorage.readAgents();
}

export async function writeAgents(agents: Agent[]): Promise<void> {
  return agentStorage.writeAgents(agents);
}

export async function getSettings(): Promise<Settings> {
  return getSettingsFromDb();
}

export async function updateSettings(
  partial: Partial<Settings>,
): Promise<void> {
  updateSettingsToDb(partial);
}

export async function addAgent(agent: Omit<Agent, "id">): Promise<Agent> {
  const result = await agentStorage.insertAgent(agent);
  logger.info("agent", `Agent added: ${result.name} (id=${result.id})`);
  return result;
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
  logger.debug("agent", `Agent updated: id=${id}`);
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
  logger.info("agent", `Agent deleted: id=${id}`);
  return true;
}

export async function checkAgentStatus(agent: Agent): Promise<AgentStatus> {
  const startTime = Date.now();
  const agentType = getAgentType(agent.type);

  if (!agentType) {
    const responseMs = 0;
    const status: CheckStatus = "error";
    const errorMessage = `Unknown agent type: ${agent.type}`;

    upsertHourlyStat(agent.id, status, responseMs);
    recordCheck(agent.id, status, responseMs, null, null, errorMessage);

    return {
      ...agent,
      status,
      lastChecked: Date.now(),
      errorMessage,
    };
  }

  const config = resolveHealthConfig(agent);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    const response = await fetch(config.url, {
      method: config.method,
      signal: controller.signal,
      headers: config.headers,
    });

    clearTimeout(timeoutId);
    const responseMs = Date.now() - startTime;
    const httpStatus = response.status;

    if (response.ok) {
      try {
        const data = await response.json();
        const result = config.parseStatus(data);
        const checkStatus = result.status as CheckStatus;

        upsertHourlyStat(agent.id, result.status, responseMs);
        recordCheck(
          agent.id,
          checkStatus,
          responseMs,
          httpStatus,
          null,
          result.errorMessage ?? null,
        );

        return {
          ...agent,
          status: result.status,
          lastChecked: Date.now(),
          errorMessage: result.errorMessage,
        };
      } catch {
        const result = config.parseStatus(null);
        const checkStatus = result.status as CheckStatus;

        upsertHourlyStat(agent.id, result.status, responseMs);
        recordCheck(
          agent.id,
          checkStatus,
          responseMs,
          httpStatus,
          null,
          result.errorMessage ?? null,
        );

        return {
          ...agent,
          status: result.status,
          lastChecked: Date.now(),
          errorMessage: result.errorMessage,
        };
      }
    } else {
      const checkStatus: CheckStatus = "error";
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      upsertHourlyStat(agent.id, checkStatus, responseMs);
      recordCheck(
        agent.id,
        checkStatus,
        responseMs,
        httpStatus,
        null,
        errorMessage,
      );

      return {
        ...agent,
        status: checkStatus,
        lastChecked: Date.now(),
        errorMessage,
      };
    }
  } catch (error) {
    const responseMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Extract error code from common error patterns
    const errorCode = extractErrorCode(error);
    const checkStatus: CheckStatus = "offline";

    upsertHourlyStat(agent.id, checkStatus, responseMs);
    recordCheck(
      agent.id,
      checkStatus,
      responseMs,
      null,
      errorCode,
      errorMessage,
    );

    return {
      ...agent,
      status: checkStatus,
      lastChecked: Date.now(),
      errorMessage,
    };
  }
}

/**
 * Extract an error code from an error object for categorization.
 */
function extractErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.toLowerCase();

  // Common fetch/network error patterns
  if (message.includes("abort") || message.includes("timeout")) {
    return "TIMEOUT";
  }
  if (
    message.includes("econnrefused") ||
    message.includes("connection refused")
  ) {
    return "CONN_REFUSED";
  }
  if (message.includes("enotfound") || message.includes("not found")) {
    return "DNS_ERROR";
  }
  if (message.includes("econnreset") || message.includes("reset")) {
    return "CONN_RESET";
  }
  if (message.includes("etimedout") || message.includes("timed out")) {
    return "TIMEOUT";
  }

  return null;
}

export async function checkOneAgentStatus(
  id: number,
): Promise<AgentStatusInfo | null> {
  const agents = await readAgents();
  const agent = agents.find((a) => a.id === id);
  if (!agent) return null;
  const result = await checkAgentStatus(agent);
  return {
    id: result.id,
    status: result.status,
    lastChecked: result.lastChecked,
    errorMessage: result.errorMessage,
  };
}

export async function checkAllAgentsStatus(): Promise<AgentStatusInfo[]> {
  const agents = await readAgents();
  const enabledAgents = agents.filter((a) => a.enabled !== false);
  const statusPromises = enabledAgents.map((agent) => checkAgentStatus(agent));
  const results = await Promise.all(statusPromises);
  return results.map(({ id, status, lastChecked, errorMessage }) => ({
    id,
    status,
    lastChecked,
    errorMessage,
  }));
}

export function resolveHealthConfig(agent: Agent): {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  timeout: number;
  parseStatus: StatusParser;
} {
  const baseUrl = normalizeUrl(agent.url);

  const agentType = getAgentType(agent.type);
  const endpoint =
    agent.healthEndpoint ?? agentType?.healthEndpoint ?? "/health";
  const method = agentType?.healthMethod ?? "GET";
  const headers = { Accept: "application/json", ...(agentType?.headers ?? {}) };
  const timeout = agentType?.timeout ?? 5000;
  const parseStatus = agent.statusShape
    ? STATUS_PARSERS[agent.statusShape as StatusShape]
    : (agentType?.parseStatus ?? STATUS_PARSERS.always_ok);

  return {
    url: `${baseUrl}:${agent.port}${endpoint}`,
    method,
    headers,
    timeout,
    parseStatus,
  };
}

export { getAgentTypeList, getAgentType } from "../agentTypes";

/**
 * Initialize the database and run migrations.
 * Call this once at app startup before any other DB operations.
 */
export async function initDatabase(): Promise<void> {
  await initializeDatabase();
}
