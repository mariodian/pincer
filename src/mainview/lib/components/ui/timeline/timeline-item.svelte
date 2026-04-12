<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLLIElement>> = $props();
</script>

<li
	bind:this={ref}
	data-slot="timeline-item"
	class={cn("group/timeline-item relative ms-6 [&:not(:last-child)]:mb-10", className)}
	{...restProps}
>
	{@render children?.()}
</li>
