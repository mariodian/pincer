import type { Status } from "$shared/types";

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
}

/** Signature for a health response parser. */
export type StatusParser = (json: unknown) => {
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
  always_ok: (_json) => ({ status: "ok" }),
  json_status: (json) => {
    const data = json as { status?: Status };
    return data.status === "ok" ? { status: "ok" } : { status: "error" };
  },
};

/**
 * Standard status parser for OpenClaw/OpenCrabs agents.
 * Returns "error" if the response JSON has status "error", otherwise "ok".
 */
function parseStandardAgentStatus(json: unknown): {
  status: Status;
  errorMessage?: string;
} {
  const data = json as { status?: Status };
  if (data.status === "error") return { status: "error" };
  return { status: "ok" };
}

export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  custom: {
    id: "custom",
    name: "Custom",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: STATUS_PARSERS.always_ok,
    defaultPort: 18790,
  },
  openclaw: {
    id: "openclaw",
    name: "OpenClaw",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 18789,
  },
  opencrabs: {
    id: "opencrabs",
    name: "OpenCrabs",
    healthEndpoint: "/a2a/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 18790,
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 8642,
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    healthEndpoint: "/global/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
    defaultPort: 4096,
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
