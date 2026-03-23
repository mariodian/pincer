<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import type { WithoutChildren } from "$lib/utils";
  import { link, router } from "@bmlt-enabled/svelte-spa-router";
  import { Moon02Icon, SunIcon, Tick01Icon } from "@hugeicons/core-free-icons";
  import type { IconSvgElement } from "@hugeicons/svelte";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { resetMode, setMode, userPrefersMode } from "mode-watcher";
  import type { ComponentProps } from "svelte";

  const sidebar = useSidebar();
  let shouldFlex = $state(false);
  let shouldDisableSidebarTrigger = $state(false);

  let currentLocation = $state(router.location);

  $effect(() => {
    currentLocation = router.location;
  });

  function isActive(url: string): boolean {
    return currentLocation === url;
  }
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
    items: { title: string; url: string; icon: IconSvgElement }[];
  } & WithoutChildren<ComponentProps<typeof Sidebar.Group>> = $props();

  window.addEventListener("resize", () => {
    if (sidebar.isMobile) {
      shouldDisableSidebarTrigger = true;
    } else {
      shouldDisableSidebarTrigger = false;
    }
  });
</script>

<Sidebar.Group {...restProps}>
  <Sidebar.GroupContent>
    <Sidebar.Menu>
      {#each items as item (item.title)}
        {#if item.title === "Settings"}
          <Sidebar.MenuItem class="flex items-center gap-2">
            <Sidebar.MenuButton
              class="min-w-8 duration-200 ease-linear"
              tooltipContent={item.title}
              isActive={isActive(item.url)}
            >
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
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
                    class="min-w-8 duration-200 ease-linear"
                    tooltipContent={selectedThemeLabel}
                  >
                    {#snippet child({ props })}
                      <div {...props}>
                        <HugeiconsIcon
                          icon={SunIcon}
                          strokeWidth={2}
                          class={[
                            "h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all!",
                            "dark:scale-0 dark:-rotate-90",
                          ].join(" ")}
                        />
                        <HugeiconsIcon
                          icon={Moon02Icon}
                          strokeWidth={2}
                          class={[
                            "absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all!",
                            "dark:scale-100 dark:rotate-0",
                          ].join(" ")}
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
                        <HugeiconsIcon icon={Tick01Icon} strokeWidth={2.5} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                  <DropdownMenu.Item onclick={() => setMode("dark")}
                    >Dark
                    {#if selectedThemeKey === "dark"}
                      <DropdownMenu.Shortcut>
                        <HugeiconsIcon icon={Tick01Icon} strokeWidth={2.5} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                  <DropdownMenu.Item onclick={() => resetMode()}
                    >System
                    {#if selectedThemeKey === "system"}
                      <DropdownMenu.Shortcut>
                        <HugeiconsIcon icon={Tick01Icon} strokeWidth={2.5} />
                      </DropdownMenu.Shortcut>
                    {/if}</DropdownMenu.Item
                  >
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <div
                class={[
                  "transition-all duration-150 overflow-hidden",
                  shouldFlex
                    ? "max-w-0 opacity-0 pointer-events-none"
                    : "max-w-10 opacity-100",
                ]}
              >
                <Sidebar.Trigger size="icon-sm" />
              </div>
            </Sidebar.MenuItem>
          </div>

          <div
            class={[
              "transition-all duration-150 overflow-hidden",
              shouldFlex
                ? "max-h-10 opacity-100"
                : "max-h-0 opacity-0 mt-0 pointer-events-none",
            ]}
          >
            <Sidebar.MenuItem>
              <Sidebar.Trigger
                disabled={!!shouldDisableSidebarTrigger}
                tooltipContent="Open sidebar"
                size="icon-sm"
              />
            </Sidebar.MenuItem>
          </div>
        {:else}
          <Sidebar.MenuItem>
            <Sidebar.MenuButton>
              {#snippet child({ props })}
                <a href={item.url} use:link {...props}>
                  <HugeiconsIcon icon={item.icon} strokeWidth={2} />
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
