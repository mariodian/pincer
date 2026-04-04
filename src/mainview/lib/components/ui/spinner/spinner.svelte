<script lang="ts">
	import { Icon } from "$lib/components/ui/icon/index.js";
	import { cn } from "$lib/utils.js";

	type Props = {
    size?: number;
    strokeWidth?: number;
		class?: string;
		className?: string;
		role?: string;
		"aria-label"?: string;
	};

	let {
    size = 16,
    strokeWidth = 2,
		class: className,
		role = "status",
		"aria-label": ariaLabel = "Loading",
	}: Props = $props();
</script>

<Icon
	name="loading"
  {size}
	{strokeWidth}
	ariaLabel={ariaLabel}
	class={cn("animate-spin", className)}
	{role}
/>
