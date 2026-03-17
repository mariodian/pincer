<script lang="ts">
  import type { Snippet } from "svelte";

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
  >
    <span class="text-sm font-semibold tracking-wide text-white/90"
      >{title}</span
    >
    <div class="ml-auto">
      {@render actions?.()}
    </div>
  </div>

  <div class="h-[calc(100vh-2.5rem)] overflow-y-auto overscroll-contain">
    <div class={contentClass}>
      {@render children?.()}
    </div>
  </div>
</div>
