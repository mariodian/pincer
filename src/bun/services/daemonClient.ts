import type { Check, HourlyStat, IncidentEvent } from "../../shared/types";

export interface DaemonPageResult<T> {
  data: T[];
  nextCursor: number | null;
}

export interface AgentPushPayload {
  id: number;
  type: string;
  name: string;
  url: string;
  port: number;
  enabled: boolean;
  healthEndpoint: string | null;
  statusShape: string | null;
  agentHash: string | null;
}

export class DaemonClient {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly namespaceId: string;
  private readonly machineId: string;
  private readonly timeout: number;

  constructor(
    baseUrl: string,
    secret: string,
    namespaceId: string,
    machineId: string,
    timeout = 10000,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.secret = secret;
    this.namespaceId = namespaceId;
    this.machineId = machineId;
    this.timeout = timeout;
  }

  async testConnection(): Promise<Response> {
    return this.request("/health");
  }

  async fetchChecks(
    since: number,
    cursor = 0,
    limit = 1000,
  ): Promise<DaemonPageResult<Check>> {
    const res = await this.request(
      `/checks?since=${since}&cursor=${cursor}&limit=${limit}`,
    );
    const body = (await res.json()) as {
      checks: Check[];
      nextCursor: number | null;
    };
    return { data: body.checks, nextCursor: body.nextCursor };
  }

  async fetchStats(since: number): Promise<HourlyStat[]> {
    const res = await this.request(`/stats?since=${since}`);
    return res.json() as Promise<HourlyStat[]>;
  }

  async fetchIncidentEvents(since: number): Promise<IncidentEvent[]> {
    const res = await this.request(`/incident-events?since=${since}`);
    return res.json() as Promise<IncidentEvent[]>;
  }

  async fetchOpenIncidents(): Promise<
    Array<{ agentId: number; incidentId: string }>
  > {
    const res = await this.request("/open-incidents");
    return res.json() as Promise<
      Array<{ agentId: number; incidentId: string }>
    >;
  }

  async fetchAgents(): Promise<AgentPushPayload[]> {
    const res = await this.request("/agents");
    return res.json() as Promise<AgentPushPayload[]>;
  }

  async pushAgents(payload: AgentPushPayload[]): Promise<{ updated: number }> {
    const res = await this.request("/agents", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<{ updated: number }>;
  }

  async deleteAgent(agentId: number): Promise<{ deleted: boolean }> {
    const res = await this.request(`/agents/${agentId}`, {
      method: "DELETE",
    });
    return res.json() as Promise<{ deleted: boolean }>;
  }

  private async request(
    path: string,
    options?: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${this.secret}`,
          "X-Namespace-ID": this.namespaceId,
          "X-Machine-ID": this.machineId,
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Daemon request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
