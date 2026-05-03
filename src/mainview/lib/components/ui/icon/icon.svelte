<script lang="ts">
	import { iconRegistry, type IconName } from "$lib/icons/icon-registry";
	import { cn } from "$lib/utils";
	import { HugeiconsIcon } from "@hugeicons/svelte";

	interface Props {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		color?: string;
		ariaLabel?: string;
		class?: string;
		role?: string;
		stroke?: string;
    animate?: boolean;
	}

	let {
		name,
		size = 16,
		strokeWidth = 2,
		color,
		ariaLabel,
		class: className,
		role,
		stroke,
    animate = false,
	}: Props = $props();

	let resolvedClass = $derived(
		cn(
      // Centering normalization
			"inline-block align-middle [transform-box:fill-box] [transform-origin:center]",
      "p-0 animate-spin",
			className ?? undefined,
      animate
        ? "[animation-play-state:running]"
        : "[animation-play-state:paused]",
		),
	);
	let resolvedColor = $derived(color);

	// Determine which source to use
	// Use lucide by default, fallback to hugeicons if lucide not available
	let source = $derived.by(() => {
		const entry = iconRegistry[name];
		return entry?.lucide ? "lucide" : "hugeicons";
	});
</script>

{#if source === "hugeicons"}
	{@const entry = iconRegistry[name]}
	{#if entry.hugeicons}
		<HugeiconsIcon
			icon={entry.hugeicons}
      size={size}
			strokeWidth={strokeWidth}
			color={resolvedColor}
			aria-label={ariaLabel}
			class={resolvedClass}
			{role}
			{stroke}
		/>
	{/if}
{:else}
	{@const entry = iconRegistry[name]}
	{#if entry.lucide}
		{@const LucideIcon = entry.lucide}
		<LucideIcon
			size={size}
			strokeWidth={strokeWidth}
			color={resolvedColor}
			ariaLabel={ariaLabel}
			class={resolvedClass}
			{role}
			{stroke}
		/>
	{/if}
{/if}
