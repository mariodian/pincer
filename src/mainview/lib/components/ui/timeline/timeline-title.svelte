<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLHeadingElement>> = $props();
</script>

<h3
	bind:this={ref}
	data-slot="timeline-title"
	class={cn("flex items-center text-lg font-semibold text-heading", className)}
	{...restProps}
>
	{@render children?.()}
</h3>
