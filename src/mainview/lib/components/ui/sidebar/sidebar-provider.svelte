<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import { onMount } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    SIDEBAR_COOKIE_MAX_AGE,
    SIDEBAR_COOKIE_NAME,
    SIDEBAR_STORAGE_KEY,
    SIDEBAR_WIDTH,
    SIDEBAR_WIDTH_ICON,
  } from "./constants.js";
  import { setSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    open = $bindable(true),
    onOpenChange = () => {},
    class: className,
    style,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  const sidebar = setSidebar({
    open: () => open,
    setOpen: (value: boolean) => {
      open = value;
      onOpenChange(value);

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
      } catch (error) {
        console.warn("Failed to persist sidebar state", error);
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
  });

  onMount(() => {
    try {
      const storedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);

      if (storedState === "true" || storedState === "false") {
        sidebar.setOpen(storedState === "true");
        return;
      }

      const cookieEntry = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(`${SIDEBAR_COOKIE_NAME}=`));
      const cookieValue = cookieEntry?.split("=")[1];

      if (cookieValue === "true" || cookieValue === "false") {
        sidebar.setOpen(cookieValue === "true");
      }
    } catch (error) {
      console.warn("Failed to restore sidebar state", error);
    }
  });
</script>

<svelte:window onkeydown={sidebar.handleShortcutKeydown} />

<Tooltip.Provider delayDuration={0}>
  <div
    data-slot="sidebar-wrapper"
    style="--sidebar-width: {SIDEBAR_WIDTH}; --sidebar-width-icon: {SIDEBAR_WIDTH_ICON}; {style}"
    class={cn(
      "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
      className,
    )}
    bind:this={ref}
    {...restProps}
  >
    {@render children?.()}
  </div>
</Tooltip.Provider>
