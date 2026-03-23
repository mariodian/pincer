<script lang="ts">
  import { APP_NAME } from "$bun/config";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import {
    CrabIcon,
    DashboardSpeedIcon,
    RoboticIcon,
    SettingsIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import packageJson from "../../../../../package.json";
  import NavMain from "./NavMain.svelte";
  import NavSecondary from "./NavSecondary.svelte";

  const appVersion = packageJson.version;

  const menuItems = {
    navMain: [
      { title: "Dashboard", icon: DashboardSpeedIcon, url: "/" },
      { title: "Agents", icon: RoboticIcon, url: "/agents" },
    ],
    navSecondary: [{ title: "Settings", icon: SettingsIcon, url: "/settings" }],
  };
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <div
          class={[
            "flex w-full items-center gap-2 h-12 p-2",
            "h-12 text-sm ",
            "overflow-hidden outline-hidden",
            "transition-[width,height,padding]",
            "group-data-[collapsible=icon]:p-0!",
          ]}
        >
          <div
            class={[
              "flex items-center justify-center",
              "bg-sidebar-primary",
              "text-sidebar-primary-foreground",
              "transition-[width,height,padding]",
              "aspect-square rounded-lg",
              "size-10 group-data-[collapsible=icon]:size-8!",
            ]}
          >
            <HugeiconsIcon
              icon={CrabIcon}
              strokeWidth={2}
              class={[
                "transition-[width,height,padding]",
                "group-data-[collapsible=icon]:size-4!",
              ].join(" ")}
            />
          </div>
          <div class="flex flex-col gap-0.2 leading-none">
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
