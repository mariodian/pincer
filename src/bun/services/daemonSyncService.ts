import type { DaemonSyncResult, DaemonTestResult } from "../../shared/types";
import { DaemonClient } from "./daemonClient";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { getDaemonSettings } from "../storage/sqlite/daemonSettingsRepo";
import { insertChecksBatch } from "../storage/sqlite/checksRepo";
import { insertEventsBatch } from "../storage/sqlite/incidentEventsRepo";
import { upsertStatsBatch } from "../storage/sqlite/statsRepo";
import { readAgents } from "./agentService";
import { logger } from "./loggerService";

const DAEMON_SYNC_KEY = "daemon_last_sync";

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
  const client = new DaemonClient(settings.url, settings.secret);

  try {
    const response = await client.testConnection();
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
  const client = new DaemonClient(settings.url, settings.secret);

  try {
    const agents = await readAgents();
    const data = await client.pushAgents(agents);
    logger.info("daemon", `Pushed ${data.updated} agents to daemon`);
  } catch (error) {
    logger.warn("daemon", "Failed to push agents to daemon:", error);
  }
}

/**
 * Generic daemon fetch + processor with error handling.
 * Returns the processor result, or 0 on error.
 */
async function importFromDaemon<T>(
  client: DaemonClient,
  fetcher: (client: DaemonClient) => Promise<T[]>,
  processor: (data: T[]) => number,
  label: string,
): Promise<number> {
  try {
    const data = await fetcher(client);
    return data.length > 0 ? processor(data) : 0;
  } catch (error) {
    logger.warn("daemon", `Failed to fetch ${label}:`, error);
    return 0;
  }
}

/**
 * Import checks from daemon with pagination.
 * Returns the number of checks imported and whether the daemon was reachable.
 */
async function importChecks(
  client: DaemonClient,
  lastSyncAt: number,
): Promise<{ imported: number; reachable: boolean }> {
  let cursor: number | null = lastSyncAt;
  let total = 0;

  while (cursor !== null) {
    try {
      const page = await client.fetchChecks(cursor);
      if (page.data.length > 0) {
        total += insertChecksBatch(page.data);
      }
      cursor = page.nextCursor;
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
  client: DaemonClient,
  lastSyncAt: number,
): Promise<number> {
  return importFromDaemon(
    client,
    (c) => c.fetchStats(lastSyncAt),
    upsertStatsBatch,
    "stats",
  );
}

/**
 * Import incident events from daemon.
 * Returns the number of events imported.
 */
async function importIncidentEvents(
  client: DaemonClient,
  lastSyncAt: number,
): Promise<number> {
  return importFromDaemon(
    client,
    (c) => c.fetchIncidentEvents(lastSyncAt),
    insertEventsBatch,
    "incident events",
  );
}

/**
 * Fetch open incidents from daemon for linking.
 */
async function fetchOpenIncidents(
  client: DaemonClient,
): Promise<Array<{ agentId: number; incidentId: string }>> {
  try {
    return await client.fetchOpenIncidents();
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
  const client = new DaemonClient(settings.url, settings.secret);
  const lastSyncAt = parseInt(getMeta(DAEMON_SYNC_KEY) || "0", 10);

  const checks = await importChecks(client, lastSyncAt);
  if (!checks.reachable) {
    throw new Error("Daemon unreachable");
  }

  const [stats, incidents, openIncidents] = await Promise.all([
    importStats(client, lastSyncAt),
    importIncidentEvents(client, lastSyncAt),
    fetchOpenIncidents(client),
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
