// System RPC - Shared RPC definition for system info
import { BrowserView } from "electrobun/bun";
import {
  setMacOSWindowAppearance,
  type WindowAppearance,
} from "../utils/macOSWindowEffects";
import { clearPendingRoute, getPendingRoute } from "../utils/navigation";
import { getPlatform } from "../utils/platform";

type RendererView = "main";
type RendererReadyCallback = (params: {
  view: RendererView;
}) => void | Promise<void>;

let onRendererReady: RendererReadyCallback | null = null;

export function setRendererReadyCallback(cb: RendererReadyCallback): void {
  onRendererReady = cb;
}

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
      notifyRendererReady: {
        params: { view: RendererView };
        response: { ok: boolean; initialRoute: string | null };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      navigateTo: { params: { path: string }; response: void };
      pushLog: {
        params: {
          level: "warn" | "error";
          component: string;
          message: string;
          timestamp: string;
        };
        response: void;
      };
    };
  };
};

export const systemRequestHandlers = {
  getPlatform: async () => {
    const os = getPlatform();
    return { os };
  },
  setWindowAppearance: async ({
    appearance,
  }: {
    appearance: WindowAppearance;
  }) => {
    return {
      success: setMacOSWindowAppearance(appearance),
    };
  },
  notifyRendererReady: async ({ view }: { view: RendererView }) => {
    // Consume pending route before firing the callback so the response
    // reaches the renderer before any side-effects happen.
    const initialRoute = getPendingRoute();
    clearPendingRoute();

    if (onRendererReady) {
      await onRendererReady({ view });
    }

    return { ok: true, initialRoute };
  },
};

export const systemRPC = BrowserView.defineRPC<SystemRPCType>({
  handlers: {
    requests: systemRequestHandlers,
    messages: {
      navigateTo: () => {
        // Navigation is handled in the webview (App.svelte)
      },
      pushLog: () => {
        // Log push is handled in the webview (mainRPC.ts)
      },
    },
  },
});
