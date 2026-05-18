import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { createAgent, mockFetchThrow } from "../../setup";

// ─── Must mock before dynamic imports ────────────────────────────────────────

mock.module("../../../bun/services/loggerService", () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
    error: mock(() => {}),
  },
}));

const { pushAgentsToDaemonWith, computeAgentHash } =
  await import("../../../bun/services/daemonSyncService");

// ─── Reusable fetch mock ──────────────────────────────────────────────────────

function makeFetchMock(onPut: (url: string, init: RequestInit) => Response) {
  return (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "PUT") return onPut(url, init!);
    return new Response(JSON.stringify([]), { status: 200 });
  }) as unknown as typeof fetch;
}

// ─── Shared test data ─────────────────────────────────────────────────────────

const defaultSettings = {
  enabled: true,
  url: "http://daemon:7378",
  secret: "test-secret",
  namespaceKey: "ns-test",
};

const defaultAgents = () => [
  createAgent({
    id: 1,
    type: "http",
    name: "Agent 1",
    url: "http://localhost",
    port: 80,
  }),
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeDeps(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getMeta: (key: string) => store[key] ?? null,
    setMeta: (key: string, value: string) => {
      store[key] = value;
    },
    _store: store,
  };
}

async function push(
  overrides: {
    settings?: Partial<typeof defaultSettings>;
    agents?: ReturnType<typeof defaultAgents>;
    machineId?: string;
    deps?: ReturnType<typeof makeDeps>;
  } = {},
) {
  const settings = { ...defaultSettings, ...overrides.settings };
  const agents = overrides.agents ?? defaultAgents();
  const machineId = overrides.machineId ?? "machine-abc";
  const deps = overrides.deps ?? makeDeps();
  return pushAgentsToDaemonWith(settings, agents, machineId, deps);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let originalFetch: typeof global.fetch;
beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("computeAgentHash", () => {
  it("hashes based on type:url:port only — name changes do not affect hash", () => {
    const base = createAgent({
      type: "http",
      url: "http://localhost",
      port: 80,
    });
    const renamed = createAgent({ ...base, name: "Different Name" });
    expect(computeAgentHash(base)).toBe(computeAgentHash(renamed));

    const retyped = createAgent({ ...base, type: "custom" });
    expect(computeAgentHash(base)).not.toBe(computeAgentHash(retyped));
  });

  it("is deterministic for the same agent", () => {
    const agent = createAgent({
      type: "http",
      url: "http://localhost",
      port: 80,
    });
    expect(computeAgentHash(agent)).toBe(computeAgentHash(agent));
  });

  it("produces different hashes for different agents", () => {
    const a = createAgent({ type: "http", url: "http://localhost", port: 80 });
    const b = createAgent({ type: "http", url: "http://localhost", port: 81 });
    expect(computeAgentHash(a)).not.toBe(computeAgentHash(b));
  });

  it("returns a 16-character hex string", () => {
    const agent = createAgent({
      type: "http",
      url: "http://example.com",
      port: 443,
    });
    expect(computeAgentHash(agent)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("namespaceId resolution", () => {
  it("uses namespaceKey when set", async () => {
    let capturedNamespaceHeader = "";
    global.fetch = makeFetchMock((_, init) => {
      capturedNamespaceHeader = (init.headers as Record<string, string>)[
        "X-Namespace-ID"
      ];
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push({ settings: { namespaceKey: "custom-namespace" } });
    expect(capturedNamespaceHeader).toBe("custom-namespace:test");
  });

  it("falls back to machineId when namespaceKey is empty", async () => {
    let capturedNamespaceHeader = "";
    global.fetch = makeFetchMock((_, init) => {
      capturedNamespaceHeader = (init.headers as Record<string, string>)[
        "X-Namespace-ID"
      ];
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push({ settings: { namespaceKey: "" }, machineId: "machine-abc" });
    expect(capturedNamespaceHeader).toBe("machine-abc:test");
  });
});

describe("pushAgentsToDaemonWith", () => {
  it("does nothing when daemon is not configured", async () => {
    let fetchCalled = false;
    global.fetch = (async () => {
      fetchCalled = true;
      return new Response();
    }) as unknown as typeof fetch;

    await push({ settings: { enabled: false, url: "", secret: "" } });
    expect(fetchCalled).toBe(false);
  });

  it("does not push agents when there are none (probe still runs)", async () => {
    let putCalled = false;
    global.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") putCalled = true;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    await push({ agents: [] });
    expect(putCalled).toBe(false);
  });

  it("calls PUT /agents with correct method", async () => {
    let capturedMethod = "";
    global.fetch = makeFetchMock((_, init) => {
      capturedMethod = init.method!;
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push();
    expect(capturedMethod).toBe("PUT");
  });

  it("calls the correct URL", async () => {
    let capturedUrl = "";
    global.fetch = makeFetchMock((url) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push();
    expect(capturedUrl).toContain("/agents");
  });

  it("sends correct Authorization and X-Machine-ID headers", async () => {
    let capturedHeaders: Record<string, string> = {};
    global.fetch = makeFetchMock((_, init) => {
      capturedHeaders = init.headers as Record<string, string>;
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push();
    expect(capturedHeaders["Authorization"]).toBe("Bearer test-secret");
    expect(capturedHeaders["X-Machine-ID"]).toBe("machine-abc");
  });

  it("sends agents with correct payload fields including agentHash", async () => {
    let capturedBody: Array<Record<string, unknown>> = [];
    global.fetch = makeFetchMock((_, init) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    });

    await push();
    const agent = capturedBody[0];
    expect(agent).toBeDefined();
    expect(agent.id).toBe(1);
    expect(agent.name).toBe("Agent 1");
    expect(agent.agentHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("does not throw when fetch fails (handles errors gracefully)", async () => {
    global.fetch = mockFetchThrow(
      new Error("Network failure"),
    ) as unknown as typeof fetch;
    await expect(push()).resolves.toBeUndefined();
  });
});

describe("namespace migration", () => {
  it("probes and stores namespace on first push (no previous namespace, no legacy agents)", async () => {
    let postCalled = false;
    global.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") postCalled = true;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const deps = makeDeps();
    await push({ agents: [], deps });
    expect(deps._store["daemon_last_namespace_id"]).toBe("ns-test:test");
    expect(postCalled).toBe(false);
  });

  it("migrates when previous namespace is null but legacy agents exist", async () => {
    const deps = makeDeps();

    let getProbeCalled = false;
    let postCalled = false;
    let postNamespaceHeader = "";

    global.fetch = (async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      const namespaceHeader = headers?.["X-Namespace-ID"] ?? "";
      const method = init?.method ?? "";

      if (method === "" && namespaceHeader === "ns-test") {
        getProbeCalled = true;
        return new Response(
          JSON.stringify([
            { id: 1, type: "http", name: "Old", url: "http://old", port: 80 },
          ]),
          { status: 200 },
        );
      }

      if (method === "POST") {
        postCalled = true;
        postNamespaceHeader = namespaceHeader;
        return new Response(
          JSON.stringify({
            migrated: true,
            agents: 1,
            checks: 5,
            stats: 3,
            incidents: 0,
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    await push({ agents: [], deps });
    expect(getProbeCalled).toBe(true);
    expect(postCalled).toBe(true);
    expect(postNamespaceHeader).toBe("ns-test");
    expect(deps._store["daemon_last_namespace_id"]).toBe("ns-test:test");
  });

  it("stores namespace without migrating when probe fails (daemon unreachable)", async () => {
    const deps = makeDeps();

    global.fetch = (async () => {
      throw new Error("Connection refused");
    }) as unknown as typeof fetch;

    await push({ agents: [], deps });
    expect(deps._store["daemon_last_namespace_id"]).toBe("ns-test:test");
  });

  it("skips migration when namespace unchanged", async () => {
    const deps = makeDeps({ daemon_last_namespace_id: "ns-test:test" });

    let postCalled = false;
    global.fetch = (async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") postCalled = true;
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    await push({ agents: [], deps });
    expect(postCalled).toBe(false);
  });

  it("migrates namespace when it changes", async () => {
    const deps = makeDeps({ daemon_last_namespace_id: "old-namespace" });

    let capturedPath = "";
    let capturedNamespaceHeader = "";
    let capturedBodyRaw = "";

    global.fetch = (async (url: string, init?: RequestInit) => {
      capturedPath = new URL(url).pathname;
      capturedNamespaceHeader =
        (init?.headers as Record<string, string>)?.["X-Namespace-ID"] ?? "";
      capturedBodyRaw = (init?.body as string) ?? "";
      return new Response(
        JSON.stringify({
          migrated: true,
          agents: 2,
          checks: 10,
          stats: 5,
          incidents: 1,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await push({ agents: [], deps });
    expect(capturedPath).toBe("/namespace/migrate");
    expect(capturedNamespaceHeader).toBe("old-namespace");
    expect(JSON.parse(capturedBodyRaw).toNamespace).toBe("ns-test:test");
    expect(deps._store["daemon_last_namespace_id"]).toBe("ns-test:test");
  });

  it("retries on migration failure (does not update stored namespace)", async () => {
    const deps = makeDeps({ daemon_last_namespace_id: "old-namespace" });

    global.fetch = (async () => {
      return new Response(
        JSON.stringify({ error: "Target namespace already exists" }),
        { status: 409 },
      );
    }) as unknown as typeof fetch;

    await push({ agents: [], deps });
    expect(deps._store["daemon_last_namespace_id"]).toBe("old-namespace");
  });
});
