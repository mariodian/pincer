import type { BrowserWindow } from "electrobun/bun";
import type { AgentStatus } from "../../shared/types";

type BroadcastTargets = {
  popoverWindow?: BrowserWindow | null;
  mainWindow?: BrowserWindow | null;
};

type BroadcastOptions = {
  mainWindowRetryAttempts?: number;
  mainWindowRetryDelayMs?: number;
};

type SendOptions = {
  warnOnFailure?: boolean;
  skipIfTargetMissing?: boolean;
};

/** Default retry configuration for main window broadcasts. */
export const DEFAULT_RETRY_ATTEMPTS = 3;
/** Default delay between retry attempts in milliseconds. */
export const DEFAULT_RETRY_DELAY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendSyncAgentsWithRetry(
  label: string,
  getRpc: () => unknown,
  payload: AgentStatus[],
  attempts = 1,
  retryDelayMs = 0,
  options?: SendOptions,
): Promise<void> {
  let lastError: unknown = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const rpc = getRpc() as {
        send?: { syncAgents?: (data: AgentStatus[]) => void };
      } | null;

      if (rpc?.send?.syncAgents) {
        rpc.send.syncAgents(payload);
        return;
      }

      if (options?.skipIfTargetMissing) {
        return;
      }

      lastError = new Error(`${label} RPC not ready`);
    } catch (error) {
      lastError = error;
    }

    if (i < attempts - 1) {
      await delay(retryDelayMs);
    }
  }

  if (lastError && options?.warnOnFailure !== false) {
    console.warn(`Failed to push agents to ${label}:`, lastError);
  }
}

export async function broadcastSyncAgents(
  payload: AgentStatus[],
  targets: BroadcastTargets,
  options?: BroadcastOptions,
): Promise<void> {
  await sendSyncAgentsWithRetry(
    "popover",
    () => targets.popoverWindow?.webview.rpc,
    payload,
    1,
    0,
    {
      warnOnFailure: false,
      skipIfTargetMissing: true,
    },
  );

  await sendSyncAgentsWithRetry(
    "main window",
    () => targets.mainWindow?.webview.rpc,
    payload,
    options?.mainWindowRetryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
    options?.mainWindowRetryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
    {
      warnOnFailure: true,
    },
  );
}
