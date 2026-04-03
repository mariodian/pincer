// System RPC - Shared RPC definition for system info
import { BrowserView, Utils } from "electrobun/bun";
import { RPC_MAX_REQUEST_TIME } from "../../shared/rpc";
import { logger } from "../services/loggerService";
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
      openExternalUrl: {
        params: { url: string };
        response: { success: boolean };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      navigateTo: { params: { path: string }; response: void };
      requestSaveAgentForm: { params: undefined; response: void };
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
    try {
      const success = setMacOSWindowAppearance(appearance);
      if (!success) {
        logger.warn("systemRPC", "setMacOSWindowAppearance returned false");
      }
      return { success };
    } catch (error) {
      logger.error(
        "systemRPC",
        "Failed to set window appearance:",
        error instanceof Error ? error.message : String(error),
      );
      return { success: false };
    }
  },
  notifyRendererReady: async ({ view }: { view: RendererView }) => {
    try {
      // Consume pending route before firing the callback so the response
      // reaches the renderer before any side-effects happen.
      const initialRoute = getPendingRoute();
      clearPendingRoute();

      if (onRendererReady) {
        await onRendererReady({ view });
      }

      return { ok: true, initialRoute };
    } catch (error) {
      logger.error(
        "systemRPC",
        "Failed to notify renderer ready:",
        error instanceof Error ? error.message : String(error),
      );
      return { ok: false, initialRoute: null };
    }
  },
  openExternalUrl: async ({ url }: { url: string }) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        logger.warn(
          "systemRPC",
          `Blocked external URL with protocol: ${parsedUrl.protocol}`,
        );
        return { success: false };
      }

      const success = Utils.openExternal(url);
      if (!success) {
        logger.warn("systemRPC", `Failed to open external URL: ${url}`);
      }

      return { success };
    } catch (error) {
      logger.error(
        "systemRPC",
        "Failed to open external URL:",
        error instanceof Error ? error.message : String(error),
      );
      return { success: false };
    }
  },
};

export const systemRPC = BrowserView.defineRPC<SystemRPCType>({
  maxRequestTime: RPC_MAX_REQUEST_TIME,
  handlers: {
    requests: systemRequestHandlers,
    messages: {
      navigateTo: () => {
        // Navigation is handled in the webview (App.svelte)
      },
      requestSaveAgentForm: () => {
        // Save form handling is implemented in the webview (mainRPC.ts)
      },
      pushLog: () => {
        // Log push is handled in the webview (mainRPC.ts)
      },
    },
  },
});
