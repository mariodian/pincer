<script lang="ts">
  import logo from "$assets/logo.webp";
  import { APP_NAME } from "$bun/config";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import packageJson from "../../../../../package.json";
  import NavMain from "./NavMain.svelte";
  import NavSecondary from "./NavSecondary.svelte";

  const appVersion = packageJson.version;

  const menuItems = {
    navMain: [
      { title: "Dashboard", icon: "dashboard" as const, url: "/dashboard" },
      { title: "Agents", icon: "agents" as const, url: "/agents" },
    ],
    navSecondary: [
      { title: "Settings", icon: "settings" as const, url: "/settings" },
    ],
  };
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <div
          class={[
            "flex w-full items-center gap-2 px-1 mt-2 h-10",
            "text-sm",
            "overflow-hidden outline-hidden",
            "group-data-[collapsible=icon]:p-1",
          ]}
        >
          <div
            class={[
              "flex items-center mr-1",
              "transition-[width,height,margin]",
              "text-sidebar-primary-foreground",
              "aspect-square rounded-lg",
              "size-10 group-data-[collapsible=icon]:size-10!",
              // "w-10 h-10",
            ]}
          >
            <img
              src={logo}
              alt="Pincer Logo"
              class={[
                "transition-[width,height,padding]",
                "duration-200",
                "group-data-[collapsible=icon]:size-6!",
                "w-full h-full",
              ]}
            />
          </div>
          <div
            class={[
              "flex flex-col gap-0.2 leading-none",
              "duration-200 transition-opacity",
              "group-data-[collapsible=icon]:opacity-0!",
            ]}
          >
            <span class="font-bold text-base">{APP_NAME}</span>
            <span
              class="text-xs text-sidebar-foreground/50 dark:text-sidebar-foreground/50"
              >v{appVersion}</span
            >
          </div>
        </div>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain items={menuItems.navMain} />
    <NavSecondary items={menuItems.navSecondary} class="mt-auto" />
  </Sidebar.Content>
</Sidebar.Root>
