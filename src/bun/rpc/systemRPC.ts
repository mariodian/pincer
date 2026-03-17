// System RPC - Shared RPC definition for system info
import { BrowserView } from "electrobun/bun";
import { getPlatform } from "../utils/platform";

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
        const os = getPlatform();
        return { os };
      },
    },
    messages: {},
  },
});