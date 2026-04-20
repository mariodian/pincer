import type { Agent, CheckStatus } from "./types";
import {
  type StatusParser,
  type StatusShape,
  STATUS_PARSERS,
  getAgentType,
} from "./agentTypes";
import { normalizeUrl } from "./agent-helpers";

export interface HealthConfig {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  timeout: number;
  parseStatus: StatusParser;
}

export interface HealthCheckResult {
  agentId: number;
  status: CheckStatus;
  responseMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/**
 * Resolve health check configuration for an agent.
 * Combines agent type defaults with agent-specific overrides.
 */
export function resolveHealthConfig(agent: Agent): HealthConfig {
  const baseUrl = normalizeUrl(agent.url);
  const agentType = getAgentType(agent.type);
  const endpoint =
    agent.healthEndpoint ?? agentType?.healthEndpoint ?? "/health";
  const method = agentType?.healthMethod ?? "GET";
  const headers = {
    Accept: "application/json",
    ...(agentType?.headers ?? {}),
  };
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

/**
 * Extract an error code from an error object for categorization.
 * Maps common network/fetch errors to standardized codes.
 */
export function extractErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.toLowerCase();

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

/**
 * Execute a health check for an agent.
 * Performs the HTTP request, parses the response, and returns structured result.
 */
export async function executeHealthCheck(
  agent: Agent,
  config?: HealthConfig,
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const healthConfig = config ?? resolveHealthConfig(agent);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      healthConfig.timeout,
    );

    const response = await fetch(healthConfig.url, {
      method: healthConfig.method,
      signal: controller.signal,
      headers: healthConfig.headers,
    });

    clearTimeout(timeoutId);
    const responseMs = Date.now() - startTime;
    const httpStatus = response.status;

    if (response.ok) {
      try {
        const data = await response.json();
        const result = healthConfig.parseStatus(data);
        return {
          agentId: agent.id,
          status: result.status as CheckStatus,
          responseMs,
          httpStatus,
          errorCode: null,
          errorMessage: result.errorMessage ?? null,
        };
      } catch {
        const result = healthConfig.parseStatus(null);
        return {
          agentId: agent.id,
          status: result.status as CheckStatus,
          responseMs,
          httpStatus,
          errorCode: null,
          errorMessage: result.errorMessage ?? null,
        };
      }
    } else {
      return {
        agentId: agent.id,
        status: "error",
        responseMs,
        httpStatus,
        errorCode: null,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
  } catch (error) {
    const responseMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = extractErrorCode(error);

    return {
      agentId: agent.id,
      status: "offline",
      responseMs,
      httpStatus: null,
      errorCode,
      errorMessage,
    };
  }
}
