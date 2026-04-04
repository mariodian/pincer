<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Loading03Icon } from "@hugeicons/core-free-icons";
	import { HugeiconsIcon } from "@hugeicons/svelte";
	import type { SVGAttributes } from "svelte/elements";

	type Props = SVGAttributes<SVGSVGElement> & {
		icon?: typeof Loading03Icon;
		name?: string | null;
		color?: string | null;
		stroke?: string | null;
	};

	let {
		icon = Loading03Icon,
		class: className,
		className: svgClassName,
		role = "status",
		// we add name, color, and stroke for compatibility with different icon libraries props
		name,
		color,
		stroke,
		"aria-label": ariaLabel = "Loading",
		...restProps
	}: Props = $props();
</script>

<HugeiconsIcon
	{icon}
	strokeWidth={2}
	{role}
	name={name === null ? undefined : name}
	color={color === null ? undefined : color}
	stroke={stroke === null ? undefined : stroke}
	aria-label={ariaLabel}
	class={cn("size-4 animate-spin", className, svgClassName ?? undefined)}
	{...restProps}
/>
