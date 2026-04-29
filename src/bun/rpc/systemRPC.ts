// System RPC - Shared RPC definition for system info
import { BrowserView, Utils } from "electrobun/bun";

import { RPC_MAX_REQUEST_TIME } from "../../shared/rpc";
import type { Platform } from "../../shared/types";
import { logger } from "../services/loggerService";
import {
  setMacOSWindowAppearance,
  type WindowAppearance,
} from "../utils/macOSWindowEffects";
import { clearPendingRoute, getPendingRoute } from "../utils/navigation";
import { getPlatform } from "../utils/platform";
import { withErrorResult } from "./rpcHelpers";

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
        response: { os: Platform };
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
      getDownloadsPath: {
        params: Record<string, never>;
        response: { path: string };
      };
      openFolder: {
        params: { path: string };
        response: { success: boolean };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      navigateTo: { path: string };
      requestSaveAgentForm: undefined;
      pushLog: {
        level: "warn" | "error";
        component: string;
        message: string;
        timestamp: string;
      };
    };
  };
};

export const systemRequestHandlers = {
  getPlatform: async () => {
    const os = getPlatform();
    return { os };
  },
  setWindowAppearance: ({ appearance }: { appearance: WindowAppearance }) =>
    withErrorResult(
      "systemRPC",
      async () => {
        const success = setMacOSWindowAppearance(appearance);
        if (!success) {
          logger.warn("systemRPC", "setMacOSWindowAppearance returned false");
        }
        return { success };
      },
      { success: false },
    ),
  notifyRendererReady: ({ view }: { view: RendererView }) =>
    withErrorResult(
      "systemRPC",
      async () => {
        // Consume pending route before firing the callback so the response
        // reaches the renderer before any side-effects happen.
        const initialRoute = getPendingRoute();
        clearPendingRoute();

        if (onRendererReady) {
          await onRendererReady({ view });
        }

        return { ok: true, initialRoute };
      },
      { ok: false, initialRoute: null },
    ),
  openExternalUrl: ({ url }: { url: string }) =>
    withErrorResult(
      "systemRPC",
      async () => {
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
      },
      { success: false },
    ),
  getDownloadsPath: async () => {
    return { path: Utils.paths.downloads };
  },
  openFolder: ({ path: folderPath }: { path: string }) =>
    withErrorResult(
      "systemRPC",
      async () => {
        // Use file:// URL to open folder in Finder/Explorer
        const success = Utils.openExternal(`file://${folderPath}`);
        if (!success) {
          logger.warn("systemRPC", `Failed to open folder: ${folderPath}`);
        }
        return { success };
      },
      { success: false },
    ),
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
