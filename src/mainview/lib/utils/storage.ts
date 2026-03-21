import { KEY_AGENTS, KEY_STATUSES } from "../../../bun/config";
import { mergeAgentsWithStatuses } from "../../../shared/agent-helpers";
import type {
  Agent,
  AgentStatus,
  AgentStatusInfo,
} from "../../../shared/types";

/** Returns the storage key with a "_dev" suffix in development. */
export function getStorageKey(baseKey: string): string {
  const suffix =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "_dev"
      : "";
  return `${baseKey}${suffix}`;
}

const STORAGE_KEY_AGENTS = getStorageKey(KEY_AGENTS);
const STORAGE_KEY_STATUSES = getStorageKey(KEY_STATUSES);

/** Log storage operations at warn level for easier debugging. */
function warnStorage(context: string, error: unknown): void {
  console.warn(`[storage] ${context}:`, error instanceof Error ? error.message : error);
}

/**
 * Read merged agent+status data from localStorage.
 * Returns null if cache is empty or unavailable.
 */
export function readCachedAgents(): AgentStatus[] | null {
  try {
    const storedAgents = localStorage.getItem(STORAGE_KEY_AGENTS);
    const storedStatuses = localStorage.getItem(STORAGE_KEY_STATUSES);
    if (!storedAgents || !storedStatuses) return null;

    const agentList: Agent[] = JSON.parse(storedAgents);
    const statusList: AgentStatusInfo[] = JSON.parse(storedStatuses);
    return mergeAgentsWithStatuses(agentList, statusList);
  } catch (e) {
    warnStorage("readCachedAgents failed", e);
    return null;
  }
}

/**
 * Write merged agent+status data to localStorage (split into both keys).
 * Called by the syncAgents handler in both windows.
 */
export function syncAgentsToCache(data: AgentStatus[]): void {
  syncAgentsToCacheWithOptions(data, { notifyListeners: true });
}

/**
 * Same as syncAgentsToCache but allows suppressing cache listeners for no-op updates.
 */
export function syncAgentsToCacheWithOptions(
  data: AgentStatus[],
  options?: { notifyListeners?: boolean },
): void {
  try {
    const agents: Agent[] = data.map(
      ({ status, lastChecked, errorMessage, ...agent }) => agent,
    );
    const statuses: AgentStatusInfo[] = data.map(
      ({ id, status, lastChecked, errorMessage }) => ({
        id,
        status,
        lastChecked,
        errorMessage,
      }),
    );
    localStorage.setItem(STORAGE_KEY_AGENTS, JSON.stringify(agents));
    localStorage.setItem(STORAGE_KEY_STATUSES, JSON.stringify(statuses));
    if (options?.notifyListeners !== false) {
      notifyCacheListeners();
    }
  } catch (e) {
    warnStorage("syncAgentsToCache failed", e);
  }
}

/** Remove a single agent from both localStorage keys. */
export function removeCachedAgent(id: number): void {
  try {
    const agentsRaw = localStorage.getItem(STORAGE_KEY_AGENTS);
    const statusesRaw = localStorage.getItem(STORAGE_KEY_STATUSES);

    if (agentsRaw) {
      const agents: Agent[] = JSON.parse(agentsRaw);
      localStorage.setItem(
        STORAGE_KEY_AGENTS,
        JSON.stringify(agents.filter((a) => a.id !== id)),
      );
    }

    if (statusesRaw) {
      const statuses: AgentStatusInfo[] = JSON.parse(statusesRaw);
      localStorage.setItem(
        STORAGE_KEY_STATUSES,
        JSON.stringify(statuses.filter((s) => s.id !== id)),
      );
    }

    notifyCacheListeners();
  } catch (e) {
    warnStorage("removeCachedAgent failed", e);
  }
}

// ── Cache change subscription ──────────────────────────────────────────

type CacheListener = () => void;
const cacheListeners = new Set<CacheListener>();

/** Subscribe to cache changes (same-tab notifications). */
export function onAgentCacheChange(callback: CacheListener): void {
  cacheListeners.add(callback);
}

/** Unsubscribe from cache changes. */
export function offAgentCacheChange(callback: CacheListener): void {
  cacheListeners.delete(callback);
}

function notifyCacheListeners(): void {
  cacheListeners.forEach((cb) => cb());
}
