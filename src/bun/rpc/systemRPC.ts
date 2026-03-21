// System RPC - Shared RPC definition for system info
import { BrowserView } from "electrobun/bun";
import { getPlatform } from "../utils/platform";
import {
  setMacOSWindowAppearance,
  type WindowAppearance,
} from "../utils/macOSWindowEffects";

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
        response: { ok: boolean };
      };
    };
    messages: Record<string, never>;
  };
  webview: {
    requests: Record<string, never>;
    messages: {
      navigateTo: { params: { path: string }; response: void };
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
    if (onRendererReady) {
      await onRendererReady({ view });
    }

    return { ok: true };
  },
};

export const systemRPC = BrowserView.defineRPC<SystemRPCType>({
  handlers: {
    requests: systemRequestHandlers,
    messages: {
      navigateTo: () => {
        // Navigation is handled in the webview (App.svelte)
      },
    },
  },
});
