import type {
  Check,
  DaemonSyncResult,
  DaemonTestResult,
  HourlyStat,
  IncidentEvent,
} from "../../shared/types";
import { runInTransaction } from "../../shared/db-core";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { getDaemonSettings } from "../storage/sqlite/daemonSettingsRepo";
import { getDatabase } from "../storage/sqlite/db";
import { readAgents } from "./agentService";
import { logger } from "./loggerService";

const DAEMON_SYNC_KEY = "daemon_last_sync";

async function daemonFetch(
  url: string,
  secret: string,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });
  return response;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

/**
 * Check if the daemon is properly configured and enabled.
 * Returns false if disabled, missing URL, or missing secret.
 */
function isDaemonConfigured(): boolean {
  const s = getDaemonSettings();
  return s.enabled && !!s.url && !!s.secret;
}

export async function testDaemonConnection(): Promise<DaemonTestResult> {
  if (!isDaemonConfigured()) {
    return { connected: false, error: "Daemon not configured" };
  }

  const settings = getDaemonSettings();

  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      "/health",
    );
    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` };
    }
    const data = (await response.json()) as { version: string; uptime: number };
    return {
      connected: true,
      version: data.version,
      uptime: data.uptime,
      uptimeFormatted: formatUptime(data.uptime),
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function pushAgentsToDaemon(): Promise<void> {
  if (!isDaemonConfigured()) {
    return;
  }

  const settings = getDaemonSettings();

  try {
    const agents = await readAgents();
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      "/agents",
      {
        method: "PUT",
        body: JSON.stringify(agents),
      },
    );

    if (!response.ok) {
      logger.warn(
        "daemon",
        `Failed to push agents to daemon: HTTP ${response.status}`,
      );
      return;
    }

    const data = (await response.json()) as { updated: number };
    logger.info("daemon", `Pushed ${data.updated} agents to daemon`);
  } catch (error) {
    logger.warn("daemon", "Failed to push agents to daemon:", error);
  }
}

export async function sync(): Promise<DaemonSyncResult> {
  if (!isDaemonConfigured()) {
    return { checksImported: 0, statsImported: 0, incidentsImported: 0 };
  }

  const settings = getDaemonSettings();
  const lastSyncAt = parseInt(getMeta(DAEMON_SYNC_KEY) || "0", 10);
  let totalChecks = 0;
  let totalStats = 0;
  let totalIncidents = 0;

  // Import checks with pagination - serves as connectivity test too
  let cursor: number | null = lastSyncAt;
  let firstRequestFailed = false;
  while (cursor !== null) {
    const url = `/checks?since=${cursor}&limit=1000`;
    try {
      const response = await daemonFetch(settings.url, settings.secret, url);
      if (!response.ok) {
        if (cursor === lastSyncAt) {
          // First request failed - daemon is unreachable
          logger.warn("daemon", `Daemon unreachable: HTTP ${response.status}`);
          firstRequestFailed = true;
        } else {
          // Subsequent page failed - log but continue with what we have
          logger.warn(
            "daemon",
            `Failed to fetch checks: HTTP ${response.status}`,
          );
        }
        break;
      }

      const data = (await response.json()) as {
        checks: Check[];
        nextCursor: number | null;
      };
      if (data.checks.length > 0) {
        const { sqlite } = getDatabase();

        runInTransaction(sqlite, () => {
          for (const check of data.checks) {
            sqlite.run(
              `INSERT OR IGNORE INTO checks (agent_id, checked_at, status, response_ms, http_status, error_code, error_message)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                check.agentId,
                check.checkedAt,
                check.status,
                check.responseMs,
                check.httpStatus,
                check.errorCode,
                check.errorMessage,
              ],
            );
          }
          totalChecks += data.checks.length;
        });
      }

      cursor = data.nextCursor;
    } catch (error) {
      // Network error on first request means daemon is unreachable
      if (cursor === lastSyncAt) {
        logger.warn("daemon", "Daemon unreachable during sync:", error);
        firstRequestFailed = true;
      }
      break;
    }
  }

  // If daemon was unreachable, return zeros to signal caller to fall back
  if (firstRequestFailed) {
    return { checksImported: 0, statsImported: 0, incidentsImported: 0 };
  }

  // Import stats
  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      `/stats?since=${lastSyncAt}`,
    );
    if (response.ok) {
      const statsData = (await response.json()) as HourlyStat[];
      if (statsData.length > 0) {
        const { sqlite } = getDatabase();
        runInTransaction(sqlite, () => {
          for (const stat of statsData) {
            sqlite.run(
              `INSERT OR REPLACE INTO stats (agent_id, hour_timestamp, total_checks, ok_count, offline_count, error_count, uptime_pct, avg_response_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                stat.agentId,
                stat.hourTimestamp,
                stat.totalChecks,
                stat.okCount,
                stat.offlineCount,
                stat.errorCount,
                stat.uptimePct,
                stat.avgResponseMs,
              ],
            );
          }
          totalStats = statsData.length;
        });
      }
    }
  } catch (error) {
    logger.warn("daemon", "Failed to fetch stats:", error);
  }

  // Import incident events
  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      `/incident-events?since=${lastSyncAt}`,
    );
    if (response.ok) {
      const incidentsData = (await response.json()) as IncidentEvent[];
      if (incidentsData.length > 0) {
        const { sqlite } = getDatabase();
        runInTransaction(sqlite, () => {
          for (const event of incidentsData) {
            sqlite.run(
              `INSERT OR IGNORE INTO incident_events (agent_id, incident_id, event_at, event_type, from_status, to_status, reason)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                event.agentId,
                event.incidentId,
                event.eventAt,
                event.eventType,
                event.fromStatus,
                event.toStatus,
                event.reason,
              ],
            );
          }
          totalIncidents = incidentsData.length;
        });
      }
    }
  } catch (error) {
    logger.warn("daemon", "Failed to fetch incident events:", error);
  }

  // Update sync timestamp
  setMeta(DAEMON_SYNC_KEY, Date.now().toString());

  logger.info(
    "daemon",
    `Daemon sync complete: ${totalChecks} checks, ${totalStats} stats, ${totalIncidents} incidents imported`,
  );

  // Push canonical agent list to daemon
  await pushAgentsToDaemon();

  return {
    checksImported: totalChecks,
    statsImported: totalStats,
    incidentsImported: totalIncidents,
  };
}
