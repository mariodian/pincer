// Shared RPC types for tray popover
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
        response: AgentStatus[];
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: AgentStatus[];
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
