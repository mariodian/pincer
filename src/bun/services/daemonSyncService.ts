import { createHash } from "node:crypto";

import type {
  Agent,
  DaemonSyncResult,
  DaemonTestResult,
} from "../../shared/types";
import { readAgents, writeAgents } from "../storage/sqlite/agentsRepo";
import { getMeta, setMeta } from "../storage/sqlite/appMetaRepo";
import {
  deleteAllChecks,
  insertChecksBatch,
} from "../storage/sqlite/checksRepo";
import { getDaemonSettings } from "../storage/sqlite/daemonSettingsRepo";
import {
  deleteAllEvents,
  insertEventsBatch,
} from "../storage/sqlite/incidentEventsRepo";
import { deleteAllStats, upsertStatsBatch } from "../storage/sqlite/statsRepo";
import { getChannel } from "../utils/channel";
import { DaemonClient, type AgentPushPayload } from "./daemonClient";
import { logger } from "./loggerService";
import { getMachineId } from "./machineIdService";

const DAEMON_SYNC_KEY = "daemon_last_sync";
const DAEMON_SYNC_STATS_KEY = "daemon_last_sync_stats";
const DAEMON_LAST_NAMESPACE_KEY = "daemon_last_namespace_id";

let onSyncStart: (() => void) | null = null;
let onSyncComplete: ((result: DaemonSyncResult) => void) | null = null;

export function setOnSyncStart(cb: () => void): void {
  onSyncStart = cb;
}

export function setOnSyncComplete(
  cb: (result: DaemonSyncResult) => void,
): void {
  onSyncComplete = cb;
}

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
  const base = settings.namespaceKey || (await getMachineId());
  const channel = await getChannel();
  return `${base}:${channel}`;
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

async function migrateNamespaceIfNeeded(
  currentNamespaceId: string,
  settings: ReturnType<typeof getDaemonSettings>,
  machineId: string,
  deps: {
    getMeta: typeof getMeta;
    setMeta: typeof setMeta;
  } = { getMeta, setMeta },
): Promise<void> {
  const lastNamespaceId = deps.getMeta(DAEMON_LAST_NAMESPACE_KEY);

  if (lastNamespaceId === currentNamespaceId) {
    return;
  }

  let fromNamespace: string | null = lastNamespaceId;

  if (!fromNamespace) {
    const legacyNamespace = settings.namespaceKey || machineId;

    const probeClient = new DaemonClient(
      settings.url,
      settings.secret,
      legacyNamespace,
      machineId,
    );

    try {
      const legacyAgents = await probeClient.fetchAgents();
      if (legacyAgents.length > 0) {
        fromNamespace = legacyNamespace;
      }
    } catch {
      logger.warn("daemon", "Could not probe for legacy namespace");
    }
  }

  if (!fromNamespace) {
    deps.setMeta(DAEMON_LAST_NAMESPACE_KEY, currentNamespaceId);
    return;
  }

  logger.info(
    "daemon",
    `Namespace changed from ${fromNamespace} to ${currentNamespaceId}, migrating...`,
  );

  const oldClient = new DaemonClient(
    settings.url,
    settings.secret,
    fromNamespace,
    machineId,
  );

  try {
    const result = await oldClient.migrateNamespace(currentNamespaceId);
    logger.info(
      "daemon",
      `Migrated ${result.agents} agents, ${result.checks} checks, ${result.stats} stats, ${result.incidents} incidents`,
    );
    deps.setMeta(DAEMON_LAST_NAMESPACE_KEY, currentNamespaceId);
  } catch (error) {
    logger.warn("daemon", "Namespace migration failed:", error);
  }
}

export async function pushAgentsToDaemonWith(
  settings: ReturnType<typeof getDaemonSettings>,
  agents: Agent[],
  machineId: string,
  deps: {
    getMeta: typeof getMeta;
    setMeta: typeof setMeta;
  } = { getMeta, setMeta },
): Promise<void> {
  if (!settings.enabled || !settings.url || !settings.secret) return;

  const base = settings.namespaceKey || machineId;
  const channel = await getChannel();
  const namespaceId = `${base}:${channel}`;

  await migrateNamespaceIfNeeded(namespaceId, settings, machineId, deps);

  if (agents.length === 0) {
    logger.debug("daemon", "No local agents to push to daemon");
    return;
  }

  const client = new DaemonClient(
    settings.url,
    settings.secret,
    namespaceId,
    machineId,
  );

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

    const localIds = new Set(agents.map((a) => a.id));
    const daemonAgents = await client.fetchAgents();
    const orphanIds = daemonAgents
      .map((da) => da.id)
      .filter((id) => !localIds.has(id));

    let deletedCount = 0;
    for (const orphanId of orphanIds) {
      try {
        await client.deleteAgent(orphanId);
        deletedCount++;
      } catch (error) {
        logger.warn(
          "daemon",
          `Failed to delete orphan agent ${orphanId} from daemon:`,
          error,
        );
      }
    }

    if (deletedCount > 0) {
      logger.info(
        "daemon",
        `Reconciled: deleted ${deletedCount} orphan agent(s) from daemon`,
      );
    }
  } catch (error) {
    logger.warn("daemon", "Failed to push agents to daemon:", error);
  }
}

// Existing function becomes a thin wrapper — no logic change
export async function pushAgentsToDaemon(): Promise<void> {
  if (!isDaemonConfigured()) return;
  const [agents, settings, machineId] = await Promise.all([
    readAgents(),
    Promise.resolve(getDaemonSettings()),
    getMachineId(),
  ]);
  return pushAgentsToDaemonWith(settings, agents, machineId);
}

export async function deleteAgentFromDaemon(agentId: number): Promise<void> {
  if (!isDaemonConfigured()) {
    return;
  }

  const client = await createDaemonClient();

  try {
    const result = await client.deleteAgent(agentId);
    logger.info(
      "daemon",
      `Deleted agent ${agentId} from daemon: ${result.deleted}`,
    );
  } catch (error) {
    logger.warn(
      "daemon",
      `Failed to delete agent ${agentId} from daemon:`,
      error,
    );
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
  const syncStartMs = Date.now();
  const lastSyncAt = parseInt(getMeta(DAEMON_SYNC_KEY) || "0", 10);
  const lastSyncStatsAt = parseInt(getMeta(DAEMON_SYNC_STATS_KEY) || "0", 10);

  // Checks and incidents are append-only: use precise sync time to avoid re-fetching
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

  // Stats are upserted in-place: use hour boundary to catch current-hour updates
  const [stats, incidents, openIncidents] = await Promise.all([
    importStats(client, lastSyncStatsAt),
    importIncidentEvents(client, lastSyncAt),
    fetchOpenIncidents(client),
  ]);

  const hourBoundaryMs = Math.floor(syncStartMs / 3600000) * 3600000;
  setMeta(DAEMON_SYNC_KEY, syncStartMs.toString());
  setMeta(DAEMON_SYNC_STATS_KEY, hourBoundaryMs.toString());

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

/**
 * Force sync from daemon: discard all local checks, incidents, and stats,
 * reset sync cursors, and re-download everything from daemon for the current namespace.
 * Agents are preserved (not deleted).
 *
 * This function is non-blocking: it clears data and fires the sync in the background,
 * then returns immediately. The actual sync result is delivered via the onSyncComplete callback.
 */
export async function forceSync(): Promise<{ success: boolean }> {
  if (!isDaemonConfigured()) {
    return { success: false };
  }

  onSyncStart?.();

  logger.info("daemon", "Force sync: discarding local data...");

  const checksDeleted = deleteAllChecks();
  const eventsDeleted = deleteAllEvents();
  const statsDeleted = deleteAllStats();

  logger.info(
    "daemon",
    `Force sync: deleted ${checksDeleted} checks, ${eventsDeleted} events, ${statsDeleted} stats`,
  );

  setMeta(DAEMON_SYNC_KEY, "0");
  setMeta(DAEMON_SYNC_STATS_KEY, "0");

  logger.info("daemon", "Force sync: re-downloading all data from daemon...");

  void sync().then((result) => {
    onSyncComplete?.(result);
  });

  return { success: true };
}
