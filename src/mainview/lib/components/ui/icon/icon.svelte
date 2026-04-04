<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { iconRegistry, type IconName } from "$lib/icons/icon-registry.js";
	import { HugeiconsIcon } from "@hugeicons/svelte";

	interface Props {
		name: IconName;
		size?: string | number;
		strokeWidth?: string | number;
		color?: string;
		ariaLabel?: string;
		class?: string;
		role?: string;
		stroke?: string;
	}

	let {
		name,
		size,
		strokeWidth = 2,
		color,
		ariaLabel,
		class: className,
		role,
		stroke,
	}: Props = $props();

	let resolvedClass = $derived(cn(className ?? undefined));
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
			strokeWidth={Number(strokeWidth)}
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
			size={size?.toString()}
			strokeWidth={strokeWidth?.toString()}
			color={resolvedColor}
			ariaLabel={ariaLabel}
			class={resolvedClass}
			{role}
			{stroke}
		/>
	{/if}
{/if}
