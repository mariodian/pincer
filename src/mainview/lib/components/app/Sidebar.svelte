<script lang="ts">
  import { APP_NAME } from "$bun/config";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import {
    CalendarIcon,
    CrabIcon,
    DashboardSpeedIcon,
    InboxIcon,
    SearchIcon,
    SettingsIcon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import NavMain from "./NavMain.svelte";
  import NavSecondary from "./NavSecondary.svelte";

  const menuItems = {
    navMain: [
      { title: "Dashboard", icon: DashboardSpeedIcon, url: "#" },
      { title: "Inbox", icon: InboxIcon, url: "#" },
      { title: "Calendar", icon: CalendarIcon, url: "#" },
      { title: "Search", icon: SearchIcon, url: "#" },
    ],
    // navSecondary: []
    navSecondary: [{ title: "Settings", icon: SettingsIcon, url: "#" }],
  };
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Header>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton size="lg">
          {#snippet child({ props })}
            <a href="##" {...props}>
              <div
                class={[
                  "flex items-center justify-center",
                  "bg-sidebar-primary",
                  "text-sidebar-primary-foreground",
                  "aspect-square size-8 rounded-lg",
                ]}
              >
                <HugeiconsIcon icon={CrabIcon} strokeWidth={2} />
              </div>
              <div class="flex flex-col gap-0.5 leading-none">
                <span class="font-medium">{APP_NAME}</span>
              </div>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Header>
  <Sidebar.Content>
    <NavMain items={menuItems.navMain} />
    <NavSecondary items={menuItems.navSecondary} class="mt-auto" />
  </Sidebar.Content>
</Sidebar.Root>
