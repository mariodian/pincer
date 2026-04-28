import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { DaemonClient } from "../../../bun/services/daemonClient";
import { mockFetchOk, mockFetchThrow } from "../../setup";

function makeClient(
  overrides: Partial<{
    baseUrl: string;
    secret: string;
    timeout: number;
  }> = {},
) {
  return new DaemonClient(
    overrides.baseUrl ?? "http://daemon:7378",
    overrides.secret ?? "test-secret",
    "ns-123",
    "machine-abc",
    overrides.timeout ?? 10000,
  );
}

let originalFetch: typeof global.fetch;
beforeEach(() => {
  originalFetch = global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * DaemonClient Unit Tests
 *
 * These tests verify the behavior of the DaemonClient's HTTP request logic,
 * including header construction, query parameters, and error handling.
 * The fetch function is mocked to simulate various responses and errors.
 */
describe("DaemonClient", () => {
  describe("request headers", () => {
    it("should send Authorization, X-Namespace-ID and X-Machine-ID", async () => {
      let capturedHeaders: HeadersInit | undefined;
      global.fetch = (async (_url, init) => {
        capturedHeaders = init?.headers;
        return new Response("{}", { status: 200 });
      }) as typeof fetch;

      await makeClient().testConnection();
      const h = capturedHeaders as Record<string, string>;
      expect(h["Authorization"]).toBe("Bearer test-secret");
      expect(h["X-Namespace-ID"]).toBe("ns-123");
      expect(h["X-Machine-ID"]).toBe("machine-abc");
    });

    it("should strip trailing slashes from baseUrl", async () => {
      let capturedUrl = "";
      global.fetch = (async (url) => {
        capturedUrl = url.toString();
        return new Response("{}", { status: 200 });
      }) as typeof fetch;

      await new DaemonClient(
        "http://daemon:7378///",
        "s",
        "ns",
        "m",
      ).testConnection();
      expect(capturedUrl).toBe("http://daemon:7378/health");
    });
  });

  describe("fetchChecks", () => {
    it("should build correct query string", async () => {
      let capturedUrl = "";
      global.fetch = (async (url) => {
        capturedUrl = url.toString();
        return new Response(JSON.stringify({ checks: [], nextCursor: null }), {
          status: 200,
        });
      }) as typeof fetch;

      await makeClient().fetchChecks(5000, 100, 500);
      expect(capturedUrl).toContain("since=5000");
      expect(capturedUrl).toContain("cursor=100");
      expect(capturedUrl).toContain("limit=500");
    });

    it("should return data and nextCursor", async () => {
      const check = {
        id: 1,
        agentId: 1,
        checkedAt: 1000,
        status: "ok",
        responseMs: 100,
        httpStatus: 200,
        errorCode: null,
        errorMessage: null,
      };
      global.fetch = mockFetchOk({
        checks: [check],
        nextCursor: 1000,
      }) as typeof fetch;

      const result = await makeClient().fetchChecks(0);
      expect(result.data).toHaveLength(1);
      expect(result.nextCursor).toBe(1000);
    });

    it("should return null nextCursor on last page", async () => {
      global.fetch = mockFetchOk({
        checks: [],
        nextCursor: null,
      }) as typeof fetch;
      const result = await makeClient().fetchChecks(0);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe("pushAgents", () => {
    it("should use PUT method", async () => {
      let capturedMethod = "";
      global.fetch = (async (_url, init) => {
        capturedMethod = init?.method ?? "GET";
        return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
      }) as typeof fetch;

      await makeClient().pushAgents([]);
      expect(capturedMethod).toBe("PUT");
    });

    it("should return updated count", async () => {
      global.fetch = mockFetchOk({ updated: 3 }) as typeof fetch;
      const result = await makeClient().pushAgents([]);
      expect(result.updated).toBe(3);
    });
  });

  describe("deleteAgent", () => {
    it("should use DELETE method with agent ID in path", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      global.fetch = (async (url, init) => {
        capturedUrl = url.toString();
        capturedMethod = init?.method ?? "";
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }) as typeof fetch;

      await makeClient().deleteAgent(42);
      expect(capturedUrl).toContain("/agents/42");
      expect(capturedMethod).toBe("DELETE");
    });
  });

  describe("timeout", () => {
    it("should throw a timeout error when request is aborted", async () => {
      global.fetch = (async (_url, init) => {
        // Simulate abort being triggered
        void init?.signal;
        await new Promise((_, reject) => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
        return new Response();
      }) as typeof fetch;

      const client = makeClient({ timeout: 100 });
      await expect(client.testConnection()).rejects.toThrow("timed out");
    });

    it("should rethrow non-abort errors", async () => {
      global.fetch = mockFetchThrow(
        new Error("Network failure"),
      ) as typeof fetch;
      await expect(makeClient().testConnection()).rejects.toThrow(
        "Network failure",
      );
    });
  });
});
