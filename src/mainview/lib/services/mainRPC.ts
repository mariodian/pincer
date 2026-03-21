import type { AgentRPCType } from "$bun/rpc/agentRPC";
import type { SystemRPCType } from "$bun/rpc/systemRPC";
import { syncAgentsToCache } from "$lib/utils/storage";
import type { AgentStatus } from "$shared/types";

export type MainRPCType = {
  bun: {
    requests: SystemRPCType["bun"]["requests"] &
      AgentRPCType["bun"]["requests"];
    messages: SystemRPCType["bun"]["messages"] &
      AgentRPCType["bun"]["messages"];
  };
  webview: {
    requests: SystemRPCType["webview"]["requests"] &
      AgentRPCType["webview"]["requests"];
    messages: SystemRPCType["webview"]["messages"] &
      AgentRPCType["webview"]["messages"];
  };
};

// Module-level singleton — survives component unmount/remount within the same
// renderer session. A Map instead of a Set allows stale callback refs (left
// behind after HMR module replacement) to be cleaned up via delete().
let rpcInstance: unknown = null;
let initPromise: Promise<void> | null = null;

type SyncCallback = () => void;
const syncCallbacks = new Map<string, SyncCallback>();
let callbackKeyCounter = 0;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMainRPC(): any {
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
          syncAgents: ((data: AgentStatus[]) => {
            if (typeof localStorage !== "undefined") {
              syncAgentsToCache(data);
            }

            for (const [, cb] of syncCallbacks) {
              cb();
            }
          }) as any,
        },
      },
    });

    new Electroview({ rpc });
    rpcInstance = rpc;
  })();

  return initPromise;
}
