<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLTimeElement>> = $props();
</script>

<time
	bind:this={ref}
	data-slot="timeline-time"
	class={cn(
		"w-fit rounded border border-default-medium bg-neutral-secondary-medium px-1.5 py-0.5 text-xs font-medium text-heading",
		className
	)}
	{...restProps}
>
	{@render children?.()}
</time>
