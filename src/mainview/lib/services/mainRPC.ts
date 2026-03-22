import type { AgentRPCType } from "$bun/rpc/agentRPC";
import type { SystemRPCType } from "$bun/rpc/systemRPC";
import { syncAgentsToCache } from "$lib/utils/storage";
import type { AgentStatus } from "$shared/types";
import type { LogEntry } from "$shared/rpc";

/** Composed RPC type: system messages (navigateTo, pushLog) + agent messages (syncAgents) + all requests. */
export type MainRPCType = SystemRPCType & AgentRPCType;

/** The typed request object available via getMainRPC().request */
export type MainRPCRequests = {
  [K in keyof (SystemRPCType["bun"]["requests"] &
    AgentRPCType["bun"]["requests"])]: (
    ...args: (SystemRPCType["bun"]["requests"] &
      AgentRPCType["bun"]["requests"])[K] extends { params: infer P }
      ? [P]
      : []
  ) => Promise<
    (SystemRPCType["bun"]["requests"] &
      AgentRPCType["bun"]["requests"])[K] extends { response: infer R }
      ? R
      : never
  >;
};

// Module-level singleton — survives component unmount/remount within the same
// renderer session. A Map instead of a Set allows stale callback refs (left
// behind after HMR module replacement) to be cleaned up via delete().
// The framework's defineRPC returns a proxy-based RPC object; its internal type
// doesn't match our typed request surface, so we cast at the assignment boundary.
let rpcInstance: { request: MainRPCRequests } | null = null;
let initPromise: Promise<void> | null = null;

type SyncCallback = () => void;
const syncCallbacks = new Map<string, SyncCallback>();
let callbackKeyCounter = 0;

// Log storage for pushed log entries (warn/error from main process)
const logMessages: LogEntry[] = [];

/** Get all pushed log messages. For future UI consumption. */
export function getLogMessages(): readonly LogEntry[] {
  return logMessages;
}

/** Clear all pushed log messages. */
export function clearLogMessages(): void {
  logMessages.length = 0;
}

/** Subscribe to agent data sync events. Returns the key to pass to offAgentSync. */
export function onAgentSync(callback: SyncCallback): string {
  const key = String(++callbackKeyCounter);
  syncCallbacks.set(key, callback);
  return key;
}

/** Unsubscribe using the key returned by onAgentSync. */
export function offAgentSync(key: string): void {
  syncCallbacks.delete(key);
  // Purge any stale entries left by HMR module replacement.
  for (const [k] of syncCallbacks) {
    if (typeof syncCallbacks.get(k) !== "function") {
      syncCallbacks.delete(k);
    }
  }
}

/** Invoke all registered sync callbacks. Used by windows with separate RPC instances. */
export function triggerSyncCallbacks(): void {
  for (const [, cb] of syncCallbacks) {
    cb();
  }
}

export function isInitialized(): boolean {
  return rpcInstance !== null;
}

export function getMainRPC(): { request: MainRPCRequests } {
  if (!rpcInstance) {
    throw new Error("Main RPC not initialized. Call initMainRPC() first.");
  }
  return rpcInstance;
}

export async function initMainRPC(handlers: {
  navigateTo: (params: { path: string }) => void;
}): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { Electroview } = await import("electrobun/view");

    const rpc = Electroview.defineRPC<MainRPCType>({
      handlers: {
        requests: {},
        messages: {
          navigateTo: ({ params }: { params: { path: string } }) =>
            handlers.navigateTo(params),
          syncAgents: ({ params }: { params: AgentStatus[] }) => {
            if (typeof localStorage !== "undefined") {
              syncAgentsToCache(params);
            }

            for (const [, cb] of syncCallbacks) {
              cb();
            }
          },
          pushLog: ({ params }: { params: LogEntry }) => {
            logMessages.push(params);
          },
        },
      },
    });

    new Electroview({ rpc });
    rpcInstance = rpc as unknown as { request: MainRPCRequests };
  })();

  return initPromise;
}
