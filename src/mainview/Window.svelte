<script lang="ts">
  import { Electroview } from "electrobun/view";
  import type { Snippet } from "svelte";
  import type { SystemRPCType } from "../bun/systemRPC";

  const rpc = Electroview.defineRPC<SystemRPCType>({
    handlers: {
      requests: {},
      messages: {},
    },
  });

  new Electroview({
    rpc,
  });

  let os = $state<"macos" | "win" | "linux" | "">("");

  $effect(() => {
    rpc.request
      .getPlatform({})
      .then((result) => {
        os = result.os;
      })
      .catch((e) => {
        console.error("getPlatform failed:", e);
      });
  });

  const isMacOS = $derived(os === "macos");
  const contentHeight = $derived(isMacOS ? "h-[calc(100vh-2.5rem)]" : "h-full");

  let {
    title = "Window",
    rootClass = "text-white",
    contentClass = "container mx-auto max-w-3xl px-6 py-10",
    children,
    actions,
  } = $props<{
    title?: string;
    rootClass?: string;
    contentClass?: string;
    children?: Snippet;
    actions?: Snippet;
  }>();
</script>

<div class={`h-screen overflow-hidden ${rootClass}`}>
  <div
    class="sticky top-0 z-20 flex h-10 items-center border-b border-white/20 bg-black/20 pl-24 pr-4"
    class:hidden={!isMacOS}
  >
    <span class="text-sm font-semibold tracking-wide text-white/90"
      >{title}</span
    >
    <div class="ml-auto">
      {@render actions?.()}
    </div>
  </div>

  <div class="{contentHeight} overflow-y-auto overscroll-contain">
    <div class={contentClass}>
      {@render children?.()}
    </div>
  </div>
</div>
