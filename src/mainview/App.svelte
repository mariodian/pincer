<script lang="ts">
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import Window from "$lib/components/app/Window.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import Agents from "$lib/pages/Agents.svelte";
  import Dashboard from "$lib/pages/Dashboard.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import { currentRoute, previousRoute } from "$lib/services/navigationStore";
  import Router, { replace, router } from "@bmlt-enabled/svelte-spa-router";
  import wrap from "@bmlt-enabled/svelte-spa-router/wrap";
  import { ModeWatcher } from "mode-watcher";
  import { TRAY_TITLE } from "../bun/config";
  import "./app.css";

  const MAIN_WINDOW_MODE_STORAGE_KEY = "main-window-mode";
  const MAIN_WINDOW_THEME_STORAGE_KEY = "main-window-theme";

  const routes = {
    "/": wrap({
      component: Dashboard,
      conditions: [
        () => {
          replace("/dashboard");
          return false;
        },
      ],
    }),
    "/dashboard": Dashboard,
    "/agents": Agents,
    "/agents/*": Agents,
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
  <ModeWatcher
    modeStorageKey={MAIN_WINDOW_MODE_STORAGE_KEY}
    themeStorageKey={MAIN_WINDOW_THEME_STORAGE_KEY}
  />
  <Sidebar.Provider>
    <AppSidebar />
    <main
      data-slot="content"
      class={[
        "w-full m-1.5 py-5 px-4",
        "rounded-xl",
        "shadow-xs shadow-black/10 dark:shadow-none",
      ]}
    >
      <Router {routes} />
    </main>
  </Sidebar.Provider>
</Window>

<style>
  :global(body) {
    background-color: var(--sidebar);
  }
  :global([data-slot="sidebar-container"]) {
    border-color: transparent !important;
  }

  :global([data-slot="content"]) {
    background-color: var(--body-background);
  }
  :global(input, textarea, select, [data-slot="select-trigger"]) {
    background-color: var(--input-background);
  }
</style>
