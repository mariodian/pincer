<script>
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { ModeWatcher } from "mode-watcher";
  import { TRAY_TITLE } from "../bun/config";
  import "./app.css";
  import Window from "./ui/Window.svelte";

  const MAIN_WINDOW_MODE_STORAGE_KEY = "crab-main-window-mode";
  const MAIN_WINDOW_THEME_STORAGE_KEY = "crab-main-window-theme";

  let count = $state(0);
  let { children } = $props();

  function increment() {
    count += 1;
  }

  function reset() {
    count = 0;
  }
</script>

<Window title={TRAY_TITLE}>
  <ModeWatcher
    modeStorageKey={MAIN_WINDOW_MODE_STORAGE_KEY}
    themeStorageKey={MAIN_WINDOW_THEME_STORAGE_KEY}
  />
  <Sidebar.Provider>
    <AppSidebar />
    <main class="w-full m-1 py-2 px-1 rounded-xl">
      <Sidebar.Trigger class="" />
      {@render children?.()}
    </main>
  </Sidebar.Provider>
</Window>
