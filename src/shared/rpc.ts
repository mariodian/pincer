// Shared RPC types for main window navigation
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
        response: { id: number; status: "ok" | "offline" | "error"; lastChecked: number; errorMessage?: string }[];
      };
      checkAllAgentsStatus: {
        params: Record<string, never>;
        response: { id: number; status: "ok" | "offline" | "error"; lastChecked: number; errorMessage?: string }[];
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
    messages: Record<string, never>;
  };
};
