// System RPC - Shared RPC definition for system info
import { BrowserView } from "electrobun/bun";

export type SystemRPCType = {
  bun: {
    requests: {
      getPlatform: {
        params: Record<string, never>;
        response: { os: "macos" | "win" | "linux" };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: Record<string, never>;
  };
};

export const systemRPC = BrowserView.defineRPC<SystemRPCType>({
  handlers: {
    requests: {
      getPlatform: async () => {
        const p = process.platform;
        const os = p === "darwin" ? "macos" : p === "win32" ? "win" : "linux";
        return { os };
      },
    },
    messages: {},
  },
});