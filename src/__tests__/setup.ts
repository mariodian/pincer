import type { Agent, CheckStatus } from "../shared/types";

// ─── Factories ──────────────────────────────────────────────────────────────

/** Create a minimal Agent for tests */
export function createAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 1,
    type: "custom",
    name: "Test Agent",
    url: "http://localhost",
    port: 8080,
    enabled: true,
    ...overrides,
  };
}

/** Create a batch of agents with auto-incrementing IDs */
export function createAgents(
  count: number,
  base: Partial<Agent> = {},
): Agent[] {
  return Array.from({ length: count }, (_, i) =>
    createAgent({ id: i + 1, name: `Agent ${i + 1}`, ...base }),
  );
}

// ─── Mock fetch ─────────────────────────────────────────────────────────────

/** Create a mock Response for use with global.fetch mocking */
export function mockFetchResponse(
  status: number,
  body: unknown,
  statusText = "OK",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" },
  });
}

/** Simplified mock fetch type that satisfies the function signature */
export type MockFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

/** Create a mock fetch that returns a successful JSON response */
export function mockFetchOk(body: unknown): MockFetch {
  return () => Promise.resolve(mockFetchResponse(200, body));
}

/** Create a mock fetch that returns an HTTP error */
export function mockFetchError(status: number, statusText: string): MockFetch {
  return () => Promise.resolve(mockFetchResponse(status, {}, statusText));
}

/** Create a mock fetch that throws (network error / timeout) */
export function mockFetchThrow(error: Error): MockFetch {
  return () => Promise.reject(error);
}

// ─── Time helpers ───────────────────────────────────────────────────────────

/** Freeze Date.now() for the duration of the callback */
export function withFrozenTime<T>(timestamp: number, fn: () => T): T {
  const original = Date.now;
  Date.now = () => timestamp;
  try {
    return fn();
  } finally {
    Date.now = original;
  }
}

// ─── Mock incident tracker deps ─────────────────────────────────────────────

import type { IncidentTrackerDeps } from "../shared/incidentCore";

export interface MockIncidentTrackerDeps extends IncidentTrackerDeps {
  _events: Array<{
    agentId: number;
    incidentId: string;
    eventType: "opened" | "recovered" | "status_changed";
    fromStatus: CheckStatus | null;
    toStatus: CheckStatus | null;
    reason: string | null;
    namespaceId?: string;
  }>;
  _checks: Map<number, Array<{ status: CheckStatus; checkedAt: number }>>;
}

export function createMockIncidentDeps(
  overrides: Partial<IncidentTrackerDeps> = {},
): MockIncidentTrackerDeps {
  const events: Array<{
    agentId: number;
    incidentId: string;
    eventType: "opened" | "recovered" | "status_changed";
    fromStatus: CheckStatus | null;
    toStatus: CheckStatus | null;
    reason: string | null;
    namespaceId?: string;
  }> = [];

  const checks = new Map<
    number,
    Array<{ status: CheckStatus; checkedAt: number }>
  >();

  return {
    insertEvent: (
      agentId,
      incidentId,
      eventType,
      fromStatus,
      toStatus,
      reason,
      namespaceId,
    ) => {
      events.push({
        agentId,
        incidentId,
        eventType,
        fromStatus,
        toStatus,
        reason,
        namespaceId,
      });
    },
    getAgentLastNChecks: (agentId, n) => {
      return (checks.get(agentId) ?? []).slice(0, n);
    },
    getOpenIncidents: () => {
      const open = new Set<string>();
      for (const e of events) {
        if (e.eventType === "opened") open.add(e.incidentId);
        if (e.eventType === "recovered") open.delete(e.incidentId);
      }
      return Array.from(open).map((incidentId) => {
        const e = events.find(
          (ev) => ev.incidentId === incidentId && ev.eventType === "opened",
        )!;
        return { agentId: e.agentId, incidentId, openedAt: Date.now() };
      });
    },
    getHandedOffIncidents: () => [],
    hasIncidentRecovered: (incidentId) => {
      return events.some(
        (e) => e.incidentId === incidentId && e.eventType === "recovered",
      );
    },
    log: () => {},
    ...overrides,
    _events: events,
    _checks: checks,
  };
}
