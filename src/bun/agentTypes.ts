// Agent Type Registry — defines supported agent types and their health check strategies
export interface AgentTypeConfig {
  id: string;
  name: string;
  healthEndpoint: string;
  healthMethod: "GET" | "POST";
  headers?: Record<string, string>;
  parseStatus: (json: unknown) => {
    status: "ok" | "offline" | "error";
    errorMessage?: string;
  };
  timeout?: number;
}

/**
 * Standard status parser for OpenClaw/OpenCrabs agents.
 * Returns "error" if the response JSON has status "error", otherwise "ok".
 */
function parseStandardAgentStatus(json: unknown): {
  status: "ok" | "error";
  errorMessage?: string;
} {
  const data = json as { status?: string };
  if (data.status === "error") return { status: "error" };
  return { status: "ok" };
}

export const AGENT_TYPES: Record<string, AgentTypeConfig> = {
  generic: {
    id: "generic",
    name: "Generic",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: (_json) => ({ status: "ok" }),
  },
  openclaw: {
    id: "openclaw",
    name: "OpenClaw",
    healthEndpoint: "/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
  },
  opencrabs: {
    id: "opencrabs",
    name: "OpenCrabs",
    healthEndpoint: "/a2a/health",
    healthMethod: "GET",
    parseStatus: parseStandardAgentStatus,
  },
};

export function getAgentType(id: string): AgentTypeConfig | undefined {
  return AGENT_TYPES[id];
}

export function getAgentTypeList(): { id: string; name: string }[] {
  return Object.values(AGENT_TYPES).map(({ id, name }) => ({ id, name }));
}
