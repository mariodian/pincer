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
  class="starting:opacity-0 animate-in fade-in"
  style="animation-duration: {animationDuration}ms;"
>
  {@render children?.()}
</div>
