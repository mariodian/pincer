<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import type { SystemRPCType } from "../../bun/rpc/systemRPC";

  type Align = "left" | "center" | "right";
  type ResolvedTheme = "light" | "dark";

  interface Props {
    title?: string;
    rootClass?: string;
    contentClass?: string;
    align?: Align;
    children?: Snippet;
    actions?: Snippet;
  }

  let os = $state<"macos" | "win" | "linux" | "">("");

  function getResolvedTheme(): ResolvedTheme {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
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
        const { Electroview } = await import("electrobun/view");

        const rpc = Electroview.defineRPC<SystemRPCType>({
          handlers: {
            requests: {},
            messages: {},
          },
        });

        new Electroview({ rpc });

        const result = await rpc.request.getPlatform({});
        if (isDisposed) {
          return;
        }

        os = result.os;
        console.log("OS:", os);

        if (result.os !== "macos") {
          return;
        }

        const syncWindowAppearance = async (appearance: ResolvedTheme) => {
          try {
            await rpc.request.setWindowAppearance({ appearance });
          } catch (error) {
            console.error("Failed to sync macOS window appearance:", error);
          }
        };

        let lastTheme = getResolvedTheme();
        await syncWindowAppearance(lastTheme);

        const observer = new MutationObserver(() => {
          const nextTheme = getResolvedTheme();
          if (nextTheme === lastTheme) {
            return;
          }

          lastTheme = nextTheme;
          void syncWindowAppearance(nextTheme);
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        stopThemeSync = () => {
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

  let {
    rootClass = "text-white",
    contentClass = "w-full",
    children,
  }: Props = $props();
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
    background-color: transparent;
  }

  /* macOS dark */
  :global(html.dark body[data-os="macos"]) {
    background-color: transparent;
  }
</style>
