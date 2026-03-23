<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    animationDuration = 300,
  }: {
    children?: Snippet;
    animationDuration?: number;
  } = $props();
</script>

<div
  class="starting:opacity-0 animate-in fade-in h-full min-w-96"
  style="animation-duration: {animationDuration}ms;"
>
  {@render children?.()}
</div>
