<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="timeline-icon"
	class={cn(
		"absolute -inset-s-9 flex items-center justify-center rounded-full ring-8 ring-buffer",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
