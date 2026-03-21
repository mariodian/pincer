// Shared RPC types for main window navigation
import type { AgentStatus } from "./types";
export type MainWindowRPCType = {
  bun: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      navigateTo: {
        params: { path: string };
        response: void;
      };
    };
  };
};

export type TrayPopoverRPCType = {
  bun: {
    requests: {
      getAgents: {
        params: Record<string, never>;
        response: {
          id: number;
          name: string;
          url: string;
          port: number;
          enabled?: boolean;
          status: "ok" | "offline" | "error";
          lastChecked: number;
          errorMessage?: string;
        }[];
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: {
          id: number;
          name: string;
          url: string;
          port: number;
          enabled?: boolean;
          status: "ok" | "offline" | "error";
          lastChecked: number;
          errorMessage?: string;
        }[];
      };
      requestRefresh: {
        params: Record<string, never>;
        response: boolean;
      };
      openMainWindow: {
        params: { page: string };
        response: boolean;
      };
      quit: {
        params: Record<string, never>;
        response: boolean;
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      syncAgents: {
        params: AgentStatus[];
        response: void;
      };
    };
  };
};
