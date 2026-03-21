// Status Sync Service - Centralized status synchronization across windows and localStorage
import type { BrowserWindow } from "electrobun/bun";
import type { AgentStatus, AgentStatusInfo } from "../../shared/types";
import { mergeAgentsWithStatuses } from "../../shared/agent-helpers";
import {
  broadcastSyncAgents,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY_MS,
} from "./windowBroadcaster";
import { syncAgentsToCache } from "../../mainview/lib/utils/storage";
import { readAgents } from "../agentService";

type BroadcastTargets = {
  popoverWindow?: BrowserWindow | null;
  mainWindow?: BrowserWindow | null;
};

type SyncOptions = {
  /** Whether to update localStorage cache. Default: true */
  updateCache?: boolean;
  /** Whether to refresh native tray menu. Default: true */
  updateMenu?: boolean;
  /** Retry options for main window broadcast */
  retry?: {
    attempts?: number;
    delayMs?: number;
  };
};

/**
 * Centralized service for synchronizing agent statuses across:
 * - All open windows (main window, popover)
 * - localStorage cache for renderer persistence
 */
export class StatusSyncService {
  private agentStatusMap: Map<number, AgentStatusInfo> = new Map();
  private popoverWindow: BrowserWindow | null = null;
  private mainWindowGetter: () => BrowserWindow | null;
  private onMenuUpdate?: () => void;

  constructor(opts: {
    getMainWindow: () => BrowserWindow | null;
    onMenuUpdate?: () => void;
  }) {
    this.mainWindowGetter = opts.getMainWindow;
    this.onMenuUpdate = opts.onMenuUpdate;
  }

  /**
   * Set the popover window reference.
   */
  setPopoverWindow(window: BrowserWindow | null): void {
    this.popoverWindow = window;
  }

  /**
   * Update the internal status map with new statuses.
   */
  updateStatusMap(statuses: AgentStatusInfo[]): void {
    for (const status of statuses) {
      this.agentStatusMap.set(status.id, status);
    }
  }

  /**
   * Set a single agent's status in the map.
   */
  setAgentStatus(status: AgentStatusInfo): void {
    this.agentStatusMap.set(status.id, status);
  }

  /**
   * Mark an agent as offline without making an HTTP request.
   */
  markAgentOffline(id: number): void {
    this.agentStatusMap.set(id, {
      id,
      status: "offline",
      lastChecked: Date.now(),
      errorMessage: undefined,
    });
  }

  /**
   * Get current status for an agent, or null if not found.
   */
  getAgentStatus(id: number): AgentStatusInfo | undefined {
    return this.agentStatusMap.get(id);
  }

  /**
   * Sync agents to all windows and optionally update cache and menu.
   * This is the main synchronization method used by most callers.
   */
  async sync(options: SyncOptions = {}): Promise<void> {
    const {
      updateCache = true,
      updateMenu = true,
      retry = {},
    } = options;

    const agents = await readAgents();
    const merged = mergeAgentsWithStatuses(
      agents,
      Array.from(this.agentStatusMap.values()),
    );

    // Broadcast to windows
    await broadcastSyncAgents(merged, this.getTargets(), {
      mainWindowRetryAttempts: retry.attempts ?? DEFAULT_RETRY_ATTEMPTS,
      mainWindowRetryDelayMs: retry.delayMs ?? DEFAULT_RETRY_DELAY_MS,
    });

    // Update localStorage cache
    if (updateCache) {
      syncAgentsToCache(merged);
    }

    // Refresh native tray menu
    if (updateMenu && this.onMenuUpdate) {
      this.onMenuUpdate();
    }
  }

  /**
   * Push current known statuses to all windows immediately.
   * Uses retry for main window but skips if target missing.
   */
  async pushKnownStatuses(options?: { retry?: { attempts?: number; delayMs?: number } }): Promise<void> {
    const agents = await readAgents();
    const merged = mergeAgentsWithStatuses(
      agents,
      Array.from(this.agentStatusMap.values()),
    );

    await broadcastSyncAgents(merged, this.getTargets(), {
      mainWindowRetryAttempts: options?.retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS,
      mainWindowRetryDelayMs: options?.retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS,
    });
  }

  /**
   * Push a single status update to all windows immediately.
   * Used after toggling enabled state so UI updates without polling.
   */
  async pushOneStatus(status: AgentStatusInfo): Promise<void> {
    this.agentStatusMap.set(status.id, status);
    await this.sync({
      retry: {
        attempts: DEFAULT_RETRY_ATTEMPTS,
        delayMs: DEFAULT_RETRY_DELAY_MS,
      },
    });
  }

  /**
   * Get the broadcast targets for window communication.
   */
  private getTargets(): BroadcastTargets {
    return {
      popoverWindow: this.popoverWindow,
      mainWindow: this.mainWindowGetter(),
    };
  }

  /**
   * Get all agents merged with their current statuses.
   */
  async getMergedAgents(): Promise<AgentStatus[]> {
    const agents = await readAgents();
    return mergeAgentsWithStatuses(
      agents,
      Array.from(this.agentStatusMap.values()),
    );
  }
}

// Module-level singleton for backward compatibility
let instance: StatusSyncService | null = null;

export function getStatusSyncService(): StatusSyncService {
  if (!instance) {
    throw new Error("StatusSyncService not initialized. Call initStatusSyncService() first.");
  }
  return instance;
}

export function initStatusSyncService(opts: {
  getMainWindow: () => BrowserWindow | null;
  onMenuUpdate?: () => void;
}): StatusSyncService {
  instance = new StatusSyncService(opts);
  return instance;
}
