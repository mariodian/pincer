import type { Status } from "./types";

// Agent Type Registry — defines supported agent types and their health check strategies
export interface AgentTypeConfig {
  id: string;
  name: string;
  healthEndpoint: string;
  healthMethod: "GET" | "POST";
  headers?: Record<string, string>;
  parseStatus: StatusParser;
  timeout?: number;
  defaultPort: number;
  responseFormat: "json" | "text";
}

/** Signature for a health response parser. */
export type StatusParser = (body: unknown) => {
  status: Status;
  errorMessage?: string;
};

/** Preset options for how "custom" agents interpret their health response. */
export const STATUS_SHAPE_OPTIONS = [
  { value: "always_ok" as const, label: "Always OK (HTTP 200)" },
  { value: "json_status" as const, label: "Check JSON { status: 'ok' }" },
] as const;

export type StatusShape = (typeof STATUS_SHAPE_OPTIONS)[number]["value"];

/** Maps a status shape preset to its parser function. */
export const STATUS_PARSERS: Record<StatusShape, StatusParser> = {
  always_ok: (_body) => {
    try {
      return { status: "ok" };
    } catch {
      return { status: "error", errorMessage: "Parser error" };
    }
  },
  json_status: (body) => {
    try {
      const data = body as { status?: Status };
      return data.status === "ok" ? { status: "ok" } : { status: "error" };
    } catch {
      return { status: "error", errorMessage: "Invalid JSON status format" };
    }
  },
};

/**
 * Standard status parser for OpenClaw/OpenCrabs agents.
 * Returns "error" if the response JSON has status "error", otherwise "ok".
 */
function parseStandardAgentStatus(body: unknown): {
  status: Status;
  errorMessage?: string;
} {
  try {
    const data = body as { status?: Status };
    if (data.status === "error") return { status: "error" };
    return { status: "ok" };
  } catch {
    return { status: "error", errorMessage: "Invalid health response format" };
  }
}

function parseOllamaStatus(text: unknown): {
  status: Status;
  errorMessage?: string;
} {
  try {
    if (typeof text !== "string") {
      return { status: "error", errorMessage: "Expected text response" };
    }
    return text.toLowerCase().includes("ollama is running")
      ? { status: "ok" }
      : { status: "error", errorMessage: "Unexpected Ollama health response" };
  } catch {
    return { status: "error", errorMessage: "Invalid health response format" };
  }
}

export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  custom: {
    id: "custom",
    name: "Custom",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: STATUS_PARSERS.always_ok,
    defaultPort: 18790,
    responseFormat: "json",
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 8642,
    responseFormat: "json",
  },
  lmstudio: {
    id: "lmstudio",
    name: "LM Studio",
    healthEndpoint: "/api/v1/models",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 1234,
    responseFormat: "json",
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    healthEndpoint: "/",
    healthMethod: "GET",
    parseStatus: parseOllamaStatus,
    defaultPort: 11434,
    responseFormat: "text",
  },
  openclaw: {
    id: "openclaw",
    name: "OpenClaw",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 18789,
    responseFormat: "json",
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    healthEndpoint: "/global/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 4096,
    responseFormat: "json",
  },
  opencrabs: {
    id: "opencrabs",
    name: "OpenCrabs",
    healthEndpoint: "/a2a/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 18790,
    responseFormat: "json",
  },
};

export function getAgentType(id: string): AgentTypeConfig | undefined {
  return AGENT_TYPES[id];
}

export function getAgentTypeList(): {
  id: string;
  name: string;
  defaultPort: number;
}[] {
  return Object.values(AGENT_TYPES).map(({ id, name, defaultPort }) => ({
    id,
    name,
    defaultPort,
  }));
}
