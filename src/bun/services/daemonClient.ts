import type {
  Agent,
  Check,
  HourlyStat,
  IncidentEvent,
} from "../../shared/types";

export interface DaemonPageResult<T> {
  data: T[];
  nextCursor: number | null;
}

export class DaemonClient {
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly timeout: number;

  constructor(baseUrl: string, secret: string, timeout = 10000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.secret = secret;
    this.timeout = timeout;
  }

  async testConnection(): Promise<Response> {
    return this.request("/health");
  }

  async fetchChecks(
    since: number,
    limit = 1000,
  ): Promise<DaemonPageResult<Check>> {
    const res = await this.request(`/checks?since=${since}&limit=${limit}`);
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

  async pushAgents(agents: Agent[]): Promise<{ updated: number }> {
    const res = await this.request("/agents", {
      method: "PUT",
      body: JSON.stringify(agents),
    });
    return res.json() as Promise<{ updated: number }>;
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
