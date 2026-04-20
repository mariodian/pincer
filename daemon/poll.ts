import { getDatabase } from "./db";
import { config } from "./config";
import { agents, checks, stats } from "./schema";
import { AGENT_TYPES, STATUS_PARSERS, getAgentType, type StatusParser, type StatusShape } from "./agentTypes";
import type { Agent, CheckStatus } from "../src/shared/types";
import { sql } from "drizzle-orm";

const MAX_CONCURRENT_CHECKS = 10;

function normalizeUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, "");
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

function resolveHealthConfig(agent: Agent): {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  timeout: number;
  parseStatus: StatusParser;
} {
  const baseUrl = normalizeUrl(agent.url);
  const agentType = getAgentType(agent.type);
  const endpoint = agent.healthEndpoint ?? agentType?.healthEndpoint ?? "/health";
  const method = agentType?.healthMethod ?? "GET";
  const headers = { Accept: "application/json", ...(agentType?.headers ?? {}) };
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

function extractErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const message = error.message.toLowerCase();
  if (message.includes("abort") || message.includes("timeout")) return "TIMEOUT";
  if (message.includes("econnrefused") || message.includes("connection refused")) return "CONN_REFUSED";
  if (message.includes("enotfound") || message.includes("not found")) return "DNS_ERROR";
  if (message.includes("econnreset") || message.includes("reset")) return "CONN_RESET";
  if (message.includes("etimedout") || message.includes("timed out")) return "TIMEOUT";
  return null;
}

async function checkAgent(agent: Agent): Promise<{
  agentId: number;
  status: CheckStatus;
  responseMs: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
}> {
  const startTime = Date.now();
  const healthConfig = resolveHealthConfig(agent);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthConfig.timeout);

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
        const status = result.status as CheckStatus;
        return { agentId: agent.id, status, responseMs, httpStatus, errorCode: null, errorMessage: result.errorMessage ?? null };
      } catch {
        const result = healthConfig.parseStatus(null);
        const status = result.status as CheckStatus;
        return { agentId: agent.id, status, responseMs, httpStatus, errorCode: null, errorMessage: result.errorMessage ?? null };
      }
    } else {
      const status: CheckStatus = "error";
      const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      return { agentId: agent.id, status, responseMs, httpStatus, errorCode: null, errorMessage };
    }
  } catch (error) {
    const responseMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = extractErrorCode(error);
    const status: CheckStatus = "offline";
    return { agentId: agent.id, status, responseMs, httpStatus: null, errorCode, errorMessage };
  }
}

function truncateToHour(timestampSecs: number): number {
  return Math.floor(timestampSecs / 3600) * 3600;
}

async function runPoll(): Promise<void> {
  const { db } = getDatabase();
  const allAgents = db.select().from(agents).where(sql`${agents.enabled} = 1`).all();

  if (allAgents.length === 0) return;

  // Process agents with concurrency limit
  const results: ({
    agentId: number;
    status: CheckStatus;
    responseMs: number;
    httpStatus: number | null;
    errorCode: string | null;
    errorMessage: string | null;
  } | null)[] = [];
  
  for (let i = 0; i < allAgents.length; i += MAX_CONCURRENT_CHECKS) {
    const batch = allAgents.slice(i, i + MAX_CONCURRENT_CHECKS);
    const batchResults = await Promise.all(
      batch.map(async (agent) => {
        try {
          return await checkAgent(agent as Agent);
        } catch (error) {
          console.error(`[daemon] Check failed for agent ${agent.id}:`, error);
          return null;
        }
      }),
    );
    results.push(...batchResults);
  }

  const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

  // Insert checks
  for (const result of validResults) {
    db.insert(checks).values({
      agentId: result.agentId,
      checkedAt: new Date(),
      status: result.status,
      responseMs: result.responseMs,
      httpStatus: result.httpStatus,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    }).run();

    // Upsert hourly stat
    const hourTimestamp = truncateToHour(Math.floor(Date.now() / 1000));
    const isOk = result.status === "ok" ? 1 : 0;
    const isOffline = result.status === "offline" ? 1 : 0;
    const isError = result.status === "error" ? 1 : 0;

    db.insert(stats).values({
      agentId: result.agentId,
      hourTimestamp,
      totalChecks: 1,
      okCount: isOk,
      offlineCount: isOffline,
      errorCount: isError,
      uptimePct: isOk ? 100 : 0,
      avgResponseMs: result.responseMs,
    }).onConflictDoUpdate({
      target: [stats.agentId, stats.hourTimestamp],
      set: {
        totalChecks: sql`${stats.totalChecks} + 1`,
        okCount: sql`${stats.okCount} + ${isOk}`,
        offlineCount: sql`${stats.offlineCount} + ${isOffline}`,
        errorCount: sql`${stats.errorCount} + ${isError}`,
        uptimePct: sql`ROUND(CAST((${stats.okCount} + ${isOk}) * 100.0 / (${stats.totalChecks} + 1) AS REAL), 2)`,
        avgResponseMs: sql`ROUND(CAST((${stats.avgResponseMs} * ${stats.totalChecks} + ${result.responseMs}) / (${stats.totalChecks} + 1) AS REAL), 2)`,
      },
    }).run();
  }

  console.log(`[daemon] Poll complete: ${validResults.length} checks recorded`);
}

let pollInterval: Timer | null = null;

export function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval);

  console.log(`[daemon] Starting polling every ${config.pollingIntervalMs}ms`);

  // Run immediately, then on interval
  runPoll().catch((err) => console.error("[daemon] Initial poll failed:", err));
  pollInterval = setInterval(() => {
    runPoll().catch((err) => console.error("[daemon] Poll failed:", err));
  }, config.pollingIntervalMs);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
