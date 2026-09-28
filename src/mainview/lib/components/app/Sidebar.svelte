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
      { title: "Incidents", icon: "pulse" as const, url: "/incidents" },
      { title: "Reports", icon: "barChart" as const, url: "/reports" },
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
            "mt-2 flex h-10 w-full items-center gap-2 px-1",
            "text-sm",
            "overflow-hidden outline-hidden",
            "group-data-[collapsible=icon]:p-1",
          ]}
        >
          <div
            class={[
              "mr-1 flex items-center",
              "transition-[width,height,margin]",
              "text-sidebar-primary-foreground",
              "aspect-square rounded-lg",
              "size-10 group-data-[collapsible=icon]:size-10!",
            ]}
          >
            <img
              src={logo}
              alt="Pincer Logo"
              class={[
                "transition-[width,height,padding]",
                "duration-200",
                "group-data-[collapsible=icon]:size-6!",
                "h-full w-full",
              ]}
            />
          </div>
          <div
            class={[
              "gap-0.2 flex flex-col leading-none",
              "transition-opacity duration-200",
              "group-data-[collapsible=icon]:opacity-0!",
            ]}
          >
            <span class="text-base font-bold">{APP_NAME}</span>
            <span
              class="text-sidebar-foreground/50 dark:text-sidebar-foreground/50 text-xs"
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
