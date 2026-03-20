<script lang="ts">
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import Agents from "$lib/pages/Agents.svelte";
  import Dashboard from "$lib/pages/Dashboard.svelte";
  import Settings from "$lib/pages/Settings.svelte";
  import Router from "@bmlt-enabled/svelte-spa-router";
  import { ModeWatcher } from "mode-watcher";
  import { onMount } from "svelte";
  import { TRAY_TITLE } from "../bun/config";
  import type { MainWindowRPCType } from "../shared/rpc";
  import "./app.css";
  import Window from "./ui/Window.svelte";

  const MAIN_WINDOW_MODE_STORAGE_KEY = "crab-main-window-mode";
  const MAIN_WINDOW_THEME_STORAGE_KEY = "crab-main-window-theme";

  const routes = {
    "/": Dashboard,
    "/agents": Agents,
    "/settings": Settings,
  };

  onMount(() => {
    // Skip RPC wiring in plain Vite/browser mode.
    const hasElectrobunRuntime =
      typeof window !== "undefined" &&
      typeof (window as any).__electrobunWebviewId !== "undefined" &&
      typeof (window as any).__electrobunRpcSocketPort !== "undefined";

    if (!hasElectrobunRuntime) {
      return;
    }

    void (async () => {
      try {
        const { Electroview } = await import("electrobun/view");
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
      } catch (error) {
        console.error("Main window Electrobun init failed:", error);
      }
    })();
  });
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
