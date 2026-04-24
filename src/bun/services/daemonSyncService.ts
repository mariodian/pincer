import type {
  Check,
  DaemonSettings,
  DaemonSyncResult,
  DaemonTestResult,
  HourlyStat,
  IncidentEvent,
} from "../../shared/types";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { getDaemonSettings } from "../storage/sqlite/daemonSettingsRepo";
import { insertChecksBatch } from "../storage/sqlite/checksRepo";
import { insertEventsBatch } from "../storage/sqlite/incidentEventsRepo";
import { upsertStatsBatch } from "../storage/sqlite/statsRepo";
import { readAgents } from "./agentService";
import { logger } from "./loggerService";

const DAEMON_SYNC_KEY = "daemon_last_sync";

async function daemonFetch(
  url: string,
  secret: string,
  path: string,
  options?: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = options?.timeout ?? 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Daemon request timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
export function isDaemonConfigured(): boolean {
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

/**
 * Import checks from daemon with pagination.
 * Returns the number of checks imported and whether the daemon was reachable.
 */
async function importChecks(
  settings: DaemonSettings,
  lastSyncAt: number,
): Promise<{ imported: number; reachable: boolean }> {
  let cursor: number | null = lastSyncAt;
  let total = 0;

  while (cursor !== null) {
    try {
      const response = await daemonFetch(
        settings.url,
        settings.secret,
        `/checks?since=${cursor}&limit=1000`,
      );
      if (!response.ok) {
        if (cursor === lastSyncAt) {
          logger.warn("daemon", `Daemon unreachable: HTTP ${response.status}`);
          return { imported: 0, reachable: false };
        }
        logger.warn(
          "daemon",
          `Failed to fetch checks page: HTTP ${response.status}`,
        );
        break;
      }

      const data = (await response.json()) as {
        checks: Check[];
        nextCursor: number | null;
      };
      if (data.checks.length > 0) {
        total += insertChecksBatch(data.checks);
      }
      cursor = data.nextCursor;
    } catch (error) {
      if (cursor === lastSyncAt) {
        logger.warn("daemon", "Daemon unreachable during sync:", error);
        return { imported: 0, reachable: false };
      }
      logger.warn("daemon", "Failed to fetch checks page:", error);
      break;
    }
  }

  return { imported: total, reachable: true };
}

/**
 * Import hourly stats from daemon.
 * Returns the number of stats imported.
 */
async function importStats(
  settings: DaemonSettings,
  lastSyncAt: number,
): Promise<number> {
  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      `/stats?since=${lastSyncAt}`,
    );
    if (!response.ok) {
      logger.warn("daemon", `Failed to fetch stats: HTTP ${response.status}`);
      return 0;
    }
    const statsData = (await response.json()) as HourlyStat[];
    if (statsData.length > 0) {
      return upsertStatsBatch(statsData);
    }
  } catch (error) {
    logger.warn("daemon", "Failed to fetch stats:", error);
  }
  return 0;
}

/**
 * Import incident events from daemon.
 * Returns the number of events imported.
 */
async function importIncidentEvents(
  settings: DaemonSettings,
  lastSyncAt: number,
): Promise<number> {
  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      `/incident-events?since=${lastSyncAt}`,
    );
    if (!response.ok) {
      logger.warn(
        "daemon",
        `Failed to fetch incident events: HTTP ${response.status}`,
      );
      return 0;
    }
    const incidentsData = (await response.json()) as IncidentEvent[];
    if (incidentsData.length > 0) {
      return insertEventsBatch(incidentsData);
    }
  } catch (error) {
    logger.warn("daemon", "Failed to fetch incident events:", error);
  }
  return 0;
}

/**
 * Fetch open incidents from daemon for linking.
 */
async function fetchOpenIncidents(
  settings: DaemonSettings,
): Promise<Array<{ agentId: number; incidentId: string }>> {
  try {
    const response = await daemonFetch(
      settings.url,
      settings.secret,
      "/open-incidents",
    );
    if (!response.ok) {
      logger.warn(
        "daemon",
        `Failed to fetch open incidents: HTTP ${response.status}`,
      );
      return [];
    }
    return (await response.json()) as Array<{
      agentId: number;
      incidentId: string;
    }>;
  } catch (error) {
    logger.warn("daemon", "Failed to fetch open incidents:", error);
    return [];
  }
}

export async function sync(): Promise<DaemonSyncResult> {
  if (!isDaemonConfigured()) {
    return {
      checksImported: 0,
      statsImported: 0,
      incidentsImported: 0,
      openIncidents: [],
    };
  }

  const settings = getDaemonSettings();
  const lastSyncAt = parseInt(getMeta(DAEMON_SYNC_KEY) || "0", 10);

  const checks = await importChecks(settings, lastSyncAt);
  if (!checks.reachable) {
    throw new Error("Daemon unreachable");
  }

  const [stats, incidents, openIncidents] = await Promise.all([
    importStats(settings, lastSyncAt),
    importIncidentEvents(settings, lastSyncAt),
    fetchOpenIncidents(settings),
  ]);

  setMeta(DAEMON_SYNC_KEY, Date.now().toString());

  logger.info(
    "daemon",
    `Daemon sync complete: ${checks.imported} checks, ${stats} stats, ${incidents} incidents imported`,
  );

  await pushAgentsToDaemon();

  return {
    checksImported: checks.imported,
    statsImported: stats,
    incidentsImported: incidents,
    openIncidents,
  };
}
