<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import type { SystemRPCType } from "../../bun/rpc/systemRPC";

  type Align = "left" | "center" | "right";

  interface Props {
    title?: string;
    rootClass?: string;
    contentClass?: string;
    align?: Align;
    children?: Snippet;
    actions?: Snippet;
  }

  let os = $state<"macos" | "win" | "linux" | "">("");

  onMount(async () => {
    // Electrobun injects webview/socket identifiers used by Electroview transport.
    const hasElectrobunRuntime =
      typeof window !== "undefined" &&
      typeof (window as any).__electrobunWebviewId !== "undefined" &&
      typeof (window as any).__electrobunRpcSocketPort !== "undefined";

    // Skip RPC wiring in plain Vite/browser mode.
    if (!hasElectrobunRuntime) {
      return;
    }

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
      os = result.os;
      console.log("OS:", os);
    } catch (e) {
      console.error("Electrobun platform init failed:", e);
    }
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
  /* macOS light */
  :global(html:not(.dark) body[data-os="macos"]) {
    --background: --background: oklch(1 0 0 / 60%);
    --sidebar: transparent;
  }

  /* macOS dark */
  :global(html.dark body[data-os="macos"]) {
    --background: oklch(12.856% 0.00001 271.152 / 60%);
    --sidebar: transparent;
  }
</style>
