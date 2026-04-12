<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

  interface Props {
    withoutBorder?: boolean;
  }

	let {
		ref = $bindable(null),
		class: className,
		children,
    withoutBorder = false,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLOListElement>> & Props = $props();
</script>

<ol
	bind:this={ref}
	data-slot="timeline"
  class={cn("relative", !withoutBorder ? "border-s border-default" : "", className)}
	{...restProps}
>
	{@render children?.()}
</ol>
