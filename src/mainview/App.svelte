<script lang="ts">
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import Window from "$lib/components/app/Window.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import Agents from "$lib/pages/Agents.svelte";
  import Dashboard from "$lib/pages/Dashboard.svelte";
  import Incidents from "$lib/pages/Incidents.svelte";
  import Reports from "$lib/pages/Reports.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import { pendingNavigationRoute, rpcReady } from "$lib/services/mainRPC";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import Router, { replace, router } from "@bmlt-enabled/svelte-spa-router";
  import wrap from "@bmlt-enabled/svelte-spa-router/wrap";
  import { ModeWatcher, mode } from "mode-watcher";
  import { Toaster } from "svelte-sonner";
  import { TRAY_TITLE } from "../bun/config";
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

  let trackedPath = $state<string | undefined>(undefined);

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
    <Sidebar.Provider>
      <AppSidebar />
      <main
        data-slot="content"
        class={[
          "w-full m-1.5 py-5 px-4",
          "rounded-xl overflow-x-hidden",
          "shadow-xs shadow-black/10 dark:shadow-none",
          "bg-content-background",
        ]}
      >
        <Router {routes} />
      </main>
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
  /* :global(input, textarea, select, [data-slot="select-trigger"]) {
    background-color: var(--input-background);
  } */
</style>
