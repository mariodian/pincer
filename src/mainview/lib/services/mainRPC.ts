import type { AgentRPCType } from "$bun/rpc/agentRPC";
import type { SystemRPCType } from "$bun/rpc/systemRPC";

export type MainRPCType = {
  bun: {
    requests: SystemRPCType["bun"]["requests"] & AgentRPCType["bun"]["requests"];
    messages: SystemRPCType["bun"]["messages"] & AgentRPCType["bun"]["messages"];
  };
  webview: {
    requests: SystemRPCType["webview"]["requests"] & AgentRPCType["webview"]["requests"];
    messages: SystemRPCType["webview"]["messages"] & AgentRPCType["webview"]["messages"];
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rpcInstance: any = null;
let initPromise: Promise<void> | null = null;

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
          navigateTo: ({ params }) => handlers.navigateTo(params),
        },
      },
    });

    new Electroview({ rpc });
    rpcInstance = rpc;
  })();

  return initPromise;
}
