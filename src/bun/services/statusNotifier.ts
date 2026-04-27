// Status Notifier - Handles status change detection and notifications
import { Utils } from "electrobun/bun";

import type { AgentStatusInfo } from "../../shared/types";
import { getNotificationSettings } from "../storage/sqlite/settingsNotificationsRepo";
import { readAgents } from "./agentService";
import { logger } from "./loggerService";

export interface StatusChangeBatch {
  agentId: number;
  agentName: string;
  newStatus: string;
}

/**
 * Build notification title and body for a group of status changes.
 */
export function buildNotificationMessage(
  status: string,
  changes: StatusChangeBatch[],
): { title: string; body: string } {
  const count = changes.length;
  const isSingle = count === 1;
  const statusWord = status.charAt(0).toUpperCase() + status.slice(1);

  if (isSingle) {
    return {
      title: `Agent ${statusWord}`,
      body:
        status !== "error"
          ? `${changes[0].agentName} is now ${status}`
          : `${changes[0].agentName} encountered error`,
    };
  }

  return {
    title: `Agents ${statusWord}`,
    body:
      status !== "error"
        ? `${count} agents are now ${status}`
        : `${count} agents encountered error`,
  };
}

interface PendingAgent {
  currentStatus: string;
  pollsInNewState: number;
  originalBaseline: string;
}

export class StatusNotifier {
  private readonly FIRST_POLL_MARKER = "__FIRST_POLL__";
  private readonly STATUS_VALUES: string[] = ["ok", "offline", "error"];

  /**
   * agentBaseline tracks each agent's status at the PREVIOUS poll.
   * This allows us to detect status changes between polls.
   * Example: If Poll 1 = offline and Poll 2 = error, the baseline
   * at Poll 2 is "offline" and current is "error", so we know
   * the agent deviated from baseline.
   */
  private agentBaseline: Map<number, string> = new Map();

  /**
   * pendingAgents tracks agents that have deviated from their baseline.
   * Key: agent ID
   * Value: { currentStatus, pollsInNewState, originalBaseline }
   *   - currentStatus: the non-baseline status (ok, offline, error)
   *   - pollsInNewState: how many consecutive polls at currentStatus
   *   - originalBaseline: the status BEFORE the first deviation (used to detect true return)
   * Example: After 3 polls at "error", pollsInNewState = 3, originalBaseline = "ok"
   */
  private pendingAgents: Map<number, PendingAgent> = new Map();

  /**
   * statusGroups groups pending agents by their current non-baseline status.
   * When any agent in a group reaches threshold, ALL agents in that group fire.
   * Example: If A1(error@3 polls) and A3(error@1 poll) are both in error group,
   * when A1 reaches threshold (3), both A1 and A3 fire together.
   */
  private statusGroups: Map<string, Set<number>> = new Map(
    this.STATUS_VALUES.map((s) => [s, new Set<number>()]),
  );

  /**
   * Remove an agent from all status tracking structures.
   * Call this when an agent is deleted to prevent memory leaks.
   */
  removeAgent(agentId: number): void {
    // Remove from baseline tracking
    this.agentBaseline.delete(agentId);

    // Remove from pending agents tracking
    const pending = this.pendingAgents.get(agentId);
    if (pending) {
      this.pendingAgents.delete(agentId);
      // Also remove from status groups
      for (const group of this.statusGroups.values()) {
        group.delete(agentId);
      }
    }

    logger.debug("status", `[Agent ${agentId}] Removed from status tracking`);
  }

  /**
   * checkAndNotify - Main notification logic
   *
   * ALGORITHM:
   * 1. First poll for an agent: set baseline = current status, no notification
   * 2. Subsequent polls: compare current status to baseline
   *    a. If current ≠ baseline: agent deviated, add to pending
   *    b. If current = baseline: agent returned to normal, remove from pending
   * 3. For deviated agents: increment poll counter each poll at same status
   * 4. For each status group (ok/offline/error):
   *    a. Find max pollsInNewState among agents in group
   *    b. If max >= threshold: ALL agents in group fire together
   * 5. After firing: remove all fired agents from pending
   *
   * EDGE CASE: Agent changes status mid-pending (e.g., error → ok while pending)
   * - Remove from old status group
   * - Reset poll counter to 1
   * - Add to new status group
   */
  async checkAndNotify(statuses: AgentStatusInfo[]): Promise<void> {
    const settings = getNotificationSettings();

    if (!settings.notificationsEnabled) {
      return;
    }

    const agents = await readAgents();
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));
    const changesToNotify: StatusChangeBatch[] = [];

    // Capture baselines BEFORE processing any agents.
    // This ensures all agents in this poll compare against their baseline
    // from the PREVIOUS complete poll, not baselines modified during this poll.
    const baselinesAtPollStart = new Map<number, string>();
    for (const status of statuses) {
      baselinesAtPollStart.set(
        status.id,
        this.agentBaseline.get(status.id) ?? this.FIRST_POLL_MARKER,
      );
    }

    // Phase 1: Process each agent - detect deviations, update counters, manage groups
    for (const status of statuses) {
      const baseline = baselinesAtPollStart.get(status.id);
      const agentName = agentNameMap.get(status.id) || `Agent ${status.id}`;

      // First poll for this agent: establish baseline, no change to report
      if (baseline === this.FIRST_POLL_MARKER) {
        this.agentBaseline.set(status.id, status.status);
        continue;
      }

      const currentStatus = status.status;

      // Agent has DEVIATED from baseline (current ≠ baseline)
      if (currentStatus !== baseline) {
        const pending = this.pendingAgents.get(status.id);

        if (!pending) {
          // First time this agent has deviated from baseline
          // Create pending entry with counter = 1 (this is first poll at new status)
          this.pendingAgents.set(status.id, {
            currentStatus,
            pollsInNewState: 1,
            originalBaseline: baseline as string,
          });
          // Add to appropriate status group for batching
          this.statusGroups.get(currentStatus)?.add(status.id);
          logger.debug(
            "notifications",
            `[${agentName}] Status change: ${baseline} -> ${currentStatus}`,
          );
        } else if (pending.currentStatus === currentStatus) {
          // Agent is still deviated in the SAME status as last poll
          // Just increment the counter
          pending.pollsInNewState++;
        } else {
          // Agent changed to a DIFFERENT non-baseline status mid-pending
          // Example: was error, now ok (both ≠ baseline)
          // Remove from old status group
          this.statusGroups.get(pending.currentStatus)?.delete(status.id);
          // Update pending with new status and reset counter
          // Preserve originalBaseline - we still want to know where we came from
          pending.currentStatus = currentStatus;
          pending.pollsInNewState = 1;
          // Add to new status group
          this.statusGroups.get(currentStatus)?.add(status.id);
        }
      } else {
        // Agent's current status equals the poll-start baseline
        // Check if this is a TRUE return to original baseline (pre-deviation)
        const pending = this.pendingAgents.get(status.id);
        if (pending) {
          // Compare against ORIGINAL baseline (stored when first deviated)
          // NOT against the current baseline which gets updated each poll
          if (currentStatus === pending.originalBaseline) {
            // Genuinely returned to where we started before deviation
            this.pendingAgents.delete(status.id);
            // Remove from all status groups
            for (const group of this.statusGroups.values()) {
              group.delete(status.id);
            }
          } else {
            // Agent returned to baseline status but hasn't returned to original baseline
            // This means the deviation has persisted for another poll cycle
            // Increment counter to track sustained deviation
            pending.pollsInNewState++;
          }
        }
      }

      // Update baseline for next poll comparison
      // Next poll will compare against THIS poll's status
      this.agentBaseline.set(status.id, currentStatus);
    }

    // Phase 2: Check which groups have reached threshold and should fire
    for (const [status, group] of this.statusGroups) {
      if (group.size === 0) continue;

      // Find the agent with the most polls in this group
      // When this agent reaches threshold, ALL in group fire
      let maxPolls = 0;
      for (const agentId of group) {
        const pending = this.pendingAgents.get(agentId);
        if (pending && pending.pollsInNewState > maxPolls) {
          maxPolls = pending.pollsInNewState;
        }
      }

      // Check if threshold reached
      if (maxPolls >= settings.statusChangeThreshold) {
        // ALL agents in this group fire together
        // This includes agents that joined later (fewer polls)
        logger.info(
          "notifications",
          `${group.size} agent(s) reached threshold for ${status}, sending notification`,
        );
        for (const agentId of group) {
          const agentName = agentNameMap.get(agentId) || `Agent ${agentId}`;
          changesToNotify.push({
            agentId,
            agentName,
            newStatus: status,
          });
          // Remove fired agents from pending
          this.pendingAgents.delete(agentId);
        }
        // Clear the group since all fired
        group.clear();
      }
    }

    // Phase 3: Send the notifications
    if (changesToNotify.length > 0) {
      this.batchAndSendNotifications(changesToNotify, settings);
    }
  }

  /**
   * batchAndSendNotifications - Group changes by status and send notifications
   *
   * Groups changes by their final status (ok/offline/error) and sends
   * one notification per group with appropriate messaging.
   *
   * Example: 3 agents going online → "3 agents are now online"
   * Example: 1 agent offline → "Agent Offline - X is now offline"
   */
  private batchAndSendNotifications(
    changes: StatusChangeBatch[],
    settings: {
      notifyOnStatusChange: boolean;
      notifyOnError: boolean;
      silentNotifications: boolean;
    },
  ): void {
    // Group changes by their final status
    const grouped: Map<string, StatusChangeBatch[]> = new Map();

    for (const change of changes) {
      // Check if this change should trigger a notification
      // notifyOnStatusChange = true means notify for ANY status change
      // notifyOnError = true means notify specifically for errors
      const shouldNotify =
        settings.notifyOnStatusChange ||
        (change.newStatus === "error" && settings.notifyOnError);

      if (!shouldNotify) continue;

      if (!grouped.has(change.newStatus)) {
        grouped.set(change.newStatus, []);
      }
      grouped.get(change.newStatus)!.push(change);
    }

    // Send one notification per status group
    for (const [status, groupChanges] of grouped) {
      if (groupChanges.length === 0) continue;

      const { title, body } = buildNotificationMessage(status, groupChanges);
      if (!title) continue;

      try {
        Utils.showNotification({
          title,
          body,
          silent: settings.silentNotifications,
        });
        logger.info("notifications", `Notification sent: ${title} - ${body}`);
      } catch (error) {
        logger.error("notifications", "Failed to send notification:", error);
      }
    }
  }
}
