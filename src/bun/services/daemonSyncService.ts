import { createHash } from "node:crypto";

import type {
  Agent,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import { insertChecksBatch } from "../storage/sqlite/checksRepo";
import { getDaemonSettings } from "../storage/sqlite/daemonSettingsRepo";
import { insertEventsBatch } from "../storage/sqlite/incidentEventsRepo";
import { upsertStatsBatch } from "../storage/sqlite/statsRepo";
import { readAgents, writeAgents } from "./agentService";
import { DaemonClient, type AgentPushPayload } from "./daemonClient";
import { logger } from "./loggerService";
import { getMachineId } from "./machineIdService";

const DAEMON_SYNC_KEY = "daemon_last_sync";

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

async function getNamespaceId(): Promise<string> {
  const settings = getDaemonSettings();
  return settings.namespaceKey || (await getMachineId());
}

export function computeAgentHash(agent: Agent): string {
  return createHash("sha256")
    .update(`${agent.type}:${agent.url}:${agent.port}`)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Check if the daemon is properly configured and enabled.
 * Returns false if disabled, missing URL, or missing secret.
 */
export function isDaemonConfigured(): boolean {
  const s = getDaemonSettings();
  return s.enabled && !!s.url && !!s.secret;
}

async function createDaemonClient(): Promise<DaemonClient> {
  const settings = getDaemonSettings();
  const [namespaceId, machineId] = await Promise.all([
    getNamespaceId(),
    getMachineId(),
  ]);
  return new DaemonClient(
    settings.url,
    settings.secret,
    namespaceId,
    machineId,
  );
}

export async function testDaemonConnection(): Promise<DaemonTestResult> {
  if (!isDaemonConfigured()) {
    return { connected: false, error: "Daemon not configured" };
  }

  const client = await createDaemonClient();

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

  const agents = await readAgents();
  if (agents.length === 0) {
    logger.debug("daemon", "No local agents to push to daemon");
    return;
  }

  const client = await createDaemonClient();

  try {
    const payload: AgentPushPayload[] = agents.map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      url: a.url,
      port: a.port,
      enabled: a.enabled ?? true,
      healthEndpoint: a.healthEndpoint ?? null,
      statusShape: a.statusShape ?? null,
      agentHash: computeAgentHash(a),
    }));
    const data = await client.pushAgents(payload);
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
    logger.debug("daemon", `Fetched ${data.length} ${label} from daemon`);
    return data.length > 0 ? processor(data) : 0;
  } catch (error) {
    logger.warn("daemon", `Failed to fetch ${label}:`, error);
    return 0;
  }
}

/**
 * Import checks from daemon with pagination.
 * Uses ID-based cursor to avoid infinite loops when multiple checks share timestamps.
 * Returns the number of checks imported and whether the daemon was reachable.
 */
async function importChecks(
  client: DaemonClient,
  lastSyncAt: number,
): Promise<{ imported: number; reachable: boolean }> {
  const since = lastSyncAt;
  let cursor = 0;
  let total = 0;

  while (true) {
    try {
      const page = await client.fetchChecks(since, cursor);
      if (page.data.length > 0) {
        total += insertChecksBatch(page.data);
      }
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    } catch (error) {
      if (cursor === 0) {
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

/**
 * Unify agent sync direction: push if local agents exist, pull from daemon if not.
 */
export async function syncAgents(): Promise<number> {
  if (!isDaemonConfigured()) {
    return 0;
  }

  const agents = await readAgents();
  if (agents.length > 0) {
    await pushAgentsToDaemon();
    return 0;
  }

  return pullAgentsFromDaemon();
}

export async function pullAgentsFromDaemon(): Promise<number> {
  if (!isDaemonConfigured()) {
    return 0;
  }

  const agents = await readAgents();
  if (agents.length > 0) {
    return 0;
  }

  const client = await createDaemonClient();

  try {
    const fetchedAgents = await client.fetchAgents();
    if (fetchedAgents.length === 0) {
      return 0;
    }

    await writeAgents(
      fetchedAgents.map((a) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        url: a.url,
        port: a.port,
        enabled: a.enabled,
        healthEndpoint: a.healthEndpoint ?? undefined,
        statusShape: a.statusShape ?? undefined,
      })),
    );

    logger.info("daemon", `Pulled ${fetchedAgents.length} agents from daemon`);
    return fetchedAgents.length;
  } catch (error) {
    logger.warn("daemon", "Failed to pull agents from daemon:", error);
    return 0;
  }
}

/**
 * Sync checks, stats, and incidents from daemon without touching agents.
 * Used by the poll loop to continuously sync data while daemon is connected.
 */
export async function syncDataOnly(): Promise<DaemonSyncResult> {
  if (!isDaemonConfigured()) {
    return {
      success: true,
      checksImported: 0,
      statsImported: 0,
      incidentsImported: 0,
      agentsImported: 0,
      openIncidents: [],
    };
  }

  const client = await createDaemonClient();
  const lastSyncAt = parseInt(getMeta(DAEMON_SYNC_KEY) || "0", 10);

  const checks = await importChecks(client, lastSyncAt);
  if (!checks.reachable) {
    return {
      success: false,
      error: "Daemon unreachable",
      checksImported: 0,
      statsImported: 0,
      incidentsImported: 0,
      agentsImported: 0,
      openIncidents: [],
    };
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

  return {
    success: true,
    checksImported: checks.imported,
    statsImported: stats,
    incidentsImported: incidents,
    agentsImported: 0,
    openIncidents,
  };
}

export async function sync(): Promise<DaemonSyncResult> {
  const agentsImported = await syncAgents();

  if (agentsImported > 0) {
    // Agents were pulled from daemon, sync from the beginning
    // to capture all historical checks/incidents with their original timestamps
    setMeta(DAEMON_SYNC_KEY, "0");
  }

  return syncDataOnly();
}
