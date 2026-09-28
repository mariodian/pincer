<script lang="ts">
  import Router, { replace, router } from "@bmlt-enabled/svelte-spa-router";
  import wrap from "@bmlt-enabled/svelte-spa-router/wrap";
  import { resolveMacOSDragRegion } from "$shared/dragRegion";
  import { mode, ModeWatcher } from "mode-watcher";
  import { Toaster } from "svelte-sonner";

  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import Window from "$lib/components/app/Window.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import Agents from "$lib/pages/Agents.svelte";
  import Dashboard from "$lib/pages/Dashboard.svelte";
  import Incidents from "$lib/pages/Incidents.svelte";
  import Reports from "$lib/pages/Reports.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import {
    getMainRPC,
    pendingNavigationRoute,
    rpcReady,
  } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import {
    MACOS_DRAG_ORIGIN_X,
    MACOS_TITLEBAR_INSET,
    TRAY_TITLE,
  } from "../bun/config";

  import "./app.css";

  const MAIN_WINDOW_MODE_STORAGE_KEY = "main-window-mode";
  const MAIN_WINDOW_THEME_STORAGE_KEY = "main-window-theme";

  const routes = {
    "/": wrap({
      component: Dashboard,
      conditions: [
        () => {
          let route: string | null = null;
          pendingNavigationRoute.update((r) => {
            route = r;
            return null;
          });
          replace(route ? `/${route}` : "/dashboard");
          return false;
        },
      ],
    }),
    "/dashboard": Dashboard,
    "/agents": Agents,
    "/agents/*": Agents,
    "/incidents": Incidents,
    "/reports": Reports,
    "/settings": Settings,
  };

  const isMacOS =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Macintosh");

  let trackedPath = $state<string | undefined>(undefined);

  $effect(() => {
    if (!isMacOS || !$rpcReady) {
      return;
    }

    const region = resolveMacOSDragRegion({
      originX: MACOS_DRAG_ORIGIN_X,
      titlebarInset: MACOS_TITLEBAR_INSET,
    });
    void getMainRPC()
      .request.setWindowDragRegion(region)
      .catch((error: unknown) => {
        console.error("Failed to update the window drag region:", error);
      });
  });

  $effect(() => {
    if (trackedPath !== undefined && router.location !== trackedPath) {
      previousRoute.set(trackedPath);
    }
    currentRoute.set(router.location);
    trackedPath = router.location;
  });
</script>

<Window title={TRAY_TITLE}>
  <Toaster theme={mode.current ?? "light"} />
  <ModeWatcher
    modeStorageKey={MAIN_WINDOW_MODE_STORAGE_KEY}
    themeStorageKey={MAIN_WINDOW_THEME_STORAGE_KEY}
  />
  {#if $rpcReady}
    <Sidebar.Provider
      class={isMacOS ? "macos-hidden-titlebar" : undefined}
      style={isMacOS
        ? `--titlebar-inset: ${MACOS_TITLEBAR_INSET}px`
        : undefined}
    >
      <AppSidebar />
      <Sidebar.Inset
        data-slot="content"
        class={[
          "m-1.5 min-w-0 px-4 pt-5 pb-4",
          "rounded-2xl",
          "shadow-xs inset-shadow-2xs shadow-black/10 inset-shadow-white/50",
          "dark:shadow-none dark:inset-shadow-none",
          "bg-content-background",
        ]}
      >
        <Router {routes} />
      </Sidebar.Inset>
    </Sidebar.Provider>
  {/if}
</Window>

<style>
  :global(body) {
    background-color: var(--sidebar);
  }
  :global([data-slot="sidebar-container"]) {
    border-color: transparent !important;
  }
  :global(.macos-hidden-titlebar [data-slot="sidebar-header"]) {
    padding-top: calc(var(--titlebar-inset) + 0.5rem);
  }
  :global(
    html.dark input,
    html.dark textarea,
    html.dark select,
    html.dark [data-slot="select-trigger"]
  ) {
    background-color: var(--input-background);
    border-color: var(--input-border);

    --tw-inset-shadow-color: color-mix(
      in oklab,
      color-mix(in oklab, #000 15%, transparent) 100%,
      transparent
    );
    --tw-inset-shadow: inset 0 1px 2px var(--tw-inset-shadow-color);
    box-shadow: var(--tw-inset-shadow);
  }
</style>
