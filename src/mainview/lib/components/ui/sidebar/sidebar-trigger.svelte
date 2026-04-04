<script lang="ts">
  import { cn } from "$lib/utils.js";
  import PanelLeftIcon from '@lucide/svelte/icons/panel-left';
  import type { ComponentProps } from "svelte";
  import { useSidebar } from "./context.svelte";
  import MenuButton, {
      type SidebarMenuButtonSize,
  } from "./sidebar-menu-button.svelte";

  let {
    ref = $bindable(null),
    class: className,
    size = "default",
    tooltipContent,
    tooltipContentProps,
    onclick,
    ...restProps
  }: Omit<ComponentProps<typeof MenuButton>, "size"> & {
    onclick?: (e: MouseEvent) => void;
    disabled?: boolean;
    size?:
      | SidebarMenuButtonSize
      | "icon"
      | "icon-xs"
      | "icon-sm"
      | "icon-lg"
      | "xs";
  } = $props();

  const sidebar = useSidebar();

  const mappedSize = $derived.by((): SidebarMenuButtonSize => {
    if (size === "sm" || size === "lg" || size === "default") {
      return size;
    }
    if (size === "xs") {
      return "sm";
    }
    return "default";
  });

  const iconSizeClass = $derived.by(() => {
    if (size === "icon-xs") {
      return "size-6! p-1.5!";
    }
    if (size === "icon-sm") {
      return "size-8! p-2!";
    }
    if (size === "icon-lg") {
      return "size-10! p-2.5!";
    }
    if (size === "icon") {
      return "size-9! p-2!";
    }
    return "";
  });
</script>

<MenuButton
  bind:ref
  data-sidebar="trigger"
  data-slot="sidebar-trigger"
  size={mappedSize}
  tabindex={restProps.tabindex ?? 0}
  {tooltipContent}
  {tooltipContentProps}
  class={cn(
    "cn-sidebar-trigger w-auto! shrink-0 justify-center",
    iconSizeClass,
    className,
  )}
  onclick={(e) => {
    onclick?.(e);
    sidebar.toggle();
  }}
  {...restProps}
>
  <PanelLeftIcon class="size-5" />
  <span class="sr-only">Toggle Sidebar</span>
</MenuButton>
