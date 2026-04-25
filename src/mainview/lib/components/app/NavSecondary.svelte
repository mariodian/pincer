<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Icon } from "$lib/components/ui/icon/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import type { IconName } from "$lib/icons/icon-registry.js";
  import { currentRoute } from "$lib/services/navigationStore";
  import { cn, type WithoutChildren } from "$lib/utils";
  import { isActiveUrl } from "$lib/utils/url.js";
  import { link } from "@bmlt-enabled/svelte-spa-router";
  import { resetMode, setMode, userPrefersMode } from "mode-watcher";
  import type { ComponentProps } from "svelte";

  const sidebar = useSidebar();
  let shouldFlex = $state(false);
  let shouldDisableSidebarTrigger = $state(false);

  let currentLocation = $derived($currentRoute);

  const selectedThemeLabel = $derived.by(() => {
    const preferred = userPrefersMode.current;
    if (preferred === "light") {
      return "Light";
    }
    if (preferred === "dark") {
      return "Dark";
    }
    return "System";
  });
  const selectedThemeKey = $derived.by(() => {
    const preferred = userPrefersMode.current;
    if (preferred === "light" || preferred === "dark") {
      return preferred;
    }
    return "system";
  });

  $effect(() => {
    if (sidebar.state === "collapsed") {
      setTimeout(() => {
        shouldFlex = true;
      }, 150);
    } else {
      shouldFlex = false;
    }
  });

  let {
    items,
    ...restProps
  }: {
    items: { title: string; url: string; icon: IconName }[];
  } & WithoutChildren<ComponentProps<typeof Sidebar.Group>> = $props();

  $effect(() => {
    shouldDisableSidebarTrigger = sidebar.isMobile;
  });
</script>

<Sidebar.Group {...restProps}>
  <Sidebar.GroupContent>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {#if item.title === "Settings"}
          <Sidebar.MenuItem class="flex items-center gap-2">
            <Sidebar.MenuButton
              class="min-w-8 duration-150 ease-linear"
              tooltipContent={item.title}
              isActive={isActiveUrl(currentLocation, item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <Icon name={item.icon} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>

          <div class="transition-all duration-150">
            <Sidebar.MenuItem class="flex items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  class="flex-1 group-sidebar-expanded/settings:flex-1"
                >
                  <Sidebar.MenuButton
                    class={cn([
                      "min-w-8",
                      "duration-200 ease-linear",
                      "[&_svg]:transition-transform! [&_svg]:duration-300",
                    ])}
                    tooltipContent={selectedThemeLabel}
                  >
                    {#snippet child({ props })}
                      <div {...props}>
                        <Icon
                          name="sun"
                          class={cn([
                            "scale-100 rotate-0",
                            "dark:scale-0 dark:-rotate-90",
                          ])}
                        />
                        <Icon
                          name="moon"
                          class={cn([
                            "absolute",
                            "scale-0 rotate-90",
                            "dark:scale-100 dark:rotate-0",
                          ])}
                        />
                        <span>{selectedThemeLabel}</span>
                      </div>
                    {/snippet}
                  </Sidebar.MenuButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="start">
                  <DropdownMenu.Item onclick={() => setMode("light")}
                    >Light
                    {#if selectedThemeKey === "light"}
                      <DropdownMenu.Shortcut>
                        <Icon name="tick" strokeWidth={3} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                  <DropdownMenu.Item onclick={() => setMode("dark")}
                    >Dark
                    {#if selectedThemeKey === "dark"}
                      <DropdownMenu.Shortcut>
                        <Icon name="tick" strokeWidth={3} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                  <DropdownMenu.Item onclick={() => resetMode()}
                    >System
                    {#if selectedThemeKey === "system"}
                      <DropdownMenu.Shortcut>
                        <Icon name="tick" strokeWidth={3} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <div
                class={cn([
                  "transition-all duration-150",
                  shouldFlex
                    ? "max-w-0 opacity-0 pointer-events-none overflow-hidden"
                    : "max-w-10 opacity-100",
                ])}
              >
                <Sidebar.Trigger
                  tabindex={shouldFlex ? -1 : 0}
                  size="icon-sm"
                />
              </div>
            </Sidebar.MenuItem>
          </div>

          <div
            class={cn([
              "transition-all duration-150",
              shouldFlex
                ? "max-h-10 opacity-100 mb-1"
                : "max-h-0 opacity-0 mt-0 pointer-events-none overflow-hidden",
            ])}
          >
            <Sidebar.MenuItem>
              <Sidebar.Trigger
                tabindex={shouldFlex ? 0 : -1}
                disabled={!!shouldDisableSidebarTrigger}
                tooltipContent="Open sidebar"
                size="icon"
              />
            </Sidebar.MenuItem>
          </div>
        {:else}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <Icon name={item.icon} />
                  <span>{item.title}</span>
                </a>
              {/snippet}
            </Sidebar.MenuButton>
          </Sidebar.MenuItem>
        {/if}
      {/each}
    </Sidebar.Menu>
  </Sidebar.GroupContent>
</Sidebar.Group>
