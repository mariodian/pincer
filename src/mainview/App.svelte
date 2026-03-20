<script lang="ts">
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { ModeWatcher } from "mode-watcher";
  import { TRAY_TITLE } from "../bun/config";
  import "./app.css";
  import Window from "./ui/Window.svelte";
  import Router from "@bmlt-enabled/svelte-spa-router";
  import { Electroview } from "electrobun/view";
  import type { MainWindowRPCType } from "../shared/rpc";
  import Dashboard from "$lib/pages/Dashboard.svelte";
  import Agents from "$lib/pages/Agents.svelte";
  import Settings from "$lib/pages/Settings.svelte";

  const MAIN_WINDOW_MODE_STORAGE_KEY = "crab-main-window-mode";
  const MAIN_WINDOW_THEME_STORAGE_KEY = "crab-main-window-theme";

  const routes = {
    "/": Dashboard,
    "/agents": Agents,
    "/settings": Settings,
  };

  const rpc = Electroview.defineRPC<MainWindowRPCType>({
    handlers: {
      requests: {},
      messages: {
        navigateTo: ({ params }) => {
          window.location.hash = params.path;
        },
      },
    },
  });

  new Electroview({ rpc });
</script>

<Window title={TRAY_TITLE}>
  <ModeWatcher
    modeStorageKey={MAIN_WINDOW_MODE_STORAGE_KEY}
    themeStorageKey={MAIN_WINDOW_THEME_STORAGE_KEY}
  />
  <Sidebar.Provider>
    <AppSidebar />
    <main class="w-full m-1.5 py-3 px-3 rounded-xl bg-background">
      <Router {routes} />
    </main>
  </Sidebar.Provider>
</Window>
