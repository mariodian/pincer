<script lang="ts">
  import type { Snippet } from "svelte";

  type CssClass = string | string[];

  interface Props {
    children?: Snippet;
    className?: CssClass;
    bgColor?: CssClass;
    textColor?: CssClass;
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    display?: "inline" | "block";
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
  }

  let {
    children,
    className = "",
    size = "md",
    bgColor = "bg-white/60 hover:bg-white/90 dark:bg-black/30 dark:hover:bg-black/50",
    textColor = "text-black/70 dark:text-white",
    type = "submit",
    display = "inline",
    disabled = false,
    onclick,
  }: Props = $props();

  const displayClasses = {
    inline: "flex-1",
    block: "block",
  };

  const sizeClasses = {
    sm: "px-3 py-2.5 text-xs rounded-sm font-semibold",
    md: "px-4 py-2 text-sm rounded",
    lg: "px-6 py-3 text-sm rounded-md",
  };
</script>

<button
  {type}
  {disabled}
  class={[
    "transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    bgColor,
    textColor,
    displayClasses[display],
    `${sizeClasses[size]} ${className}`,
  ]}
  {onclick}
>
  {#if children}
    {@render children()}
  {/if}
</button>
