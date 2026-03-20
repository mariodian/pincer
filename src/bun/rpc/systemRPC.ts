// System RPC - Shared RPC definition for system info
import { BrowserView } from "electrobun/bun";
import { getPlatform } from "../utils/platform";
import {
  setMacOSWindowAppearance,
  type WindowAppearance,
} from "../windowService";

export type SystemRPCType = {
  bun: {
    requests: {
      getPlatform: {
        params: Record<string, never>;
        response: { os: "macos" | "win" | "linux" };
      };
      setWindowAppearance: {
        params: { appearance: WindowAppearance };
        response: { success: boolean };
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
      setWindowAppearance: async ({ appearance }) => {
        return {
          success: setMacOSWindowAppearance(appearance),
        };
      },
    },
    messages: {},
  },
});
