<script lang="ts">
  import type { Platform } from "$shared/types";
  import { userPrefersMode } from "mode-watcher";
  import { onMount, type Snippet } from "svelte";

  import {
    getMainRPC,
    initMainRPC,
    pendingNavigationRoute,
    rpcReady,
  } from "$lib/services/mainRPC";

  type Align = "left" | "center" | "right";
  type ResolvedTheme = "light" | "dark";
  type WindowAppearance = "system" | ResolvedTheme;

  interface Props {
    title?: string;
    rootClass?: string;
    contentClass?: string;
    align?: Align;
    children?: Snippet;
    actions?: Snippet;
  }

  let os = $state<Platform | "">("");
  let pushWindowAppearance: ((appearance: WindowAppearance) => void) | null =
    null;

  function getResolvedTheme(): ResolvedTheme {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  }

  function getRequestedAppearance(): WindowAppearance {
    const preferred = userPrefersMode.current;

    if (preferred === "light" || preferred === "dark") {
      return preferred;
    }

    if (preferred === "system") {
      return "system";
    }

    // Fallback if mode-watcher is not initialized yet.
    return getResolvedTheme();
  }

  onMount(() => {
    let isDisposed = false;
    let stopThemeSync = () => {};

    void (async () => {
      try {
        await initMainRPC({
          navigateTo: (params) => {
            window.location.hash = params.path;
          },
        });

        const rpc = getMainRPC();
        const { initialRoute } = await rpc.request.notifyRendererReady({
          view: "main",
        });

        // Store the pending route so the router's / catch-all can push to
        // the correct page when it first mounts (instead of defaulting to /dashboard).
        if (initialRoute) {
          pendingNavigationRoute.set(initialRoute);
        }
        rpcReady.set(true);

        const result = await rpc.request.getPlatform({});
        if (isDisposed) {
          return;
        }

        os = result.os;
        document.body.dataset.os = os;

        if (result.os !== "macos") {
          return;
        }

        const syncWindowAppearance = async (appearance: WindowAppearance) => {
          try {
            await rpc.request.setWindowAppearance({ appearance });
          } catch (error) {
            console.error("Failed to sync macOS window appearance:", error);
          }
        };

        let lastAppearance: WindowAppearance | null = null;
        const syncIfChanged = (appearance: WindowAppearance) => {
          if (appearance === lastAppearance) {
            return;
          }

          lastAppearance = appearance;
          void syncWindowAppearance(appearance);
        };

        pushWindowAppearance = syncIfChanged;
        syncIfChanged(getRequestedAppearance());

        const observer = new MutationObserver(() => {
          syncIfChanged(getRequestedAppearance());
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        stopThemeSync = () => {
          pushWindowAppearance = null;
          observer.disconnect();
        };
      } catch (e) {
        console.error("Electrobun platform init failed:", e);
        rpcReady.set(true);
      }
    })();

    return () => {
      isDisposed = true;
      stopThemeSync();
    };
  });

  $effect(() => {
    void userPrefersMode.current;
    pushWindowAppearance?.(getRequestedAppearance());
  });

  let { rootClass = "", contentClass = "w-full", children }: Props = $props();
</script>

<div class={["h-screen overflow-hidden", rootClass]}>
  <div class="h-full overflow-y-auto overscroll-contain">
    <div class={[contentClass]}>
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  /* macos-specific window effects */
  :global(body[data-os="macos"]) {
    --sidebar: transparent;
  }
  /* macOS light */
  :global(html:not(.dark) body[data-os="macos"]) {
    background-color: oklch(0.912 0.012 322.12 / 40%);
  }
  /* macOS dark */
  :global(html.dark body[data-os="macos"]) {
    background-color: oklch(0.3 0.019 322.12 / 75%);
  }
</style>
