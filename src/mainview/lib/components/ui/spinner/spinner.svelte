<script lang="ts">
	import { Icon } from "$lib/components/ui/icon/index.js";
	import { cn } from "$lib/utils.js";

	type Props = {
		class?: string;
		className?: string;
		role?: string;
		"aria-label"?: string;
	};

	let {
		class: className,
		role = "status",
		"aria-label": ariaLabel = "Loading",
	}: Props = $props();
</script>

<Icon
	name="loading"
	strokeWidth={2}
	ariaLabel={ariaLabel}
	class={cn("size-4 animate-spin", className)}
	{role}
/>
