import { logger } from "../src/shared/logger";
import type { Agent, CheckStatus } from "../src/shared/types";
import { sql } from "drizzle-orm";
import { getAgentType } from "./agentTypes";
import { config } from "./config";
import { getDatabase } from "./db";
import { agents, checks, stats } from "./schema";
import { recordCheck as recordIncidentCheck } from "./incidents";
import {
  resolveHealthConfig,
  executeHealthCheck,
} from "../src/shared/agentHealthCheck";

const MAX_CONCURRENT_CHECKS = 10;

function truncateToHour(timestampSecs: number): number {
  return Math.floor(timestampSecs / 3600) * 3600;
}

async function runPoll(): Promise<void> {
  const { db } = getDatabase();
  const allAgents = db
    .select()
    .from(agents)
    .where(sql`${agents.enabled} = 1`)
    .all();

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
          return await executeHealthCheck(agent as Agent);
        } catch (error) {
          logger.error("poll", `Check failed for agent ${agent.id}`, error);
          return null;
        }
      }),
    );
    results.push(...batchResults);
  }

  const validResults = results.filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  // Insert checks and detect incidents
  for (const result of validResults) {
    db.insert(checks)
      .values({
        agentId: result.agentId,
        checkedAt: new Date(),
        status: result.status,
        responseMs: result.responseMs,
        httpStatus: result.httpStatus,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })
      .run();

    // Detect incidents
    recordIncidentCheck(result.agentId, result.status);

    // Upsert hourly stat
    const hourTimestamp = truncateToHour(Math.floor(Date.now() / 1000));
    const isOk = result.status === "ok" ? 1 : 0;
    const isOffline = result.status === "offline" ? 1 : 0;
    const isError = result.status === "error" ? 1 : 0;

    db.insert(stats)
      .values({
        agentId: result.agentId,
        hourTimestamp,
        totalChecks: 1,
        okCount: isOk,
        offlineCount: isOffline,
        errorCount: isError,
        uptimePct: isOk ? 100 : 0,
        avgResponseMs: result.responseMs,
      })
      .onConflictDoUpdate({
        target: [stats.agentId, stats.hourTimestamp],
        set: {
          totalChecks: sql`${stats.totalChecks} + 1`,
          okCount: sql`${stats.okCount} + ${isOk}`,
          offlineCount: sql`${stats.offlineCount} + ${isOffline}`,
          errorCount: sql`${stats.errorCount} + ${isError}`,
          uptimePct: sql`ROUND(CAST((${stats.okCount} + ${isOk}) * 100.0 / (${stats.totalChecks} + 1) AS REAL), 2)`,
          avgResponseMs: sql`ROUND(CAST((${stats.avgResponseMs} * ${stats.totalChecks} + ${result.responseMs}) / (${stats.totalChecks} + 1) AS REAL), 2)`,
        },
      })
      .run();
  }

  logger.info("poll", `Poll complete: ${validResults.length} checks recorded`);
}

let pollInterval: Timer | null = null;

export function startPolling(): void {
  if (pollInterval) clearInterval(pollInterval);

  logger.info("poll", `Starting polling every ${config.pollingIntervalMs}ms`);

  // Run immediately, then on interval
  runPoll().catch((err) => logger.error("poll", "Initial poll failed", err));
  pollInterval = setInterval(() => {
    runPoll().catch((err) => logger.error("poll", "Poll failed", err));
  }, config.pollingIntervalMs);
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
