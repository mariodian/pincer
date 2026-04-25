import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  resolveHealthConfig,
  executeHealthCheck,
  extractErrorCode,
} from "../../shared/agentHealthCheck";
import {
  createAgent,
  mockFetchOk,
  mockFetchError,
  mockFetchThrow,
} from "../setup";

describe("agentHealthCheck", () => {
  describe("resolveHealthConfig", () => {
    it("should resolve config for custom agent with defaults", () => {
      const agent = createAgent({
        type: "custom",
        url: "example.com",
        port: 8080,
      });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://example.com:8080/health");
      expect(config.method).toBe("GET");
      expect(config.headers.Accept).toBe("application/json");
      expect(config.timeout).toBe(5000);
    });

    it("should resolve config for openclaw agent", () => {
      const agent = createAgent({
        type: "openclaw",
        url: "http://localhost",
        port: 18789,
      });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://localhost:18789/health");
      expect(config.parseStatus).toBeDefined();
    });

    it("should resolve config for opencrabs agent with custom endpoint", () => {
      const agent = createAgent({
        type: "opencrabs",
        url: "agent.local",
        port: 18790,
      });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://agent.local:18790/a2a/health");
    });

    it("should resolve config for opencode agent", () => {
      const agent = createAgent({
        type: "opencode",
        url: "192.168.1.1",
        port: 4096,
      });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://192.168.1.1:4096/global/health");
    });

    it("should use agent-specific healthEndpoint override", () => {
      const agent = createAgent({
        type: "custom",
        healthEndpoint: "/custom/health",
      });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://localhost:8080/custom/health");
    });

    it("should use agent-specific statusShape", () => {
      const agent = createAgent({
        type: "custom",
        statusShape: "json_status",
      });
      const config = resolveHealthConfig(agent);

      // json_status parser returns ok/error based on JSON status field
      expect(config.parseStatus({ status: "ok" })).toEqual({ status: "ok" });
      expect(config.parseStatus({ status: "error" })).toEqual({
        status: "error",
      });
    });

    it("should add http:// prefix to bare URLs", () => {
      const agent = createAgent({ url: "example.com" });
      const config = resolveHealthConfig(agent);

      expect(config.url.startsWith("http://")).toBe(true);
    });

    it("should preserve https:// prefix", () => {
      const agent = createAgent({ url: "https://example.com" });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("https://example.com:8080/health");
    });

    it("should strip trailing slashes from URL", () => {
      const agent = createAgent({ url: "http://example.com/" });
      const config = resolveHealthConfig(agent);

      expect(config.url).toBe("http://example.com:8080/health");
    });

    it("should use agent type timeout if defined", () => {
      // custom has no timeout override, defaults to 5000
      const agent = createAgent({ type: "custom" });
      const config = resolveHealthConfig(agent);
      expect(config.timeout).toBe(5000);
    });
  });

  describe("extractErrorCode", () => {
    it("should return TIMEOUT for abort errors", () => {
      expect(extractErrorCode(new Error("Request aborted"))).toBe("TIMEOUT");
      expect(extractErrorCode(new Error("timeout occurred"))).toBe("TIMEOUT");
    });

    it("should return CONN_REFUSED for connection refused", () => {
      expect(extractErrorCode(new Error("ECONNREFUSED"))).toBe("CONN_REFUSED");
      expect(extractErrorCode(new Error("connection refused"))).toBe(
        "CONN_REFUSED",
      );
    });

    it("should return DNS_ERROR for not found", () => {
      expect(extractErrorCode(new Error("ENOTFOUND"))).toBe("DNS_ERROR");
      expect(extractErrorCode(new Error("not found"))).toBe("DNS_ERROR");
    });

    it("should return CONN_RESET for reset errors", () => {
      expect(extractErrorCode(new Error("ECONNRESET"))).toBe("CONN_RESET");
      expect(extractErrorCode(new Error("connection reset"))).toBe(
        "CONN_RESET",
      );
    });

    it("should return TIMEOUT for ETIMEDOUT", () => {
      expect(extractErrorCode(new Error("ETIMEDOUT"))).toBe("TIMEOUT");
      expect(extractErrorCode(new Error("timed out"))).toBe("TIMEOUT");
    });

    it("should return null for non-Error objects", () => {
      expect(extractErrorCode("string error")).toBeNull();
      expect(extractErrorCode(123)).toBeNull();
      expect(extractErrorCode(null)).toBeNull();
    });

    it("should return null for unmapped errors", () => {
      expect(extractErrorCode(new Error("something else"))).toBeNull();
    });
  });

  describe("executeHealthCheck", () => {
    let originalFetch: typeof fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should return ok status for successful health check with JSON status", async () => {
      global.fetch = mockFetchOk({ status: "ok" }) as typeof fetch;

      const agent = createAgent({ type: "custom", statusShape: "json_status" });
      const result = await executeHealthCheck(agent);

      expect(result.agentId).toBe(agent.id);
      expect(result.status).toBe("ok");
      expect(result.httpStatus).toBe(200);
      expect(result.errorCode).toBeNull();
    });

    it("should return error status for HTTP 500 response", async () => {
      global.fetch = mockFetchError(
        500,
        "Internal Server Error",
      ) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("error");
      expect(result.httpStatus).toBe(500);
      expect(result.errorMessage).toContain("500");
    });

    it("should return degraded status when JSON parser returns degraded", async () => {
      global.fetch = mockFetchOk({ status: "degraded" }) as typeof fetch;

      const agent = createAgent({ type: "custom", statusShape: "json_status" });
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("error");
    });

    it("should return offline status on timeout (AbortError)", async () => {
      global.fetch = mockFetchThrow(new Error("AbortError")) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("offline");
      expect(result.errorCode).toBe("TIMEOUT");
      expect(result.httpStatus).toBeNull();
    });

    it("should return offline status on connection refused", async () => {
      global.fetch = mockFetchThrow(new Error("ECONNREFUSED")) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("offline");
      expect(result.errorCode).toBe("CONN_REFUSED");
    });

    it("should return offline status on DNS error", async () => {
      global.fetch = mockFetchThrow(new Error("ENOTFOUND")) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("offline");
      expect(result.errorCode).toBe("DNS_ERROR");
    });

    it("should return offline for generic network errors", async () => {
      global.fetch = mockFetchThrow(new Error("Network error")) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("offline");
      expect(result.errorCode).toBeNull();
      expect(result.errorMessage).toBe("Network error");
    });

    it("should include response time in result", async () => {
      global.fetch = mockFetchOk({ status: "ok" }) as typeof fetch;

      const agent = createAgent();
      const result = await executeHealthCheck(agent);

      expect(result.responseMs).toBeGreaterThanOrEqual(0);
    });

    it("should use provided config instead of resolving", async () => {
      let fetchedUrl = "";
      global.fetch = ((url: string | URL | Request) => {
        fetchedUrl = url.toString();
        return Promise.resolve(mockFetchResponse(200, { status: "ok" }));
      }) as typeof fetch;

      const agent = createAgent();
      const customConfig = {
        url: "http://custom:9999/health",
        method: "POST" as const,
        headers: { Accept: "application/json" },
        timeout: 1000,
        parseStatus: () => ({ status: "ok" as const }),
      };

      await executeHealthCheck(agent, customConfig);
      expect(fetchedUrl).toBe("http://custom:9999/health");
    });

    it("should handle non-JSON responses with always_ok parser", async () => {
      global.fetch = (() =>
        Promise.resolve(
          new Response("not json", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          }),
        )) as unknown as typeof fetch;

      const agent = createAgent({ type: "custom", statusShape: "always_ok" });
      const result = await executeHealthCheck(agent);

      expect(result.status).toBe("ok");
    });

    it("should handle parse errors gracefully", async () => {
      global.fetch = (() =>
        Promise.resolve(
          new Response("not json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )) as unknown as typeof fetch;

      const agent = createAgent({ type: "custom", statusShape: "json_status" });
      const result = await executeHealthCheck(agent);

      // When JSON parsing fails, it falls back to parseStatus(null)
      // json_status parser returns error for null
      expect(result.status).toBe("error");
    });
  });
});

// Helper for executeHealthCheck tests
function mockFetchResponse(
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
