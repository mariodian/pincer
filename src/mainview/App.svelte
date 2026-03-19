<script>
  import AppSidebar from "$lib/components/app/Sidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { TRAY_TITLE } from "../bun/config";
  import "./app.css";
  import Window from "./ui/Window.svelte";

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
  <Sidebar.Provider>
    <AppSidebar />
    <main class="w-full m-2 p-4 bg-white/50 dark:bg-black/50 rounded-xl">
      <Sidebar.Trigger />
      {@render children?.()}
    </main>
  </Sidebar.Provider>
</Window>
