<script lang="ts">
  import { userPrefersMode } from "mode-watcher";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { initMainRPC } from "$lib/services/mainRPC";

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

  let os = $state<"macos" | "win" | "linux" | "">("");
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

    // Electrobun injects webview/socket identifiers used by Electroview transport.
    const hasElectrobunRuntime =
      typeof window !== "undefined" &&
      typeof (window as any).__electrobunWebviewId !== "undefined" &&
      typeof (window as any).__electrobunRpcSocketPort !== "undefined";

    // Skip RPC wiring in plain Vite/browser mode.
    if (!hasElectrobunRuntime) {
      return;
    }

    void (async () => {
      try {
        await initMainRPC({
          navigateTo: (params) => {
            window.location.hash = params.path;
          },
        });

        const { getMainRPC } = await import("$lib/services/mainRPC");
        const rpc = getMainRPC();

        const result = await rpc.request.getPlatform({});
        if (isDisposed) {
          return;
        }

        os = result.os;
        console.log("OS:", os);

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
      }
    })();

    return () => {
      isDisposed = true;
      stopThemeSync();
    };
  });

  $effect(() => {
    if (os) document.body.dataset.os = os;
  });

  $effect(() => {
    userPrefersMode.current;
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
  :global(body[data-os="macos"] [data-slot="sidebar-container"]) {
    border: none !important;
  }
  /* macOS light */
  :global(html:not(.dark) body[data-os="macos"]) {
    background-color: oklch(94.974% 0.01133 320.903 / 0.35);
  }

  /* macOS dark */
  :global(html.dark body[data-os="macos"]) {
    background-color: oklch(30.029% 0.01875 318.593 / 0.55);
  }
</style>
